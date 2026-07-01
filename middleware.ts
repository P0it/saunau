/**
 * 세션 갱신 미들웨어 — 매 요청마다 Supabase 세션 토큰을 갱신해 로그인을 유지.
 * 라우트 보호는 하지 않는다(둘러보기·검색·지도·상세·마이페이지 모두 익명 접근 허용).
 * @supabase/ssr 표준 패턴: 요청/응답 쿠키를 동기화하고 getUser()로 토큰을 리프레시.
 */
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  // env 누락 시 인증 없이 통과(앱의 익명 동작은 계속 유지).
  if (!url || !anon) return response;

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // 세션 토큰 갱신(쿠키에 반영). 반환값은 사용하지 않음.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  // 정적 자원·이미지·favicon 제외. 그 외 모든 경로에서 세션 갱신.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
