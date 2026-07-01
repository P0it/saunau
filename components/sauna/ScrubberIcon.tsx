"use client";

import { useId } from "react";

/**
 * 사우나우 시그니처 아이콘 — 때수건(이태리타올).
 * 플랫 일러스트. 넓적한 초록 몸체를 우측으로 45° 틸팅, 손목(입구) 쪽에
 * 빨강·노랑·검정 줄을 한 줄씩 깔되 수건 끝(가장자리)까지 꽉 채운다.
 * 찜하기 표식 — 하트 대신 "때 미는 마음".
 *
 *  - filled  : 찜 상태. 초록으로 꽉 차고 빨/노/검 줄이 끝까지 또렷한 풀컬러.
 *  - !filled : 미찜 상태. currentColor 외곽선만(배경에 맞춰 흰/먹).
 *
 * 줄무늬는 몸체 모양으로 clip 해서 둥근 모서리까지 깔끔히 잘린다.
 */

type ScrubberIconProps = {
  size?: number;
  /** true면 풀컬러로 채운다(찜 상태). */
  filled?: boolean;
  className?: string;
  strokeWidth?: number;
};

const TOWEL_GREEN = "#1aa04a"; // 이태리타올 초록
const STRIPE_RED = "#e8442f";
const STRIPE_YELLOW = "#f5c518";
const STRIPE_BLACK = "#1b1d1f";

// 몸체 — 세로로 살짝 긴 때수건 비율. 중심(12,12) 기준이라 45° 회전해도 안 잘린다.
const BODY = { x: 5.5, y: 4, w: 13, h: 16, rx: 3.2 };

export function ScrubberIcon({
  size = 24,
  filled = false,
  className,
  strokeWidth = 1.4,
}: ScrubberIconProps) {
  const stripeStroke = Math.max(0.7, strokeWidth * 0.7);
  const clipId = useId();

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      {/* 우측 45° 틸팅 — 중심(12,12) 기준 회전 */}
      <g transform="rotate(45 12 12)">
        {filled ? (
          <>
            <defs>
              <clipPath id={clipId}>
                <rect
                  x={BODY.x}
                  y={BODY.y}
                  width={BODY.w}
                  height={BODY.h}
                  rx={BODY.rx}
                />
              </clipPath>
            </defs>
            {/* 몸체 — 플랫 초록 */}
            <rect
              x={BODY.x}
              y={BODY.y}
              width={BODY.w}
              height={BODY.h}
              rx={BODY.rx}
              fill={TOWEL_GREEN}
            />
            {/* 손목 쪽 줄무늬(가늘게) — 가장자리까지. 단, 맨 끝엔 초록을
                남겨 때수건 천이 보이게. 몸체 모양으로 clip */}
            <g clipPath={`url(#${clipId})`}>
              <rect x={BODY.x} y="14.5" width={BODY.w} height="0.95" fill={STRIPE_RED} />
              <rect x={BODY.x} y="15.85" width={BODY.w} height="0.95" fill={STRIPE_YELLOW} />
              <rect x={BODY.x} y="17.2" width={BODY.w} height="0.95" fill={STRIPE_BLACK} />
            </g>
          </>
        ) : (
          <g
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {/* 몸체 외곽선 */}
            <rect
              x={BODY.x}
              y={BODY.y}
              width={BODY.w}
              height={BODY.h}
              rx={BODY.rx}
            />
            {/* 손목 쪽 줄무늬 자리(가늘게) — 끝엔 초록 여백 */}
            <path d="M6.5 14.95h11" strokeWidth={stripeStroke} />
            <path d="M6.5 16.3h11" strokeWidth={stripeStroke} />
            <path d="M7 17.65h10" strokeWidth={stripeStroke} />
          </g>
        )}
      </g>
    </svg>
  );
}
