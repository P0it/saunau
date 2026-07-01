"use client";

import { useState } from "react";
import { ScrubberIcon } from "./ScrubberIcon";
import { useFavorites } from "@/lib/favorites";
import { LoginSheet } from "@/components/auth/LoginSheet";

/** 찜하기 — 하트 대신 때수건(이태리타올). 찜하면 초록+검정 줄무늬로 채워진다. 로그인 필요(비로그인은 LoginSheet). */
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
  const { isFavorite, toggle, userId } = useFavorites();
  const [loginOpen, setLoginOpen] = useState(false);
  const active = isFavorite(saunaId);

  const idleStroke = onLight ? "var(--color-ink)" : "#fff";

  return (
    <>
      <button
        type="button"
        aria-label={active ? "찜 해제" : "찜하기"}
        aria-pressed={active}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!userId) {
            setLoginOpen(true);
            return;
          }
          toggle(saunaId);
        }}
        className={`flex items-center justify-center ${className}`}
        style={{ color: idleStroke }}
      >
        <ScrubberIcon size={size} filled={active} strokeWidth={1.4} />
      </button>
      <LoginSheet open={loginOpen} onClose={() => setLoginOpen(false)} />
    </>
  );
}
