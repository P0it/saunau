"use client";

import { useSyncExternalStore } from "react";

/** 최근 본 사우나 — 로컬 저장(id 배열, 최신순). 상세 진입 시 기록. */
const KEY = "saunau:recent";
const MAX = 10;

// localStorage 를 외부 스토어로 구독한다(useSyncExternalStore).
// 이펙트로 읽어 setState 하면 첫 렌더가 빈 목록으로 한 번 더 돌고, 같은 탭에서
// recordRecent 한 결과가 열려 있는 화면에 반영되지 않는다.
const EMPTY: string[] = [];
const listeners = new Set<() => void>();
// 스냅샷은 참조가 안정적이어야 한다 — 원본 문자열이 그대로면 파싱 결과를 재사용.
let cache: { raw: string; ids: string[] } = { raw: "", ids: EMPTY };

function readIds(): string[] {
  const raw = localStorage.getItem(KEY) ?? "[]";
  if (raw !== cache.raw) {
    let ids: string[];
    try {
      const parsed: unknown = JSON.parse(raw);
      ids = Array.isArray(parsed) ? (parsed as string[]) : EMPTY;
    } catch {
      ids = EMPTY;
    }
    cache = { raw, ids };
  }
  return cache.ids;
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  // 다른 탭에서의 변경도 반영.
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function recordRecent(saunaId: string) {
  if (typeof window === "undefined") return;
  let ids: string[] = [];
  try {
    ids = JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    ids = [];
  }
  ids = [saunaId, ...ids.filter((x) => x !== saunaId)].slice(0, MAX);
  localStorage.setItem(KEY, JSON.stringify(ids));
  listeners.forEach((l) => l());
}

export function useRecentIds(): string[] {
  // 서버 스냅샷은 항상 빈 목록 — localStorage 는 클라이언트에만 있다(하이드레이션 불일치 방지).
  return useSyncExternalStore(subscribe, readIds, () => EMPTY);
}
