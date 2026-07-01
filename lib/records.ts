"use client";

import { useCallback, useEffect, useReducer } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * 나의 기록 — 후기(공개)와 분리된, 나만 보는 사우나별 비공개 메모.
 * 로그인 사용자만 사용하며 Supabase(sauna_memos)에 저장한다(기기 바뀌어도 유지).
 * 모듈 레벨 스토어로 한 번만 로드/구독하고, 같은 탭의 여러 화면이 즉시 동기화된다.
 */
export interface RecordNote {
  saunaId: string;
  note: string;
  updatedAt: string; // ISO datetime
}

// ---- 모듈 레벨 싱글턴 스토어 ----
let records: RecordNote[] = [];
let userId: string | null = null;
let loading = true;
let initialized = false;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

async function loadFor(uid: string | null) {
  userId = uid;
  if (!uid) {
    records = [];
    loading = false;
    notify();
    return;
  }
  const supabase = createSupabaseBrowserClient();
  const { data } = await supabase
    .from("sauna_memos")
    .select("sauna_id, note, updated_at")
    .eq("user_id", uid)
    .order("updated_at", { ascending: false });
  records = (data ?? []).map((r: any) => ({
    saunaId: r.sauna_id,
    note: r.note ?? "",
    updatedAt: r.updated_at,
  }));
  loading = false;
  notify();
}

function ensureInit() {
  if (initialized) return;
  initialized = true;
  const supabase = createSupabaseBrowserClient();
  void (async () => {
    const { data } = await supabase.auth.getUser();
    await loadFor(data.user?.id ?? null);
  })();
  supabase.auth.onAuthStateChange((_e: any, session: any) => {
    void loadFor(session?.user?.id ?? null);
  });
}

/** 비공개 기록 목록(최신 수정순) + 저장/삭제. 같은 사우나는 1건으로 유지. */
export function useRecords() {
  const [, force] = useReducer((c: number) => c + 1, 0);

  useEffect(() => {
    ensureInit();
    listeners.add(force);
    return () => {
      listeners.delete(force);
    };
  }, []);

  // 빈 note 는 저장하지 않고 기존 기록을 삭제(빈 메모 카드 방지).
  const setRecord = useCallback(async (saunaId: string, note: string) => {
    if (!userId) return;
    const supabase = createSupabaseBrowserClient();
    const trimmed = note.trim();
    if (!trimmed) {
      const prev = records;
      records = records.filter((r) => r.saunaId !== saunaId);
      notify();
      const { error } = await supabase
        .from("sauna_memos")
        .delete()
        .eq("user_id", userId)
        .eq("sauna_id", saunaId);
      if (error) {
        // 실패 시 롤백.
        records = prev;
        notify();
      }
      return;
    }
    const nowIso = new Date().toISOString();
    // 낙관적: 최신순 유지 위해 맨 앞으로.
    const prev = records;
    records = [
      { saunaId, note: trimmed, updatedAt: nowIso },
      ...records.filter((r) => r.saunaId !== saunaId),
    ];
    notify();
    const { error } = await supabase.from("sauna_memos").upsert(
      { user_id: userId, sauna_id: saunaId, note: trimmed, updated_at: nowIso },
      { onConflict: "user_id,sauna_id" },
    );
    if (error) {
      // 실패 시 롤백.
      records = prev;
      notify();
    }
  }, []);

  const removeRecord = useCallback(async (saunaId: string) => {
    if (!userId) return;
    const supabase = createSupabaseBrowserClient();
    const prev = records;
    records = records.filter((r) => r.saunaId !== saunaId);
    notify();
    const { error } = await supabase
      .from("sauna_memos")
      .delete()
      .eq("user_id", userId)
      .eq("sauna_id", saunaId);
    if (error) {
      // 실패 시 롤백.
      records = prev;
      notify();
    }
  }, []);

  return { records, userId, loading, setRecord, removeRecord };
}
