"use client";

import { useEffect } from "react";
import Link from "next/link";
import { SteamMark } from "@/components/illustrations";

/**
 * 라우트 에러 경계 — Supabase 일시 장애·쿼리 실패 등으로 서버 렌더가 던졌을 때.
 * Next 기본 에러 화면 대신 앱 톤을 유지하고, reset() 으로 재시도 경로를 준다.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // 서버 로그(Vercel)에는 이미 남는다. 브라우저에서도 원인 추적이 가능하도록 남긴다.
    console.error("[route error]", error);
  }, [error]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-[20px] py-[40px] text-center">
      <div className="flex h-[84px] w-[84px] items-center justify-center rounded-full bg-[#F4F2EF]">
        <SteamMark size={42} />
      </div>
      <p className="mt-[18px] text-[15px] font-semibold text-ink">
        잠시 문제가 생겼어요
      </p>
      <p className="mt-[6px] text-[13px] text-muted">
        잠깐 뒤에 다시 시도하면 대개 풀려요
      </p>
      <div className="mt-[20px] flex items-center gap-[10px]">
        <button
          type="button"
          onClick={reset}
          className="rounded-full bg-brand px-[20px] py-[11px] text-[14px] font-semibold text-white"
        >
          다시 시도
        </button>
        <Link
          href="/"
          className="rounded-full border border-line bg-card px-[20px] py-[11px] text-[14px] font-semibold text-ink"
        >
          홈으로
        </Link>
      </div>
      {error.digest && (
        <p className="mt-[16px] text-[11px] text-muted">오류 코드 {error.digest}</p>
      )}
    </div>
  );
}
