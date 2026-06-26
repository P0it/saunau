"use client";

import { useCallback, useEffect, useState } from "react";
import { getDeviceId } from "./favorites";

/**
 * 다녀옴(체크인) — 무로그인 로컬 저장. 다음 세션 Supabase `visits` 적재로 교체 예정.
 * 지금은 device_id와 함께 로컬에 기록(만족도·개인 메모·방문일).
 */
export interface VisitRecord {
  saunaId: string;
  deviceId: string;
  satisfaction: "개운해요" | "평범해요" | "아쉬워요";
  memo?: string;
  visitedAt: string; // ISO date
}

const KEY = "saunau:visits";
const EVENT = "saunau:visits-changed";

function read(): VisitRecord[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as VisitRecord[];
  } catch {
    return [];
  }
}

function write(list: VisitRecord[]) {
  localStorage.setItem(KEY, JSON.stringify(list));
  window.dispatchEvent(new Event(EVENT));
}

/** 방문 기록(최신순) + 추가/메모수정. 같은 사우나는 최신 1건으로 유지. */
export function useVisits() {
  const [visits, setVisits] = useState<VisitRecord[]>([]);

  useEffect(() => {
    setVisits(read());
    const sync = () => setVisits(read());
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const addVisit = useCallback(
    (saunaId: string, satisfaction: VisitRecord["satisfaction"]) => {
      const list = read().filter((v) => v.saunaId !== saunaId);
      const visitedAt = new Date().toISOString();
      write([
        { saunaId, deviceId: getDeviceId(), satisfaction, visitedAt },
        ...list,
      ]);
    },
    [],
  );

  const setMemo = useCallback((saunaId: string, memo: string) => {
    const list = read().map((v) =>
      v.saunaId === saunaId ? { ...v, memo } : v,
    );
    write(list);
  }, []);

  return { visits, addVisit, setMemo };
}
