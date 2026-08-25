"use client";

import { useCallback, useEffect, useReducer } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * 찜하기 — 로그인 전에는 브라우저(localStorage), 로그인하면 Supabase(sauna_favorites).
 *
 * 가입을 강요하면 탐색 자체가 막히므로 비로그인에서도 하트가 동작해야 한다.
 * 대신 로그인하는 순간 로컬 목록을 서버로 올리고(병합) 로컬을 비운다 —
 * 이후로는 서버가 단일 출처라 기기가 바뀌어도 유지된다.
 *
 * 카드마다 하트가 있으므로 모듈 레벨 스토어로 한 번만 세션 감지·로드·구독하고,
 * 같은 탭의 모든 하트가 즉시 같은 상태를 읽는다. device_id는 익명 식별용으로 보존.
 */
const DEVICE_KEY = "saunau:device_id";
const LOCAL_KEY = "saunau:favorites";

export function getDeviceId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

// ---- 로컬(비로그인) 저장소 ----
function readLocal(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter((x): x is string => typeof x === "string")
      : [];
  } catch {
    return [];
  }
}

function writeLocal(next: string[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(next));
  } catch {
    // 사파리 프라이빗 모드 등 쓰기 실패 — 메모리 상태만 유지하고 넘어간다.
  }
}

function clearLocal() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(LOCAL_KEY);
  } catch {
    /* 무시 */
  }
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

/**
 * 로그인 직후 로컬에 쌓인 찜을 서버로 올린다.
 * 이미 서버에 있는 매장은 PK 충돌이므로 ignoreDuplicates 로 넘긴다.
 * 실패하면 로컬을 지우지 않는다 — 다음 로그인/새로고침에 다시 시도된다.
 */
async function mergeLocalInto(uid: string): Promise<void> {
  const local = readLocal();
  if (local.length === 0) return;
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.from("sauna_favorites").upsert(
    local.map((sauna_id) => ({ user_id: uid, sauna_id })),
    { onConflict: "user_id,sauna_id", ignoreDuplicates: true },
  );
  if (!error) clearLocal();
}

async function loadFor(uid: string | null) {
  userId = uid;
  if (!uid) {
    // 비로그인(로그아웃 포함) — 로컬이 곧 목록.
    ids = readLocal();
    loading = false;
    notify();
    return;
  }
  await mergeLocalInto(uid);
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
  // 세션 확인 전에도 하트가 즉시 채워지도록 로컬을 먼저 반영한다.
  ids = readLocal();
  notify();
  const supabase = createSupabaseBrowserClient();
  void (async () => {
    const { data } = await supabase.auth.getUser();
    await loadFor(data.user?.id ?? null);
  })();
  supabase.auth.onAuthStateChange((_e: any, session: any) => {
    void loadFor(session?.user?.id ?? null);
  });
}

/**
 * 전체 찜 목록 + 토글.
 * `isLocal` 이 true 면 비로그인 상태로 이 기기에만 저장되고 있다는 뜻이다.
 */
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
    const has = ids.includes(saunaId);
    const next = has ? ids.filter((x) => x !== saunaId) : [...ids, saunaId];

    // 비로그인 — 로컬에만 반영.
    if (!userId) {
      ids = next;
      writeLocal(next);
      notify();
      return;
    }

    // 로그인 — 낙관적 업데이트 후 서버 반영, 실패 시 롤백.
    const prev = ids;
    ids = next;
    notify();
    const supabase = createSupabaseBrowserClient();
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
      ids = prev;
      notify();
    }
  }, []);

  return {
    ids,
    userId,
    /** 비로그인 로컬 저장 모드 — "로그인하면 기기가 바뀌어도 유지" 안내 노출용. */
    isLocal: userId === null,
    loading,
    toggle,
    isFavorite: (id: string) => ids.includes(id),
  };
}
