"use client";

import { useEffect, useState } from "react";
import { Wordmark } from "./Wordmark";

/**
 * 앱 첫 로딩 스플래시 — 워드마크가 떠오르고 위로 김(steam)이 피어오른다.
 * AppFrame 최초 마운트 시 1회만 표시(클라이언트 라우팅 전환에는 다시 안 뜸).
 * 표시 → 페이드아웃 → 언마운트.
 */
const HOLD_MS = 1100; // 애니메이션을 보여주는 시간
const FADE_MS = 450; // 페이드아웃 시간

/** 스플래시가 완전히 사라지기까지의 총 시간 — 이후에 떠야 하는 프롬프트류의 지연 기준. */
export const SPLASH_TOTAL_MS = HOLD_MS + FADE_MS;

export function SplashScreen({ fullBleed = false }: { fullBleed?: boolean }) {
  const [phase, setPhase] = useState<"show" | "fade" | "done">("show");

  useEffect(() => {
    const fadeTimer = setTimeout(() => setPhase("fade"), HOLD_MS);
    const doneTimer = setTimeout(() => setPhase("done"), HOLD_MS + FADE_MS);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(doneTimer);
    };
  }, []);

  if (phase === "done") return null;

  return (
    <div
      aria-hidden
      className={
        "fixed inset-y-0 left-1/2 z-[60] flex w-full -translate-x-1/2 flex-col items-center justify-center bg-brand transition-opacity duration-[450ms] ease-out" +
        (fullBleed ? "" : " max-w-[430px]")
      }
      style={{ opacity: phase === "fade" ? 0 : 1 }}
    >
      <div className="splash-wordmark flex flex-col items-center">
        {/* 김(steam) — 일러스트와 동일한 vermilion 곡선 모티프 */}
        <svg
          className="splash-steam mb-[6px]"
          width="58"
          height="34"
          viewBox="0 0 58 34"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M16 32c-4-4 4-7 0-13"
            stroke="#ffffff"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <path
            d="M29 32c-4-4 4-7 0-13"
            stroke="#ffffff"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <path
            d="M42 32c-4-4 4-7 0-13"
            stroke="#ffffff"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </svg>

        {/* heat 래퍼에서 일렁임(transform/blur/glow)을 주고, 안쪽 Wordmark는 기울임 transform 유지 */}
        <div className="splash-heat">
          <Wordmark className="text-[44px] text-white" />
        </div>
      </div>
    </div>
  );
}
