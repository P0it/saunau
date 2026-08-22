"use client";

import { useEffect, useState } from "react";
import { LogoMark } from "@/components/illustrations";
import { Wordmark } from "./Wordmark";

/**
 * 앱 첫 로딩 스플래시 — 흰 바탕에 로고 마크가 내려앉고 워드마크가 뒤따라 뜬다.
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
        "fixed inset-y-0 left-1/2 z-[60] flex w-full -translate-x-1/2 flex-col items-center justify-center bg-card transition-opacity duration-[450ms] ease-out" +
        (fullBleed ? "" : " max-w-[430px]")
      }
      style={{ opacity: phase === "fade" ? 0 : 1 }}
    >
      <div className="flex flex-col items-center gap-[22px]">
        {/* 마크가 살짝 위에서 내려앉는다 — 판이 바닥에 놓이는 동작 */}
        <span className="splash-mark inline-flex">
          <LogoMark size={92} />
        </span>
        <span className="splash-type">
          <Wordmark className="text-[40px] text-brand" />
        </span>
      </div>
    </div>
  );
}
