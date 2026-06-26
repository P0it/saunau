"use client";

import { Heart } from "lucide-react";
import { useFavorites } from "@/lib/favorites";

/** 찜하기 하트 — 찜 상태는 빨강 꽉 찬 하트. 로컬 저장. */
export function FavoriteHeart({
  saunaId,
  size = 22,
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
  const idleFill = onLight ? "none" : "rgba(0,0,0,0.18)";

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
      style={{ color: active ? "var(--color-brand)" : idleStroke }}
    >
      <Heart
        size={size}
        fill={active ? "currentColor" : idleFill}
        stroke="currentColor"
        strokeWidth={2}
      />
    </button>
  );
}
