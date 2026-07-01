"use client";

import { useCallback, useEffect, useState } from "react";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

/**
 * 로그인 상태 + 닉네임 훅. onAuthStateChange로 세션 변화를 구독하고,
 * 로그인 시 profiles에서 닉네임을 조회한다. 로그아웃·닉네임 변경도 제공.
 */
export interface AuthUser {
  id: string;
  email: string | null;
}

export interface AuthState {
  loading: boolean;
  user: AuthUser | null;
  nickname: string | null;
  /** 관리자 여부 — 서버(/api/admin/me)가 ADMIN_EMAILS 로 판정. 비로그인/일반 유저는 false. */
  isAdmin: boolean;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    loading: true,
    user: null,
    nickname: null,
    isAdmin: false,
  });

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let alive = true;

    async function loadNickname(userId: string): Promise<string | null> {
      const { data } = await supabase
        .from("profiles")
        .select("nickname")
        .eq("id", userId)
        .maybeSingle();
      return data?.nickname ?? null;
    }

    // 관리자 여부는 서버 권위(허용목록은 클라에 내려보내지 않음). 실패 시 false.
    async function loadIsAdmin(): Promise<boolean> {
      try {
        const res = await fetch("/api/admin/me");
        if (!res.ok) return false;
        const json = await res.json();
        return json?.isAdmin === true;
      } catch {
        return false;
      }
    }

    async function sync(sessionUser: AuthUser | null) {
      if (!sessionUser) {
        if (alive)
          setState({ loading: false, user: null, nickname: null, isAdmin: false });
        return;
      }
      const [nickname, isAdmin] = await Promise.all([
        loadNickname(sessionUser.id),
        loadIsAdmin(),
      ]);
      if (alive)
        setState({ loading: false, user: sessionUser, nickname, isAdmin });
    }

    void (async () => {
      const { data } = await supabase.auth.getUser();
      const u = data.user;
      await sync(u ? { id: u.id, email: u.email ?? null } : null);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange(
      (_event: AuthChangeEvent, session: Session | null) => {
        const u = session?.user;
        sync(u ? { id: u.id, email: u.email ?? null } : null);
      },
    );

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signOut = useCallback(async () => {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
  }, []);

  const updateNickname = useCallback(async (nickname: string) => {
    const supabase = createSupabaseBrowserClient();
    const { data } = await supabase.auth.getUser();
    const id = data.user?.id;
    if (!id) return;
    const { error } = await supabase
      .from("profiles")
      .update({ nickname })
      .eq("id", id);
    if (!error) setState((s) => ({ ...s, nickname }));
  }, []);

  return { ...state, signOut, updateNickname };
}
