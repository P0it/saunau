"use client";

import { useEffect, useState } from "react";

/**
 * 앱 첫 로딩 스플래시 — "사우?" 를 받고 "나우!" 로 답하는 채팅 한 마디.
 * 왼쪽(받은 말풍선)이 묻고 오른쪽(보낸 말풍선)이 답한다 — 읽는 순서가 곧 대화 순서라
 * 서비스 이름 두 마디의 관계가 설명 없이 잡힌다.
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
      {/* 말풍선 폭을 고정해 두 마디가 좌·우로 확실히 갈라 서게 한다 */}
      <div className="flex w-[220px] flex-col gap-[10px]">
        <span className="splash-ask splash-bubble self-start rounded-bl-[7px] bg-[#f0ede8] text-[#46413b]">
          사우?
        </span>
        <span className="splash-say splash-bubble self-end rounded-br-[7px] bg-brand text-white shadow-[0_6px_16px_rgba(245,64,44,0.28)]">
          나우!
        </span>
      </div>
    </div>
  );
}
