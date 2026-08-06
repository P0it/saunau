/**
 * 수집 결과 저장 — 사진 재호스팅 + DB 적재.
 *
 * 무흔적 불변식:
 *  - 사진은 **다운로드 → 우리 Storage 업로드 성공분만** sauna_photos 행 생성.
 *    실패하면 그 사진은 버린다(외부 URL 을 row 에 남기지 않음 = saunaday 핫링크 사고 차단).
 *  - source_url(원본)은 DB(서버 전용)에만. 앱 쿼리는 이 컬럼을 select 하지 않는다.
 *  - 대표 썸네일은 우리 자산(owner/editor/licensed/google)을 크롤이 덮어쓰지 않는다.
 */
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import sharp from "sharp";
import type { NaverBlogPost } from "./types";

const BUCKET = "sauna-photos";

/**
 * 블로그 썸네일의 Storage 키 — **글 URL 로부터 결정**된다.
 *
 * 예전엔 `blog-${크롤 시점 배열 인덱스}` 를 썼는데, 재크롤에서 글 순서가 바뀌면
 * 같은 경로에 다른 글의 이미지가 덮여 예전 행이 엉뚱한 썸네일을 가리키게 된다.
 * URL 해시로 키를 잡으면 글↔객체가 1:1 로 고정돼 그 사고가 원천 차단되고,
 * 재크롤이 같은 글을 다시 만나도 같은 경로를 덮어쓰므로 잔재도 안 쌓인다.
 */
export function blogThumbKey(blogUrl: string): string {
  const h = createHash("sha1").update(blogUrl).digest("hex").slice(0, 12);
  return `blog-${h}`;
}

/** 사진 출처 우선순위(높을수록 보존). 대표 썸네일 교체 판단에 쓴다. */
export type PhotoSourceKind =
  | "naver_crawl"
  | "website"
  | "google"
  | "licensed"
  | "editor"
  | "owner";
const SOURCE_PRIORITY: Record<string, number> = {
  // 구글은 업주가 올린 사진인지 알 방법이 없다(authorAttributions 는 올린 계정 표시명뿐).
  // 네이버는 mediaSource="business" 로 업체제공을 구분해 주므로 naver_crawl 이 더 신뢰된다.
  // 또 국내 업소는 네이버 쪽 자료가 더 많고 정확하다 → 구글은 네이버가 없을 때의 폴백.
  google: 1,
  naver_crawl: 2, // 네이버 업체제공 사진(mediaSource="business")
  website: 2, // 업체 공식 사이트(권리자 본인 자산)
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

/**
 * 저장 프로필 — **표시 크기에 맞춰** 재인코딩한다. 하나로 뭉뚱그리면 안 된다.
 *
 *  gallery: 상세 갤러리 표시 최대폭 ~430px → 720px(레티나 충분).
 *  thumb  : 블로그 후기 썸네일은 64×64 로만 렌더된다(components/sauna/BlogReviews.tsx).
 *           과거 이걸 gallery 와 같은 720px 로 저장해 버킷의 93%(1.1GB)를 잡아먹었다.
 *           160px = 64px 의 2.5배로 레티나에 충분하고 장당 ~4KB 에 든다.
 */
export type SizeProfile = "gallery" | "thumb";

const PROFILES: Record<SizeProfile, { width: number; quality: number }> = {
  gallery: { width: 720, quality: 72 },
  thumb: { width: 160, quality: 70 },
};

interface Optimized {
  buf: Uint8Array;
  width: number;
  height: number;
}

/** SVG 텍스트에 그대로 넣을 수 없는 문자 이스케이프. */
function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * 출처 워터마크 오버레이(우하단). 사진 자체에 출처를 박아 어디로 퍼가도 출처가 붙어 있게 한다.
 *
 * 이미지 폭에 비례해 크기를 잡되(2.6%) 8~13px 로 묶는다 — 갤러리 720px 에서 ~13px,
 * 썸네일 160px 에서 ~8px. 밝은 사진에서도 읽히도록 반투명 먹색 알약 위에 흰 글씨를 얹는다.
 */
function watermarkSvg(w: number, h: number, text: string): Buffer {
  const fs = Math.max(8, Math.min(13, Math.round(w * 0.026)));
  const padX = Math.round(fs * 0.55);
  const padY = Math.round(fs * 0.34);
  const margin = Math.round(fs * 0.6);
  // 한글 폭은 대략 글자크기와 같고 영문·숫자는 그 절반으로 잡아 배경 알약 폭을 추정한다.
  const est = [...text].reduce((n, ch) => n + (/[\x00-\x7F]/.test(ch) ? 0.52 : 1), 0);
  const boxW = Math.round(est * fs + padX * 2);
  const boxH = fs + padY * 2;
  const x = w - boxW - margin;
  const y = h - boxH - margin;
  return Buffer.from(
    `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">` +
      `<rect x="${x}" y="${y}" width="${boxW}" height="${boxH}" rx="${Math.round(boxH / 2)}" fill="#000" fill-opacity="0.42"/>` +
      `<text x="${x + boxW / 2}" y="${y + boxH / 2}" font-family="Malgun Gothic, Apple SD Gothic Neo, Noto Sans KR, sans-serif"` +
      ` font-size="${fs}" fill="#fff" fill-opacity="0.94" text-anchor="middle" dominant-baseline="central">${escapeXml(text)}</text>` +
      `</svg>`,
  );
}

/**
 * 원본 바이트 → WebP 재인코딩(+ 프로필별 폭 상한, EXIF 회전 보정).
 * 읽기 불가/손상 이미지는 null → 그 사진은 버린다(행 생성 안 함).
 *
 * watermark 를 주면 우하단에 출처를 합성한다(예: "출처 네이버 플레이스").
 */
export async function optimizeImage(
  input: Uint8Array,
  profile: SizeProfile = "gallery",
  watermark?: string | null,
): Promise<Optimized | null> {
  const { width, quality } = PROFILES[profile];
  try {
    const base = sharp(input, { failOn: "none" })
      .rotate() // EXIF orientation 반영 후 메타 제거
      .resize({ width, withoutEnlargement: true });

    let pipeline = base;
    // thumb(160px)은 64px 로 렌더돼 워터마크가 읽히지도 않으면서 화면을 다 잡아먹는다 → 생략.
    if (watermark && profile !== "thumb") {
      // 합성엔 실제 렌더 크기가 필요 → 리사이즈까지 끝낸 버퍼를 먼저 만든다.
      const resized = await base.toBuffer({ resolveWithObject: true });
      pipeline = sharp(resized.data).composite([
        { input: watermarkSvg(resized.info.width, resized.info.height, watermark), top: 0, left: 0 },
      ]);
    }

    const out = await pipeline.webp({ quality }).toBuffer({ resolveWithObject: true });
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
 * profile 로 표시 크기에 맞는 저장 규격을 고른다(블로그 썸네일은 반드시 "thumb").
 * watermark 를 주면 우하단에 출처를 박아 넣는다.
 */
export async function downloadToStorage(
  supabase: SupabaseClient,
  saunaId: string,
  key: string | number,
  photo: PhotoRef,
  profile: SizeProfile = "gallery",
  watermark?: string | null,
): Promise<StoredPhoto | null> {
  try {
    const res = await fetch(photo.fetchUrl ?? photo.sourceUrl, {
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    if (!res.ok) return null;
    const raw = new Uint8Array(await res.arrayBuffer());
    if (raw.byteLength === 0) return null;

    const opt = await optimizeImage(raw, profile, watermark);
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

/**
 * 블로그 후기 upsert(sauna_id, blog_url 유니크).
 *
 * 썸네일 없는 글은 **thumb_url 을 payload 에서 아예 뺀다.** 한 배열에 섞어 upsert 하면
 * PostgREST 가 키를 합집합으로 맞추면서 null 이 들어가, 재크롤에서 og:image 수집이
 * 한 번 실패했을 뿐인데 **멀쩡하던 썸네일이 지워진다**(실제로 218행이 이렇게 비었다).
 * 컬럼을 빼면 ON CONFLICT DO UPDATE 대상에서 제외돼 기존 값이 보존된다.
 */
export async function saveBlogReviews(
  supabase: SupabaseClient,
  saunaId: string,
  posts: NaverBlogPost[],
): Promise<number> {
  if (!posts.length) return 0;
  const base = (p: NaverBlogPost) => ({
    sauna_id: saunaId,
    title: p.title,
    snippet: p.snippet,
    blog_url: p.blogUrl,
    blogger_name: p.bloggerName,
    posted_at: p.postedAt,
    source: "naver_blog",
    is_active: true,
  });

  // og:image 를 우리 Storage 로 재호스팅한 URL 이 있는 것만 thumb_url 을 싣는다(외부 핫링크 금지).
  const withThumb = posts
    .filter((p) => p.thumbUrl)
    .map((p) => ({ ...base(p), thumb_url: p.thumbUrl }));
  const withoutThumb = posts.filter((p) => !p.thumbUrl).map(base);

  for (const rows of [withThumb, withoutThumb]) {
    if (!rows.length) continue;
    const { error } = await supabase
      .from("sauna_blog_reviews")
      .upsert(rows, {
        onConflict: "sauna_id,blog_url",
        ignoreDuplicates: false,
      });
    if (error)
      throw new Error(
        `sauna_blog_reviews upsert 실패(${saunaId}): ${error.message}`,
      );
  }
  return posts.length;
}
