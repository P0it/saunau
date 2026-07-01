"use client";

import { useCallback, useEffect, useReducer } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * 찜하기 — 로그인 사용자만 사용, Supabase(sauna_favorites)에 저장(기기 바뀌어도 유지).
 * 카드마다 하트가 있으므로 모듈 레벨 스토어로 한 번만 세션 감지·로드·구독하고,
 * 같은 탭의 모든 하트가 즉시 같은 상태를 읽는다. device_id는 익명 식별용으로 보존.
 */
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

// ---- 모듈 레벨 싱글턴 스토어 ----
let ids: string[] = [];
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
    ids = [];
    loading = false;
    notify();
    return;
  }
  const supabase = createSupabaseBrowserClient();
  const { data } = await supabase
    .from("sauna_favorites")
    .select("sauna_id")
    .eq("user_id", uid);
  ids = (data ?? []).map((r: any) => r.sauna_id as string);
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

/** 전체 찜 목록 + 토글. 로그인 사용자만 쓰기 가능(userId 없으면 toggle 무시). */
export function useFavorites() {
  const [, force] = useReducer((c: number) => c + 1, 0);

  useEffect(() => {
    ensureInit();
    listeners.add(force);
    return () => {
      listeners.delete(force);
    };
  }, []);

  const toggle = useCallback(async (saunaId: string) => {
    if (!userId) return;
    const supabase = createSupabaseBrowserClient();
    const has = ids.includes(saunaId);
    // 낙관적 업데이트.
    ids = has ? ids.filter((x) => x !== saunaId) : [...ids, saunaId];
    notify();
    const { error } = has
      ? await supabase
          .from("sauna_favorites")
          .delete()
          .eq("user_id", userId)
          .eq("sauna_id", saunaId)
      : await supabase
          .from("sauna_favorites")
          .insert({ user_id: userId, sauna_id: saunaId });
    if (error) {
      // 실패 시 롤백.
      ids = has ? [...ids, saunaId] : ids.filter((x) => x !== saunaId);
      notify();
    }
  }, []);

  return {
    ids,
    userId,
    loading,
    toggle,
    isFavorite: (id: string) => ids.includes(id),
  };
}
