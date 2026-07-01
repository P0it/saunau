/**
 * 인증용 서버 Supabase 클라이언트 — 서버 컴포넌트·라우트 핸들러 전용.
 * `next/headers`의 쿠키로 세션을 읽고, 가능한 경우 갱신 쿠키를 기록.
 * (서버 컴포넌트에서는 쿠키 쓰기가 불가하므로 try/catch — 실제 갱신은 미들웨어가 담당.)
 */
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anon) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 환경변수가 필요합니다.",
  );
}

/** 서버 환경의 인증 클라이언트. 요청별로 호출(쿠키 스토어를 캡처). */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(url!, anon!, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // 서버 컴포넌트에서 호출된 경우 set 불가 — 무시(미들웨어가 세션 갱신 담당).
        }
      },
    },
  });
}
