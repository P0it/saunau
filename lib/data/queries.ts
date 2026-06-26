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
  ContentPolicy,
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
  "phone, open_date, created_at, is_jjimjilbang, is_hot_spring, is_24h, has_outdoor, " +
  "sauna_room_temp, cold_bath_temp, has_sesin, sauna_kind, price, hours, thumbnail_url, " +
  "thumbnail_source, editor_note, slug";

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
    is_24h: !!r.is_24h,
    has_outdoor: !!r.has_outdoor,
    sauna_room_temp: r.sauna_room_temp ?? null,
    cold_bath_temp: r.cold_bath_temp ?? null,
    has_sesin: !!r.has_sesin,
    sauna_kind: r.sauna_kind ?? [],
    price: r.price ?? null,
    hours: r.hours ?? null,
    // 정책 적용: 표시 불가면 null. 항상 우리 Storage URL 만(원본URL은 select 안 함).
    thumbnail_url: resolvePhotoUrl(r.thumbnail_url, r.thumbnail_source, images),
    editor_note: r.editor_note ?? null,
    slug: r.slug ?? "",
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
  if (cat === "hot_spring") q = q.eq("is_hot_spring", true);
  else if (cat === "jjimjilbang") q = q.eq("is_jjimjilbang", true);
  else q = q.eq("is_hot_spring", false).eq("is_jjimjilbang", false); // 순수 대중탕
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
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? [])
    .filter((r: any) => images.allowedSources.includes(r.source))
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
