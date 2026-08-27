import { supabasePublic } from "@/lib/supabase/public";
import { parseEwkbPoint } from "@/lib/ewkb";
import { getContentPolicy, resolvePhotoUrl } from "@/lib/config/contentPolicy";
import type {
  Sauna,
  Collection,
  Article,
  SaunaCategory,
  SaunaPhoto,
  BlogReview,
  SaunaReview,
  ContentPolicy,
  TempInfo,
  TempStat,
} from "./types";

/**
 * 데이터 접근 레이어 — 컴포넌트(서버·클라이언트)는 이 함수들만 호출한다.
 * Supabase(anon, RLS read) 기반. 발견(목록/지도/홈)은 영업중 + 검수 통과만 노출하고,
 * 상세/찜/방문 조회는 폐업도 resolve(찜 목록에서 사라지지 않도록).
 *
 * 사진 정책(킬스위치·출처)은 여기서 서버·클라 양쪽 공용으로 적용한다.
 * 클라이언트로 내보내는 객체에는 우리 Storage URL(또는 null)만 담고,
 * 출처(thumbnail_source)·원본URL(source_url)은 절대 포함하지 않는다(무흔적).
 */

// thumbnail_source 는 정책 판단에만 쓰고 결과 객체엔 넣지 않는다(서버 전용).
const COLS =
  "id, license_no, name, address, sido, sigungu, dong, location, status, closed_date, " +
  "phone, open_date, created_at, is_jjimjilbang, is_hot_spring, is_enzyme, is_sesin_shop, venue_type, is_24h, has_outdoor, " +
  "sauna_room_temp, cold_bath_temp, " +
  "sauna_room_temp_m, sauna_room_temp_f, cold_bath_temp_m, cold_bath_temp_f, " +
  "has_sesin, sauna_kind, price, price_list, hours, hours_json, amenities, " +
  "has_parking, parking_note, water_note, thumbnail_url, " +
  "thumbnail_source, editor_note, ai_description, slug, " +
  "rating_avg, rating_count";

const OPERATING = "영업/정상";

/* eslint-disable @typescript-eslint/no-explicit-any */
function mapRow(r: any, images: ContentPolicy["images"]): Sauna {
  return {
    id: r.id,
    license_no: r.license_no ?? "",
    name: r.name ?? "",
    address: r.address ?? "",
    sido: r.sido ?? "",
    sigungu: r.sigungu ?? "",
    dong: r.dong ?? "",
    location: parseEwkbPoint(r.location),
    status: r.status ?? "",
    closed_date: r.closed_date ?? null,
    phone: r.phone ?? null,
    open_date: r.open_date ?? null,
    created_at: r.created_at,
    is_jjimjilbang: !!r.is_jjimjilbang,
    is_hot_spring: !!r.is_hot_spring,
    is_enzyme: !!r.is_enzyme,
    is_sesin_shop: !!r.is_sesin_shop,
    venue_type: r.venue_type ?? "standalone",
    is_24h: !!r.is_24h,
    has_outdoor: !!r.has_outdoor,
    sauna_room_temp: r.sauna_room_temp ?? null,
    cold_bath_temp: r.cold_bath_temp ?? null,
    sauna_room_temp_m: r.sauna_room_temp_m ?? null,
    sauna_room_temp_f: r.sauna_room_temp_f ?? null,
    cold_bath_temp_m: r.cold_bath_temp_m ?? null,
    cold_bath_temp_f: r.cold_bath_temp_f ?? null,
    has_sesin: !!r.has_sesin,
    sauna_kind: r.sauna_kind ?? [],
    price: r.price ?? null,
    price_list: r.price_list ?? null,
    hours: r.hours ?? null,
    hours_json: r.hours_json ?? null,
    amenities: r.amenities ?? null,
    has_parking: r.has_parking ?? null,
    parking_note: r.parking_note ?? null,
    water_note: r.water_note ?? null,
    // 정책 적용: 표시 불가면 null. 항상 우리 Storage URL 만(원본URL은 select 안 함).
    thumbnail_url: resolvePhotoUrl(r.thumbnail_url, r.thumbnail_source, images),
    editor_note: r.editor_note ?? null,
    ai_description: r.ai_description ?? null,
    slug: r.slug ?? "",
    // numeric 은 PostgREST 에서 문자열로 옴 → Number 로 변환(없으면 null/0).
    rating_avg: r.rating_avg != null ? Number(r.rating_avg) : null,
    rating_count: r.rating_count ?? 0,
  };
}

/** 발견 노출 조건: 영업중 + 검수 통과. (체이닝 시작점) */
function discoverBase() {
  return supabasePublic
    .from("saunas")
    .select(COLS)
    .eq("status", OPERATING)
    .eq("needs_review", false);
}

/** 발견용 사우나 목록(목록/검색 베이스). 거리정렬은 위치 권한 확보 후(P1). */
export async function getDiscoverSaunas(limit = 600): Promise<Sauna[]> {
  const [{ data, error }, { images }] = await Promise.all([
    discoverBase()
      .order("open_date", { ascending: false, nullsFirst: false })
      .limit(limit),
    getContentPolicy(),
  ]);
  if (error) throw error;
  return (data ?? []).map((r: any) => mapRow(r, images));
}

/** 지도 마커용 — 좌표 있는 영업중 사우나(마커 수 제한). */
export async function getNearbySaunas(limit = 250): Promise<Sauna[]> {
  const [{ data, error }, { images }] = await Promise.all([
    discoverBase()
      .not("location", "is", null)
      .order("open_date", { ascending: false, nullsFirst: false })
      .limit(limit),
    getContentPolicy(),
  ]);
  if (error) throw error;
  return (data ?? []).map((r: any) => mapRow(r, images));
}

/**
 * 내 주변 — Geolocation 좌표 기준 거리순(가까운 순). PostGIS RPC(saunas_nearby_v2).
 * distance_km(파생) 채워서 반환. 0007 미적용 환경에선 RPC가 없어 throw → 호출부가 폴백.
 */
export async function getSaunasNearby(
  lat: number,
  lng: number,
  radiusM = 8000,
  limit = 120,
): Promise<Sauna[]> {
  const [{ data, error }, { images }] = await Promise.all([
    supabasePublic.rpc("saunas_nearby_v2", {
      lat,
      lng,
      radius_m: radiusM,
      max_results: limit,
    }),
    getContentPolicy(),
  ]);
  if (error) throw error;
  return (data ?? []).map((r: any) => {
    const s = mapRow(r, images);
    s.distance_km =
      typeof r.distance_m === "number"
        ? Math.round(r.distance_m / 100) / 10 // 100m 단위 반올림 → 0.1km
        : undefined;
    return s;
  });
}

/** 상세 — slug 로 단건. 폐업도 resolve(상세에서 '운영 종료' 표시). */
export async function getSaunaBySlug(
  _sido: string,
  slug: string,
): Promise<Sauna | null> {
  // 라우트 param이 URL-인코딩 상태로 올 수 있어 방어적 디코드(슬러그에 '%' 없음 → 멱등).
  let key = slug;
  try {
    key = decodeURIComponent(slug);
  } catch {
    /* 이미 디코드됨 */
  }
  // slug 가 unique 이므로 slug 만으로 단건 조회(sido 는 URL 표기용).
  const [{ data, error }, { images }] = await Promise.all([
    supabasePublic
      .from("saunas")
      .select(COLS)
      .eq("slug", key)
      .limit(1)
      .maybeSingle(),
    getContentPolicy(),
  ]);
  if (error) throw error;
  return data ? mapRow(data, images) : null;
}

/** 새로 오픈 — 영업중 open_date 최신순. */
export async function getNewOpenings(limit = 6): Promise<Sauna[]> {
  const [{ data, error }, { images }] = await Promise.all([
    discoverBase()
      .not("open_date", "is", null)
      .order("open_date", { ascending: false })
      .limit(limit),
    getContentPolicy(),
  ]);
  if (error) throw error;
  return (data ?? []).map((r: any) => mapRow(r, images));
}

/** 카테고리 플래그 필터(발견 노출). */
export async function getSaunasByCategory(
  cat: SaunaCategory,
  limit = 600,
): Promise<Sauna[]> {
  let q = discoverBase();
  // 효소찜질방·독립 세신샵은 별도 카테고리 → 찜질방/대중탕 목록에서 제외(중복 노출 방지).
  if (cat === "sesin") q = q.eq("is_sesin_shop", true);
  else if (cat === "enzyme") q = q.eq("is_enzyme", true);
  else if (cat === "hot_spring") q = q.eq("is_hot_spring", true);
  else if (cat === "jjimjilbang")
    q = q.eq("is_jjimjilbang", true).eq("is_enzyme", false).eq("is_sesin_shop", false);
  else
    q = q // 순수 대중탕
      .eq("is_hot_spring", false)
      .eq("is_jjimjilbang", false)
      .eq("is_enzyme", false)
      .eq("is_sesin_shop", false);
  const [{ data, error }, { images }] = await Promise.all([
    q.order("open_date", { ascending: false, nullsFirst: false }).limit(limit),
    getContentPolicy(),
  ]);
  if (error) throw error;
  return (data ?? []).map((r: any) => mapRow(r, images));
}

/** 상호·지역 검색(발견 노출). */
export async function searchSaunas(q: string, limit = 40): Promise<Sauna[]> {
  const term = q.trim();
  if (!term) return [];
  const like = `%${term}%`;
  const [{ data, error }, { images }] = await Promise.all([
    discoverBase()
      .or(
        `name.ilike.${like},sigungu.ilike.${like},dong.ilike.${like},address.ilike.${like}`,
      )
      .limit(limit),
    getContentPolicy(),
  ]);
  if (error) throw error;
  return (data ?? []).map((r: any) => mapRow(r, images));
}

/** 찜·최근·다녀옴 등 id 배열로 조회. 폐업도 resolve. */
export async function getSaunasByIds(ids: string[]): Promise<Sauna[]> {
  if (!ids.length) return [];
  const [{ data, error }, { images }] = await Promise.all([
    supabasePublic.from("saunas").select(COLS).in("id", ids),
    getContentPolicy(),
  ]);
  if (error) throw error;
  const byId = new Map((data ?? []).map((r: any) => [r.id, mapRow(r, images)]));
  // 입력 id 순서 보존
  return ids.map((id) => byId.get(id)).filter((s): s is Sauna => Boolean(s));
}

/** 내 주변 영업중 개수(홈 헤드라인). */
export async function getOpenCount(): Promise<number> {
  const { count, error } = await supabasePublic
    .from("saunas")
    .select("*", { count: "exact", head: true })
    .eq("status", OPERATING)
    .eq("needs_review", false);
  if (error) throw error;
  return count ?? 0;
}

/* ── 매장 사진·블로그 후기 ── */

/**
 * 상세 갤러리용 사진. 정책 OFF/출처 차단이면 빈 배열.
 * select 에서 source_url 은 제외(서버 전용) — 클라엔 우리 Storage url 만.
 */
export async function getSaunaPhotos(saunaId: string): Promise<SaunaPhoto[]> {
  const { images } = await getContentPolicy();
  if (!images.show) return [];
  const { data, error } = await supabasePublic
    .from("sauna_photos")
    .select("id, url, source, width, height, sort_order")
    .eq("sauna_id", saunaId)
    .eq("is_active", true)
    .is("review_id", null) // 후기 첨부 사진은 갤러리에서 제외(후기 카드 전용)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  // 같은 사진이 여러 행으로 들어온 매장이 있어(크롤 재수집분) url 로 중복을 제거한다.
  // sort_order 오름차순이므로 먼저 나온 행(=대표 순서가 앞선 쪽)을 남긴다.
  const seen = new Set<string>();
  return (data ?? [])
    .filter((r: any) => images.allowedSources.includes(r.source))
    .filter((r: any) => {
      if (seen.has(r.url)) return false;
      seen.add(r.url);
      return true;
    })
    .map((r: any) => ({
      id: r.id,
      url: r.url, // 항상 우리 Storage URL
      width: r.width ?? null,
      height: r.height ?? null,
    }));
}

/**
 * 블로그 후기 링크 카드. blog_reviews_enabled OFF 면 빈 배열(섹션 통째 숨김).
 * blog_url(원문 링크아웃)은 노출, thumb_url 은 우리 Storage 재호스팅분 + 이미지 정책 적용.
 */
export async function getBlogReviews(saunaId: string): Promise<BlogReview[]> {
  const { images, blogReviews } = await getContentPolicy();
  if (!blogReviews.show) return [];
  const { data, error } = await supabasePublic
    .from("sauna_blog_reviews")
    .select("id, title, snippet, blog_url, blogger_name, thumb_url, posted_at")
    .eq("sauna_id", saunaId)
    .eq("is_active", true)
    .order("posted_at", { ascending: false, nullsFirst: false });
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    id: r.id,
    title: r.title ?? "",
    snippet: r.snippet ?? "",
    blog_url: r.blog_url,
    blogger_name: r.blogger_name ?? null,
    // 후기 썸네일도 이미지 킬스위치 적용(우리 Storage 재호스팅분만 저장됨).
    // source=null → images.show 로만 게이트(allowedSources 출처 필터는 사우나 사진 전용).
    thumb_url: resolvePhotoUrl(r.thumb_url, null, images),
    posted_at: r.posted_at ?? null,
  }));
}

/* ── 방문자 후기(회원 작성) ── */

/**
 * 매장별 방문자 후기(최신순) — 닉네임 포함. SECURITY DEFINER RPC 로 profiles RLS 우회.
 * 0013 미적용 환경에선 RPC가 없어 에러 → 빈 배열로 폴백(섹션이 비어도 안전).
 */
export async function getSaunaReviews(saunaId: string): Promise<SaunaReview[]> {
  const { data, error } = await supabasePublic.rpc("sauna_reviews_for", {
    p_sauna_id: saunaId,
  });
  if (error) return [];
  return (data ?? []).map((r: any) => ({
    id: r.id,
    saunaId,
    userId: r.user_id,
    rating: r.rating ?? 0,
    body: r.body ?? null,
    nickname: r.nickname ?? "사우나우님",
    created_at: r.created_at,
  }));
}



/* ── 온도 제보 집계(회원) ── */

/** 크라우드 median 으로 표시 전환하는 최소 제보 수(미만이면 에디터 시딩값 유지). */
const TEMP_CROWD_THRESHOLD = 2;

/** 한 지표의 집계 상태 해석: crowd(임계치 이상) → seed → none. */
function resolveTempStat(
  median: number | null,
  count: number,
  latest: string | null,
  seed: number | null,
): TempStat {
  const crowdValue =
    median != null && count >= TEMP_CROWD_THRESHOLD ? Math.round(median) : null;
  const displayValue = crowdValue ?? seed ?? null;
  const source: TempStat["source"] =
    crowdValue != null ? "crowd" : seed != null ? "editor" : "none";
  return {
    crowdValue,
    seedValue: seed,
    displayValue,
    source,
    reportCount: count,
    latestReportAt: latest,
  };
}

/**
 * 매장 온도 정보(사우나실/냉탕) — 최근 30일 제보 median 자동 집계 + 에디터 시딩 폴백.
 * RPC 미적용(0027 이전 스키마)이면 all-seed 로 폴백(섹션이 비어도 안전, getSaunaReviews 패턴).
 */
export async function getSaunaTempInfo(
  saunaId: string,
  seed: Sauna,
): Promise<TempInfo> {
  // RPC 행 → metric 조회 맵.
  const agg = new Map<
    string,
    { median: number | null; count: number; latest: string | null }
  >();
  const { data, error } = await supabasePublic.rpc("sauna_temp_agg", {
    p_sauna_id: saunaId,
  });
  if (!error) {
    for (const r of (data ?? []) as any[]) {
      agg.set(r.metric, {
        median: r.crowd_median != null ? Number(r.crowd_median) : null,
        count: r.report_count ?? 0,
        latest: r.latest_report_at ?? null,
      });
    }
  }

  const stat = (
    metric: "sauna_room" | "cold_bath",
    seedValue: number | null,
  ): TempStat => {
    const a = agg.get(metric);
    return resolveTempStat(
      a?.median ?? null,
      a?.count ?? 0,
      a?.latest ?? null,
      seedValue,
    );
  };

  return {
    saunaRoom: stat("sauna_room", seed.sauna_room_temp ?? null),
    coldBath: stat("cold_bath", seed.cold_bath_temp ?? null),
  };
}

/* ── 큐레이션·매거진(현재 데이터 없음 → 빈 배열, 섹션 숨김) ── */

export async function getCollections(): Promise<Collection[]> {
  const { data, error } = await supabasePublic
    .from("collections")
    .select("id, title, description, slug, sort, is_published")
    .eq("is_published", true)
    .order("sort", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((c: any) => ({
    id: c.id,
    title: c.title,
    description: c.description ?? null,
    slug: c.slug ?? "",
    sort: c.sort ?? 0,
    is_published: c.is_published,
    sauna_ids: [],
  }));
}

export async function getCollectionSaunas(c: Collection): Promise<Sauna[]> {
  const { data, error } = await supabasePublic
    .from("collection_saunas")
    .select("sauna_id, sort")
    .eq("collection_id", c.id)
    .order("sort", { ascending: true });
  if (error) throw error;
  return getSaunasByIds((data ?? []).map((r: any) => r.sauna_id));
}

export async function getArticles(limit?: number): Promise<Article[]> {
  let q = supabasePublic
    .from("articles")
    .select(
      "id, title, summary, body, thumbnail_url, category, slug, published_at, is_published",
    )
    .eq("is_published", true)
    .order("published_at", { ascending: false });
  if (limit) q = q.limit(limit);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((a: any) => ({
    id: a.id,
    title: a.title,
    summary: a.summary ?? "",
    body: a.body ?? "",
    thumbnail_url: a.thumbnail_url ?? null,
    category: a.category,
    slug: a.slug ?? "",
    published_at: a.published_at ?? "",
    is_published: a.is_published,
  }));
}

/**
 * 사이트맵용 매장 목록 — 최소 컬럼만(5천여 건이라 COLS 전체를 끌면 낭비).
 * 노출 기준은 발견(discoverBase)과 동일: 영업중 + 검수 통과 + slug 존재.
 * PostgREST 는 1,000행에서 자르므로 range 로 끝까지 훑는다.
 */
export async function getSitemapSaunas(): Promise<
  { sido: string; slug: string; updated_at: string | null }[]
> {
  const out: { sido: string; slug: string; updated_at: string | null }[] = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabasePublic
      .from("saunas")
      .select("sido, slug, updated_at")
      .eq("status", OPERATING)
      .eq("needs_review", false)
      .not("slug", "is", null)
      .order("id")
      .range(from, from + PAGE - 1);
    if (error) throw error;
    const rows = (data ?? []) as any[];
    for (const r of rows) {
      if (!r.slug || !r.sido) continue;
      out.push({ sido: r.sido, slug: r.slug, updated_at: r.updated_at ?? null });
    }
    if (rows.length < PAGE) break;
  }
  return out;
}

/** 사이트맵용 아티클 목록 — slug + 발행일만. */
export async function getSitemapArticles(): Promise<
  { slug: string; published_at: string | null }[]
> {
  const { data, error } = await supabasePublic
    .from("articles")
    .select("slug, published_at")
    .eq("is_published", true)
    .not("slug", "is", null)
    .order("published_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as any[])
    .filter((a) => a.slug)
    .map((a) => ({ slug: a.slug, published_at: a.published_at ?? null }));
}

export async function getArticleBySlug(slug: string): Promise<Article | null> {
  const { data, error } = await supabasePublic
    .from("articles")
    .select(
      "id, title, summary, body, thumbnail_url, category, slug, published_at, is_published",
    )
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id,
    title: data.title,
    summary: data.summary ?? "",
    body: data.body ?? "",
    thumbnail_url: data.thumbnail_url ?? null,
    category: data.category,
    slug: data.slug ?? "",
    published_at: data.published_at ?? "",
    is_published: data.is_published,
  };
}
