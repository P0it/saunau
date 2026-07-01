/**
 * 인증용 브라우저 Supabase 클라이언트 — 클라이언트 컴포넌트의 로그인/세션 전용.
 * 쿠키 기반 세션(@supabase/ssr)으로 새로고침·재방문 시 로그인 유지.
 * 읽기 전용 익명 조회는 기존 `public.ts`(supabasePublic)를 계속 사용.
 */
"use client";

import { createBrowserClient } from "@supabase/ssr";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anon) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 환경변수가 필요합니다.",
  );
}

let client: ReturnType<typeof createBrowserClient> | undefined;

/** 브라우저 환경의 인증 클라이언트(싱글턴). 클라이언트 컴포넌트에서만 호출. */
export function createSupabaseBrowserClient() {
  if (!client) client = createBrowserClient(url!, anon!);
  return client;
}
