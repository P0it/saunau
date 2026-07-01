import { NextResponse, type NextRequest } from "next/server";
import sharp from "sharp";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { isAdminEmail } from "@/lib/admin";
import { getContentPolicy } from "@/lib/config/contentPolicy";
import { moderateImage } from "@/lib/moderation";
import type { SaunaPhoto } from "@/lib/data/types";

export const runtime = "nodejs"; // 모더레이션·service_role·바이트 처리·sharp(Edge 불가)
export const dynamic = "force-dynamic";

const MAX_BYTES = 12 * 1024 * 1024; // 업로드 원본 상한 12MB(압축 전 요청 방어). 저장은 리사이즈 후.
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const DAILY_LIMIT = 10; // 1인 1일 업로드 상한(레이트리밋)
const REVIEW_PHOTO_LIMIT = 5; // 후기 1개당 첨부 사진 상한
const MAX_EDGE = 1600; // 저장 시 긴 변 최대 픽셀
const WEBP_QUALITY = 80; // 저장 WebP 품질

function fail(reason: string, status: number) {
  return NextResponse.json({ ok: false, reason }, { status });
}

/**
 * 저장 전 정규화: EXIF 회전 반영 → 긴 변 MAX_EDGE 로 축소(확대 금지) → WebP 재인코딩.
 * 원본 무압축 저장을 막아 Storage 용량·egress 를 크게 줄인다. 실패(손상 등)면 null.
 */
async function processImage(
  input: Uint8Array,
): Promise<{ bytes: Buffer; width: number; height: number } | null> {
  try {
    const out = await sharp(input)
      .rotate() // EXIF orientation 반영 후 메타 제거
      .resize(MAX_EDGE, MAX_EDGE, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY })
      .toBuffer({ resolveWithObject: true });
    return {
      bytes: out.data,
      width: out.info.width,
      height: out.info.height,
    };
  } catch {
    return null;
  }
}

/**
 * 사용자 사진 업로드 — 로그인 → 킬스위치 → 레이트리밋 → 검증 → 모더레이션 → 게시.
 * 모더레이션 통과분만 service_role 로 Storage 업로드 + sauna_photos insert(즉시 게시).
 * POST /api/photos  (multipart: sauna_id, file)
 */
export async function POST(req: NextRequest) {
  // 1) 인증(로그인 유저만)
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("unauthorized", 401);
  const admin_user = isAdminEmail(user.email); // 관리자는 공식 사진으로 즉시 게시(검수·한도 면제)

  // 2) 킬스위치(이미지 전역 OFF면 업로드도 차단)
  const { images } = await getContentPolicy();
  if (!images.show) return fail("uploads_disabled", 403);

  // 3) 입력 파싱
  const form = await req.formData().catch(() => null);
  if (!form) return fail("bad_request", 400);
  const saunaId = form.get("sauna_id");
  const file = form.get("file");
  const reviewIdRaw = form.get("review_id");
  if (typeof saunaId !== "string" || !(file instanceof File)) {
    return fail("bad_request", 400);
  }
  // review_id 가 오면 후기 첨부 사진(후기 카드 전용). 문자열 아니면 갤러리 사진.
  const reviewId =
    typeof reviewIdRaw === "string" && reviewIdRaw.length > 0
      ? reviewIdRaw
      : null;

  // 4) 검증(타입·크기)
  if (!ALLOWED_MIME.has(file.type)) return fail("unsupported_type", 415);
  if (file.size > MAX_BYTES) return fail("too_large", 413);
  if (file.size === 0) return fail("empty_file", 400);

  const admin = getAdminClient();

  // 5) 레이트리밋 — 최근 24h 본인 업로드 수(관리자는 면제)
  if (!admin_user) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count } = await admin
      .from("sauna_photos")
      .select("id", { count: "exact", head: true })
      .eq("uploaded_by", user.id)
      .gte("created_at", since);
    if ((count ?? 0) >= DAILY_LIMIT) return fail("rate_limited", 429);
  }

  // 6) 매장 존재 확인(잘못된 sauna_id 로 고아 행 방지)
  const { data: sauna } = await admin
    .from("saunas")
    .select("id")
    .eq("id", saunaId)
    .maybeSingle();
  if (!sauna) return fail("sauna_not_found", 404);

  // 6b) 후기 첨부라면: 대상 후기가 본인 것 + 해당 매장이어야 하고, 장수 상한을 지킨다.
  if (reviewId) {
    const { data: review } = await admin
      .from("sauna_reviews")
      .select("id, user_id, sauna_id")
      .eq("id", reviewId)
      .maybeSingle();
    if (!review || review.user_id !== user.id || review.sauna_id !== saunaId) {
      return fail("review_not_found", 404);
    }
    const { count } = await admin
      .from("sauna_photos")
      .select("id", { count: "exact", head: true })
      .eq("review_id", reviewId)
      .eq("is_active", true);
    if ((count ?? 0) >= REVIEW_PHOTO_LIMIT) {
      return fail("review_photo_limit", 429);
    }
  }

  // 7) 정규화(리사이즈+WebP) — 원본 무압축 저장 금지. 저장·모더레이션 모두 압축본 기준.
  const original = new Uint8Array(await file.arrayBuffer());
  const processed = await processImage(original);
  if (!processed) return fail("unsupported_type", 415); // 손상/디코드 불가

  // 8) 모더레이션(게시 이전) — 관리자 업로드는 신뢰하므로 면제(Vision 키 불필요)
  if (!admin_user) {
    const verdict = await moderateImage(processed.bytes);
    if (!verdict.ok) return fail(verdict.reason ?? "rejected", 422);
  }

  // 9) Storage 업로드(service_role — RLS 우회). 항상 WebP 로 저장.
  const path = `user/${saunaId}/${crypto.randomUUID()}.webp`;
  const { error: upErr } = await admin.storage
    .from("sauna-photos")
    .upload(path, processed.bytes, {
      contentType: "image/webp",
      upsert: false,
    });
  if (upErr) return fail("storage_failed", 500);

  const {
    data: { publicUrl },
  } = admin.storage.from("sauna-photos").getPublicUrl(path);

  // 10) 게시(sauna_photos insert)
  //    후기 첨부=source 'user'(작성자 본인 삭제 가능) + review_id 지정(갤러리엔 안 뜸).
  //    갤러리: 관리자=공식 사진(source 'editor', 앞쪽 정렬) / 일반=사용자 사진(맨 뒤로).
  const { data: row, error: insErr } = await admin
    .from("sauna_photos")
    .insert({
      sauna_id: saunaId,
      storage_path: path,
      url: publicUrl,
      source: reviewId ? "user" : admin_user ? "editor" : "user",
      uploaded_by: user.id,
      review_id: reviewId,
      width: processed.width,
      height: processed.height,
      is_active: true,
      moderation_status: "approved",
      sort_order: !reviewId && admin_user ? 0 : 1000,
    })
    .select("id, url, width, height")
    .single();
  if (insErr || !row) {
    // 롤백: 방금 올린 객체 정리(베스트 에포트).
    await admin.storage.from("sauna-photos").remove([path]);
    return fail("insert_failed", 500);
  }

  const photo: SaunaPhoto = {
    id: row.id,
    url: row.url,
    width: row.width ?? null,
    height: row.height ?? null,
  };
  return NextResponse.json({ ok: true, photo });
}
