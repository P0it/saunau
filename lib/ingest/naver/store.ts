/**
 * 수집 결과 저장 — 사진 재호스팅 + DB 적재.
 *
 * 무흔적 불변식:
 *  - 사진은 **다운로드 → 우리 Storage 업로드 성공분만** sauna_photos 행 생성.
 *    실패하면 그 사진은 버린다(외부 URL 을 row 에 남기지 않음 = saunaday 핫링크 사고 차단).
 *  - source_url(원본)은 DB(서버 전용)에만. 앱 쿼리는 이 컬럼을 select 하지 않는다.
 *  - 대표 썸네일은 우리 자산(owner/editor/licensed/google)을 크롤이 덮어쓰지 않는다.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import sharp from "sharp";
import type { NaverBlogPost } from "./types";

const BUCKET = "sauna-photos";

/** 사진 출처 우선순위(높을수록 보존). 대표 썸네일 교체 판단에 쓴다. */
export type PhotoSourceKind =
  | "naver_crawl"
  | "website"
  | "google"
  | "licensed"
  | "editor"
  | "owner";
const SOURCE_PRIORITY: Record<string, number> = {
  naver_crawl: 1,
  website: 2, // 업체 공식 사이트(권리자 본인 자산) — google/blog 보다 신뢰
  google: 2,
  licensed: 2,
  editor: 3,
  owner: 4,
};

/**
 * 다운로드 대상 1장. sourceUrl=DB에 남길 출처(서버 전용, 키 미포함),
 * fetchUrl=실제로 받을 URL(없으면 sourceUrl). Google 미디어 URL은 API키가 들어가므로
 * fetchUrl 로만 쓰고 DB(sourceUrl)엔 키 없는 리소스 이름을 남긴다.
 */
export interface PhotoRef {
  sourceUrl: string;
  fetchUrl?: string;
}

// 저장 용량 최적화: 갤러리 표시 최대폭 ~430px, 블로그 썸네일 64px 라
// 720px(레티나 충분) 상한 + WebP 로 재인코딩한다. 원본(수 MB)을 그대로 두지 않는다.
const MAX_WIDTH = 720;
const WEBP_QUALITY = 72;

interface Optimized {
  buf: Uint8Array;
  width: number;
  height: number;
}

/**
 * 원본 바이트 → WebP 재인코딩(+ 720px 상한, EXIF 회전 보정).
 * 읽기 불가/손상 이미지는 null → 그 사진은 버린다(행 생성 안 함).
 */
async function optimizeImage(input: Uint8Array): Promise<Optimized | null> {
  try {
    const out = await sharp(input, { failOn: "none" })
      .rotate() // EXIF orientation 반영 후 메타 제거
      .resize({ width: MAX_WIDTH, withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY })
      .toBuffer({ resolveWithObject: true });
    if (out.data.byteLength === 0) return null;
    return {
      buf: new Uint8Array(out.data),
      width: out.info.width,
      height: out.info.height,
    };
  } catch {
    return null;
  }
}

export interface StoredPhoto {
  storagePath: string;
  url: string; // 우리 Storage 공개 URL
  sourceUrl: string; // 서버 전용
  width: number;
  height: number;
}

/**
 * 원본 사진 1장을 다운로드 → WebP 최적화 → 우리 Storage 에 업로드.
 * 다운로드·디코드·업로드 중 하나라도 실패하면 null(행 생성 안 함).
 */
export async function downloadToStorage(
  supabase: SupabaseClient,
  saunaId: string,
  key: string | number,
  photo: PhotoRef,
): Promise<StoredPhoto | null> {
  try {
    const res = await fetch(photo.fetchUrl ?? photo.sourceUrl, {
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    if (!res.ok) return null;
    const raw = new Uint8Array(await res.arrayBuffer());
    if (raw.byteLength === 0) return null;

    const opt = await optimizeImage(raw);
    if (!opt) return null;

    const storagePath = `${saunaId}/${key}.webp`;
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, opt.buf, {
        contentType: "image/webp",
        upsert: true,
      });
    if (error) return null;

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
    if (!data?.publicUrl) return null;
    return {
      storagePath,
      url: data.publicUrl,
      sourceUrl: photo.sourceUrl,
      width: opt.width,
      height: opt.height,
    };
  } catch {
    return null;
  }
}

/** sauna_photos 에 수집 사진 적재(업로드 성공분만). source 로 출처 구분(naver_crawl/google …). */
export async function saveCrawledPhotos(
  supabase: SupabaseClient,
  saunaId: string,
  stored: StoredPhoto[],
  source: PhotoSourceKind = "naver_crawl",
): Promise<number> {
  if (!stored.length) return 0;
  const rows = stored.map((s, i) => ({
    sauna_id: saunaId,
    storage_path: s.storagePath,
    url: s.url,
    source,
    source_url: s.sourceUrl, // 서버 전용
    width: s.width,
    height: s.height,
    sort_order: i,
    is_active: true,
  }));
  const { error } = await supabase.from("sauna_photos").insert(rows);
  if (error) throw new Error(`sauna_photos insert 실패(${saunaId}): ${error.message}`);
  return rows.length;
}

/**
 * 대표 썸네일 세팅 — 우선순위 기반. 새 source 우선순위가 현재값 이상일 때만 교체.
 * (owner>editor>licensed=google>naver_crawl. 예: google 은 naver_crawl 을 덮지만 owner 는 보존)
 */
export async function setRepresentativeThumb(
  supabase: SupabaseClient,
  saunaId: string,
  url: string,
  source: PhotoSourceKind = "naver_crawl",
): Promise<void> {
  const { data, error } = await supabase
    .from("saunas")
    .select("thumbnail_source")
    .eq("id", saunaId)
    .maybeSingle();
  if (error) throw new Error(`thumb 조회 실패(${saunaId}): ${error.message}`);

  const current = data?.thumbnail_source as string | null | undefined;
  const newPri = SOURCE_PRIORITY[source] ?? 0;
  const curPri = current ? (SOURCE_PRIORITY[current] ?? 0) : 0;
  // 동순위면 먼저 들어온 걸 보존(>=). 더 높은 우선순위만 교체.
  if (current && curPri >= newPri) return;

  const { error: upErr } = await supabase
    .from("saunas")
    .update({ thumbnail_url: url, thumbnail_source: source })
    .eq("id", saunaId);
  if (upErr) throw new Error(`대표 썸네일 세팅 실패(${saunaId}): ${upErr.message}`);
}

/** 블로그 후기 upsert(sauna_id, blog_url 유니크). */
export async function saveBlogReviews(
  supabase: SupabaseClient,
  saunaId: string,
  posts: NaverBlogPost[],
): Promise<number> {
  if (!posts.length) return 0;
  const rows = posts.map((p) => ({
    sauna_id: saunaId,
    title: p.title,
    snippet: p.snippet,
    blog_url: p.blogUrl,
    blogger_name: p.bloggerName,
    // og:image 를 우리 Storage 로 재호스팅한 URL(실패 시 null). 외부 핫링크 금지.
    thumb_url: p.thumbUrl ?? null,
    posted_at: p.postedAt,
    source: "naver_blog",
    is_active: true,
  }));
  const { error } = await supabase
    .from("sauna_blog_reviews")
    .upsert(rows, { onConflict: "sauna_id,blog_url", ignoreDuplicates: false });
  if (error)
    throw new Error(`sauna_blog_reviews upsert 실패(${saunaId}): ${error.message}`);
  return rows.length;
}
