"use client";

import { useEffect, useState } from "react";

/**
 * 앱 첫 로딩 스플래시 — "사우?" 를 받고 "나우!" 로 답하는 채팅 한 마디.
 * 왼쪽(받은 말풍선)이 묻고 오른쪽(보낸 말풍선)이 답한다 — 읽는 순서가 곧 대화 순서라
 * 서비스 이름 두 마디의 관계가 설명 없이 잡힌다.
 *
 * 바닥은 먹색이다. 실제 수증기는 빛을 산란시켜 주변보다 밝고 연기는 빛을 흡수해 어두운데,
 * 흰 바닥에 회색 김을 얹으면 바닥을 어둡게 덮게 되어 농도를 아무리 낮춰도 연기로 읽혔다.
 * 바닥을 어둡게 두면 김이 흰색일 수 있고, 그제서야 같은 움직임이 수증기가 된다.
 *
 * 대화가 끝나면 아래에서 흰 김이 차올라 말풍선을 삼키고, 화면이 하얗게 밝아지며 홈으로 넘어간다.
 * 밝아짐 자체가 전환이라 "스플래시가 사라진다"가 아니라 "김이 걷히니 홈이었다"로 읽힌다.
 *
 * AppFrame 최초 마운트 시 1회만 표시(클라이언트 라우팅 전환에는 다시 안 뜸).
 */
const HOLD_MS = 3000; // 대화 + 김이 차오르는 시간 (CSS 딜레이와 함께 움직인다)
const FADE_MS = 700; // 하얗게 씻긴 화면이 걷히며 홈이 드러나는 시간

/** 스플래시가 완전히 사라지기까지의 총 시간 — 이후에 떠야 하는 프롬프트류의 지연 기준. */
export const SPLASH_TOTAL_MS = HOLD_MS + FADE_MS;

/*
 * 김 덩이 — top/left 는 "다 피어오른 뒤의 자리"다. 세 줄로 화면을 겹쳐 덮게 미리 깔아두고
 * 각자 아래에서 밀려 올라오게 한다. 자리를 미리 정해두므로 마지막에 빈 구석이 남지 않고,
 * 아랫줄부터 늦게 도착하는 윗줄 순으로 시각을 어긋내 뭉게뭉게 올라오는 것처럼 읽힌다.
 */
const PUFFS = [
  { top: "66%", left: "-14%", width: "66%", animationDelay: "0.95s" },
  { top: "70%", left: "30%", width: "70%", animationDelay: "1s" },
  { top: "63%", left: "62%", width: "58%", animationDelay: "1.05s" },

  { top: "40%", left: "-8%", width: "60%", animationDelay: "1.14s" },
  { top: "36%", left: "34%", width: "64%", animationDelay: "1.19s" },
  { top: "42%", left: "66%", width: "56%", animationDelay: "1.24s" },

  { top: "14%", left: "-12%", width: "62%", animationDelay: "1.33s" },
  { top: "10%", left: "32%", width: "66%", animationDelay: "1.38s" },
  { top: "16%", left: "64%", width: "58%", animationDelay: "1.43s" },

  { top: "-12%", left: "6%", width: "70%", animationDelay: "1.52s" },
  { top: "-16%", left: "48%", width: "62%", animationDelay: "1.57s" },
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
        "splash-screen fixed inset-y-0 left-1/2 z-[60] flex w-full -translate-x-1/2 flex-col items-center justify-center overflow-hidden transition-opacity duration-700 ease-out" +
        (fullBleed ? "" : " max-w-[430px]")
      }
      style={{ opacity: phase === "fade" ? 0 : 1 }}
    >
      {/* 두 마디를 화면 좌·우 끝에 붙인다 — 가운데 모아두면 대화가 아니라 목록으로 읽힌다.
          풀블리드(지도)에서도 안쪽 폭은 430px 로 묶어 두 말풍선이 지나치게 멀어지지 않게. */}
      <div className="flex w-full max-w-[430px] flex-col gap-[26px] px-6">
        <span className="splash-ask splash-bubble self-start rounded-bl-[9px] bg-[#3a3532] text-[#efe9e4]">
          사우?
        </span>
        <span className="splash-say splash-bubble self-end rounded-br-[9px] bg-brand text-white shadow-[0_10px_30px_rgba(245,64,44,0.35)]">
          나우!
        </span>
      </div>

      {/* 김 — 덩이들이 아래에서 밀려 올라와 서로 겹치며 화면을 채운다 */}
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
