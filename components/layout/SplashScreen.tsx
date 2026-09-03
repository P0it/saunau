"use client";

import { useEffect, useState } from "react";

/**
 * 앱 첫 로딩 스플래시 — "사우?" 를 받고 "나우!" 로 답하는 채팅 한 마디.
 * 왼쪽(받은 말풍선)이 묻고 오른쪽(보낸 말풍선)이 답한다 — 읽는 순서가 곧 대화 순서라
 * 서비스 이름 두 마디의 관계가 설명 없이 잡힌다.
 *
 * 대화가 끝나면 아래에서 김이 차올라 말풍선을 삼키고, 화면이 하얗게 씻기며 홈으로 넘어간다.
 * 페이드아웃이 곧 전환이라 "스플래시가 사라진다"가 아니라 "김이 걷히니 홈이었다"로 읽힌다.
 *
 * AppFrame 최초 마운트 시 1회만 표시(클라이언트 라우팅 전환에는 다시 안 뜸).
 */
const HOLD_MS = 2600; // 대화 + 김이 차오르는 시간 (CSS 딜레이와 함께 움직인다)
const FADE_MS = 700; // 하얗게 씻긴 화면이 걷히며 홈이 드러나는 시간

/** 스플래시가 완전히 사라지기까지의 총 시간 — 이후에 떠야 하는 프롬프트류의 지연 기준. */
export const SPLASH_TOTAL_MS = HOLD_MS + FADE_MS;

/** 김 덩어리 — 폭·가로위치·시작 시각을 어긋나게 둬야 뭉치지 않고 피어오른다. */
const PUFFS = [
  { left: "-20%", width: "80%", animationDelay: "1.35s" },
  { left: "28%", width: "88%", animationDelay: "1.45s" },
  { left: "-6%", width: "66%", animationDelay: "1.58s" },
  { left: "44%", width: "72%", animationDelay: "1.66s" },
  { left: "10%", width: "94%", animationDelay: "1.75s" },
];

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
        "fixed inset-y-0 left-1/2 z-[60] flex w-full -translate-x-1/2 flex-col items-center justify-center overflow-hidden bg-card transition-opacity duration-700 ease-out" +
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

      {/* 김 — 아래에서 피어올라 말풍선을 지운다 */}
      <div className="splash-steam">
        {PUFFS.map((p) => (
          <span key={p.animationDelay + p.left} style={p} />
        ))}
      </div>

      {/* 김이 가장 짙어지는 순간 화면을 하얗게 덮어, 홈이 드러날 때 이음매가 안 보이게 한다 */}
      <div className="splash-veil" />
    </div>
  );
}
