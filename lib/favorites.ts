"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * 찜하기 — 무로그인 로컬 저장(localStorage). device_id는 익명 식별용으로 함께 보관
 * (다음 세션 visits 적재에서 재사용). 외부 의존 없이 crypto.randomUUID 사용.
 */
const FAV_KEY = "saunau:favorites";
const DEVICE_KEY = "saunau:device_id";

export function getDeviceId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

function readFavorites(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(FAV_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

const EVENT = "saunau:favorites-changed";

function writeFavorites(ids: string[]) {
  localStorage.setItem(FAV_KEY, JSON.stringify(ids));
  window.dispatchEvent(new Event(EVENT));
}

/** 전체 찜 목록 + 토글. 같은 탭의 여러 컴포넌트가 동기화되도록 커스텀 이벤트 사용. */
export function useFavorites() {
  const [ids, setIds] = useState<string[]>([]);

  useEffect(() => {
    setIds(readFavorites());
    const sync = () => setIds(readFavorites());
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const toggle = useCallback((saunaId: string) => {
    const current = readFavorites();
    const next = current.includes(saunaId)
      ? current.filter((x) => x !== saunaId)
      : [...current, saunaId];
    writeFavorites(next);
  }, []);

  return { ids, toggle, isFavorite: (id: string) => ids.includes(id) };
}
