"use client";

import { ScrubberIcon } from "./ScrubberIcon";
import { useFavorites } from "@/lib/favorites";

/**
 * 찜하기 — 하트 대신 때수건(이태리타올). 찜하면 초록+검정 줄무늬로 채워진다.
 * 비로그인에서도 동작한다(이 기기에만 저장 → 로그인 시 계정으로 병합).
 * 로그인 유도는 찜 탭 배너가 맡는다 — 하트를 누를 때마다 시트를 띄우면 탐색이 끊긴다.
 */
export function FavoriteScrubber({
  saunaId,
  size = 26,
  className = "",
  onLight = false,
}: {
  saunaId: string;
  size?: number;
  className?: string;
  /** true면 밝은 배경용(먹색 외곽선). false면 사진 위 오버레이용(흰 외곽선). */
  onLight?: boolean;
}) {
  const { isFavorite, toggle } = useFavorites();
  const active = isFavorite(saunaId);

  const idleStroke = onLight ? "var(--color-ink)" : "#fff";

  return (
    <button
      type="button"
      aria-label={active ? "찜 해제" : "찜하기"}
      aria-pressed={active}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle(saunaId);
      }}
      className={`flex items-center justify-center ${className}`}
      style={{ color: idleStroke }}
    >
      <ScrubberIcon size={size} filled={active} strokeWidth={1.4} />
    </button>
  );
}
