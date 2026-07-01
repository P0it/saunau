/**
 * 관리자(admin) 식별 — 서버 전용. 환경변수 `ADMIN_EMAILS`(쉼표구분 허용목록)와
 * 로그인 세션의 이메일을 대조한다. DB에 권한 컬럼을 두지 않으므로 권한 상승 경로가 없다.
 *
 * ⚠ ADMIN_EMAILS 는 NEXT_PUBLIC_ 접두사를 쓰지 않는다 → 클라이언트 번들/응답에 목록이 노출되지 않음.
 *   클라이언트는 GET /api/admin/me 로 "내가 admin 인가"(boolean)만 받는다.
 */
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** ADMIN_EMAILS 파싱 — 소문자·trim 정규화한 Set. 미설정 시 빈 Set(=관리자 없음). */
function adminEmailSet(): Set<string> {
  const raw = process.env.ADMIN_EMAILS ?? "";
  return new Set(
    raw
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

/** 이메일이 관리자 허용목록에 있는지. */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return adminEmailSet().has(email.trim().toLowerCase());
}

/**
 * 현재 요청 세션이 관리자면 user, 아니면 null.
 * 라우트 핸들러에서 게이트로 사용(클라 표시와 무관하게 서버에서 최종 강제).
 */
export async function getAdminUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isAdminEmail(user.email)) return null;
  return user;
}
