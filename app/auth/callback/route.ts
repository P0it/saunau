/**
 * 매직링크 콜백 — Supabase가 보낸 PKCE 코드를 세션으로 교환하고 마이페이지로 리다이렉트.
 * 이메일의 링크는 Supabase verify 엔드포인트를 거쳐 `?code=...`로 이 라우트에 도달한다.
 */
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/my";

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // 코드 누락·만료 등 실패 시 안내 파라미터와 함께 마이페이지로.
  return NextResponse.redirect(`${origin}/my?auth_error=1`);
}
