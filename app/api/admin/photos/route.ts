import { NextResponse, type NextRequest } from "next/server";
import { getAdminUser } from "@/lib/admin";
import { getAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs"; // service_role(RLS 우회)
export const dynamic = "force-dynamic";

/**
 * 관리자 사진 관리 — 잘못 올라간 사진을 숨김(soft delete). 출처 무관(user/editor/크롤 등 전부).
 * 소프트 숨김(is_active=false)이라 갤러리에서 즉시 사라지고, 필요 시 DB에서 되돌릴 수 있다.
 * 권한은 서버에서 ADMIN_EMAILS 로 최종 강제(클라 표시 여부와 무관).
 * POST /api/admin/photos  { photoId: string, action: "hide" | "restore" }
 */
export async function POST(req: NextRequest) {
  const user = await getAdminUser();
  if (!user) {
    return NextResponse.json({ ok: false, reason: "forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const photoId = body?.photoId;
  const action = body?.action ?? "hide";
  if (typeof photoId !== "string" || (action !== "hide" && action !== "restore")) {
    return NextResponse.json({ ok: false, reason: "bad_request" }, { status: 400 });
  }

  const admin = getAdminClient();
  const { data, error } = await admin
    .from("sauna_photos")
    .update({ is_active: action === "restore" })
    .eq("id", photoId)
    .select("id")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ ok: false, reason: "update_failed" }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ ok: false, reason: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
