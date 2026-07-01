"use client";

import { Flame } from "lucide-react";

/**
 * 불꽃 평점 — 별점(5점)의 멘탈모델은 그대로, 글리프만 사우나우 컨셉(불꽃)으로 교체.
 * 시그니처 온도 헤드라인과 같은 hot 톤(#f5402c)을 쓴다.
 *
 * - 표시 모드(onChange 없음): value(예: 4.3)를 받아 마지막 칸을 부분 채움(소수점 집계용).
 * - 입력 모드(onChange 있음): 1~5 정수 탭(모바일 3초 체크인 — 반 칸 입력은 받지 않음).
 */
export function FlameRating({
  value,
  onChange,
  size = 22,
  gap = 5,
}: {
  value: number;
  onChange?: (n: number) => void;
  size?: number;
  gap?: number;
}) {
  const EMPTY = "#E2DDD6";
  const clamped = Math.max(0, Math.min(5, value));

  if (onChange) {
    // 입력: 정수 탭. 채워짐 = index < value.
    return (
      <div className="flex" style={{ gap }} role="radiogroup" aria-label="불꽃 평점">
        {[1, 2, 3, 4, 5].map((n) => {
          const on = n <= Math.round(clamped);
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={`${n}점`}
              onClick={() => onChange(n)}
              className="active:scale-90"
              style={{ lineHeight: 0, transition: "transform .08s" }}
            >
              <Flame
                size={size}
                className={on ? "text-hot" : ""}
                style={{ color: on ? undefined : EMPTY }}
                fill={on ? "currentColor" : "none"}
              />
            </button>
          );
        })}
      </div>
    );
  }

  // 표시: 빈 불꽃 행 위에 채운 불꽃 행을 비율만큼 클립.
  const totalW = size * 5 + gap * 4;
  const fillW = (clamped / 5) * totalW;

  return (
    <div className="relative inline-flex" style={{ gap }} aria-label={`${clamped}점`}>
      {/* 바닥(빈) */}
      {[0, 1, 2, 3, 4].map((i) => (
        <Flame key={i} size={size} style={{ color: EMPTY }} fill="none" />
      ))}
      {/* 채움 오버레이(클립) */}
      <div
        className="absolute left-0 top-0 flex overflow-hidden"
        style={{ width: fillW, gap }}
        aria-hidden
      >
        {[0, 1, 2, 3, 4].map((i) => (
          <Flame
            key={i}
            size={size}
            className="text-hot flex-none"
            fill="currentColor"
          />
        ))}
      </div>
    </div>
  );
}
