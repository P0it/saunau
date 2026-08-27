import { NextResponse, type NextRequest } from "next/server";
import sharp from "sharp";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { isAdminEmail } from "@/lib/admin";
import type { SaunaPhoto } from "@/lib/data/types";

export const runtime = "nodejs"; // service_role·바이트 처리·sharp(Edge 불가)
export const dynamic = "force-dynamic";

const MAX_BYTES = 12 * 1024 * 1024; // 업로드 원본 상한 12MB(압축 전 요청 방어). 저장은 리사이즈 후.
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
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
 * 매장 사진 등록 — **운영자(ADMIN_EMAILS) 전용**.
 *
 * ⚠ 일반 회원 업로드는 의도적으로 닫아두었다. 사우나와 무관한 사진·중복·저화질이
 *   섞이면 갤러리 신뢰도가 무너지고(데이터 오염) 되돌리는 비용이 크다.
 *   같은 이유로 후기 첨부 사진 기능도 없앴다(review_id 를 받지 않는다).
 *   되살릴 때 필요한 것: 로그인 게이트 · 1일 업로드 상한 · 게시 전 모더레이션
 *   (`lib/moderation` 이 fail-closed 로 남아 있다) · 신고 처리 창구.
 *
 * POST /api/photos  (multipart: sauna_id, file)
 */
export async function POST(req: NextRequest) {
  // 1) 인증 + 권한 — 운영자만. 클라 표시와 무관하게 여기서 최종 강제한다.
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("unauthorized", 401);
  if (!isAdminEmail(user.email)) return fail("forbidden", 403);

  // 2) 입력 파싱
  const form = await req.formData().catch(() => null);
  if (!form) return fail("bad_request", 400);
  const saunaId = form.get("sauna_id");
  const file = form.get("file");
  if (typeof saunaId !== "string" || !(file instanceof File)) {
    return fail("bad_request", 400);
  }

  // 3) 검증(타입·크기)
  if (!ALLOWED_MIME.has(file.type)) return fail("unsupported_type", 415);
  if (file.size > MAX_BYTES) return fail("too_large", 413);
  if (file.size === 0) return fail("empty_file", 400);

  const admin = getAdminClient();

  // 4) 매장 존재 확인(잘못된 sauna_id 로 고아 행 방지)
  const { data: sauna } = await admin
    .from("saunas")
    .select("id")
    .eq("id", saunaId)
    .maybeSingle();
  if (!sauna) return fail("sauna_not_found", 404);

  // 5) 정규화(리사이즈+WebP) — 원본 무압축 저장 금지.
  const original = new Uint8Array(await file.arrayBuffer());
  const processed = await processImage(original);
  if (!processed) return fail("unsupported_type", 415); // 손상/디코드 불가

  // 6) Storage 업로드(service_role — RLS 우회). 항상 WebP 로 저장.
  const path = `editor/${saunaId}/${crypto.randomUUID()}.webp`;
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

  // 7) 게시 — 운영자 사진은 공식 사진(source 'editor')으로 갤러리 앞쪽에 둔다.
  const { data: row, error: insErr } = await admin
    .from("sauna_photos")
    .insert({
      sauna_id: saunaId,
      storage_path: path,
      url: publicUrl,
      source: "editor",
      uploaded_by: user.id,
      width: processed.width,
      height: processed.height,
      is_active: true,
      moderation_status: "approved",
      sort_order: 0,
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
