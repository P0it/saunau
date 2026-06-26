"use client";

import { useEffect } from "react";
import { recordRecent } from "@/lib/recent";

/** 상세 진입 시 "최근 본 사우나"에 기록(렌더만, UI 없음). */
export function RecordView({ saunaId }: { saunaId: string }) {
  useEffect(() => {
    recordRecent(saunaId);
  }, [saunaId]);
  return null;
}
