"use client";

import { useEffect, useState } from "react";

/** 최근 본 사우나 — 로컬 저장(id 배열, 최신순). 상세 진입 시 기록. */
const KEY = "saunau:recent";
const MAX = 10;

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
}

export function useRecentIds(): string[] {
  const [ids, setIds] = useState<string[]>([]);
  useEffect(() => {
    try {
      setIds(JSON.parse(localStorage.getItem(KEY) ?? "[]"));
    } catch {
      setIds([]);
    }
  }, []);
  return ids;
}
