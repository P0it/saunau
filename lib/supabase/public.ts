/**
 * 공개(anon) Supabase 클라이언트 — 읽기 전용. 서버 컴포넌트·클라이언트 양쪽에서 사용.
 * RLS(saunas/hot_springs read: using(true))로 익명 읽기 허용. 쓰기는 service_role(admin)만.
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anon) {
  // 빌드/런타임에서 누락 시 명확히 알림(클라이언트 번들엔 NEXT_PUBLIC_* 인라인됨).
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 환경변수가 필요합니다.",
  );
}

export const supabasePublic = createClient(url, anon, {
  auth: { persistSession: false, autoRefreshToken: false },
});
