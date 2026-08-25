import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 회원 탈퇴 — 본인 계정만. POST /api/account/delete → { ok: true }
 *
 * 세션에서 확인한 uid 로만 삭제한다(요청 본문의 id는 받지 않는다).
 * auth.users 행이 지워지면 profiles·sauna_favorites·sauna_reviews·sauna_memos 가
 * FK on delete cascade 로 함께 정리된다. 삭제는 service_role 로만 가능.
 *
 * 개인정보처리방침에 "탈퇴 시 즉시 파기"를 명시했으므로 실제로 동작해야 한다.
 */
export async function POST() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  const userId = data.user?.id;
  if (error || !userId) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const admin = getAdminClient();
  const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
  if (deleteError) {
    return NextResponse.json(
      { error: "탈퇴 처리에 실패했습니다." },
      { status: 500 },
    );
  }

  // 남아 있는 세션 쿠키 정리 — 삭제된 유저의 토큰으로 요청이 이어지지 않도록.
  await supabase.auth.signOut();

  return NextResponse.json({ ok: true });
}
