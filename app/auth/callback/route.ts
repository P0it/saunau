/**
 * OAuth·매직링크 콜백 — Supabase가 보낸 PKCE 코드를 세션으로 교환한다.
 * 카카오·구글은 동의 후 이 라우트로 돌아오고, 이메일 링크는 Supabase verify
 * 엔드포인트를 거쳐 `?code=...`로 도달한다.
 *
 * 교환에 성공하면 가입 절차 완료 여부를 보고 목적지를 정한다 —
 * 아직이면 /welcome(약관 동의+닉네임), 끝났으면 원래 가려던 곳.
 */
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * 돌아갈 경로는 우리 앱 내부여야 한다 — "//evil.com" 같은 프로토콜 상대 URL 이나
 * 절대 URL 이 들어오면 무시하고 기본값으로 돌린다(오픈 리다이렉트 차단).
 */
function safeNext(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/my";
  return raw;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const { data } = await supabase.auth.getUser();
      const userId = data.user?.id;
      if (userId) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("onboarded_at")
          .eq("id", userId)
          .maybeSingle();
        if (!profile?.onboarded_at) {
          return NextResponse.redirect(`${origin}/welcome`);
        }
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // 코드 누락·만료 등 실패 시 안내 파라미터와 함께 마이페이지로.
  return NextResponse.redirect(`${origin}/my?auth_error=1`);
}
