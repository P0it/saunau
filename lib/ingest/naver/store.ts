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
import type { NaverPhoto, NaverBlogPost } from "./types";

const BUCKET = "sauna-photos";

function extFromContentType(ct: string | null): string {
  if (!ct) return "jpg";
  if (/png/i.test(ct)) return "png";
  if (/webp/i.test(ct)) return "webp";
  return "jpg";
}

export interface StoredPhoto {
  storagePath: string;
  url: string; // 우리 Storage 공개 URL
  sourceUrl: string; // 서버 전용
}

/**
 * 원본 사진 1장을 다운로드해 우리 Storage 에 업로드. 실패 시 null(행 생성 안 함).
 */
export async function downloadToStorage(
  supabase: SupabaseClient,
  saunaId: string,
  key: string | number,
  photo: NaverPhoto,
): Promise<StoredPhoto | null> {
  try {
    const res = await fetch(photo.sourceUrl, {
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type");
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.byteLength === 0) return null;

    const ext = extFromContentType(ct);
    const storagePath = `${saunaId}/${key}.${ext}`;
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, buf, {
        contentType: ct ?? "image/jpeg",
        upsert: true,
      });
    if (error) return null;

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
    if (!data?.publicUrl) return null;
    return { storagePath, url: data.publicUrl, sourceUrl: photo.sourceUrl };
  } catch {
    return null;
  }
}

/** sauna_photos 에 크롤 사진 적재(업로드 성공분만). 기존 크롤분은 교체 위해 먼저 비활성화. */
export async function saveCrawledPhotos(
  supabase: SupabaseClient,
  saunaId: string,
  stored: StoredPhoto[],
): Promise<number> {
  if (!stored.length) return 0;
  const rows = stored.map((s, i) => ({
    sauna_id: saunaId,
    storage_path: s.storagePath,
    url: s.url,
    source: "naver_crawl",
    source_url: s.sourceUrl, // 서버 전용
    sort_order: i,
    is_active: true,
  }));
  const { error } = await supabase.from("sauna_photos").insert(rows);
  if (error) throw new Error(`sauna_photos insert 실패(${saunaId}): ${error.message}`);
  return rows.length;
}

/** 우리 자산(owner/editor/licensed/google)이 아니면 대표 썸네일을 크롤값으로 세팅. */
export async function setRepresentativeThumb(
  supabase: SupabaseClient,
  saunaId: string,
  url: string,
): Promise<void> {
  const { data, error } = await supabase
    .from("saunas")
    .select("thumbnail_source")
    .eq("id", saunaId)
    .maybeSingle();
  if (error) throw new Error(`thumb 조회 실패(${saunaId}): ${error.message}`);

  const current = data?.thumbnail_source as string | null | undefined;
  const protectedSources = ["owner", "editor", "licensed", "google"];
  if (current && protectedSources.includes(current)) return; // 우리 자산 보존

  const { error: upErr } = await supabase
    .from("saunas")
    .update({ thumbnail_url: url, thumbnail_source: "naver_crawl" })
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
