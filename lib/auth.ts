"use client";

import { useCallback, useEffect, useState } from "react";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

/**
 * 로그인 상태 + 프로필 훅. onAuthStateChange로 세션 변화를 구독하고,
 * 로그인 시 profiles에서 닉네임·아바타·온보딩 완료 여부를 조회한다.
 *
 * 로그인 판정은 반드시 `user`(=id) 기준으로 한다 — 카카오는 이메일이 선택 동의라
 * 로그인했는데도 `email` 이 null 일 수 있다.
 */
export interface AuthUser {
  id: string;
  email: string | null;
  /** "kakao" | "google" | "email" — 계정 화면에서 로그인 경로 표시용. */
  provider: string | null;
}

export interface AuthState {
  loading: boolean;
  user: AuthUser | null;
  nickname: string | null;
  avatarUrl: string | null;
  /** 가입 절차(약관 동의+닉네임) 완료 여부. false면 AppFrame이 /welcome 으로 보낸다. */
  onboarded: boolean;
  /** 마케팅 수신 동의 여부(선택). */
  marketingAgreed: boolean;
  /** 관리자 여부 — 서버(/api/admin/me)가 ADMIN_EMAILS 로 판정. 비로그인/일반 유저는 false. */
  isAdmin: boolean;
}

const EMPTY: AuthState = {
  loading: false,
  user: null,
  nickname: null,
  avatarUrl: null,
  onboarded: false,
  marketingAgreed: false,
  isAdmin: false,
};

export function useAuth() {
  const [state, setState] = useState<AuthState>({ ...EMPTY, loading: true });

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let alive = true;

    async function loadProfile(userId: string) {
      const { data } = await supabase
        .from("profiles")
        .select("nickname, avatar_url, onboarded_at, marketing_agreed_at")
        .eq("id", userId)
        .maybeSingle();
      return {
        nickname: (data?.nickname as string | null) ?? null,
        avatarUrl: (data?.avatar_url as string | null) ?? null,
        onboarded: Boolean(data?.onboarded_at),
        marketingAgreed: Boolean(data?.marketing_agreed_at),
      };
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
        if (alive) setState(EMPTY);
        return;
      }
      const [profile, isAdmin] = await Promise.all([
        loadProfile(sessionUser.id),
        loadIsAdmin(),
      ]);
      if (alive)
        setState({ loading: false, user: sessionUser, isAdmin, ...profile });
    }

    void (async () => {
      const { data } = await supabase.auth.getUser();
      await sync(toAuthUser(data.user));
    })();

    const { data: sub } = supabase.auth.onAuthStateChange(
      (_event: AuthChangeEvent, session: Session | null) => {
        sync(toAuthUser(session?.user ?? null));
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

  /** 마케팅 수신 동의 토글 — 동의 시각을 기록하고, 철회하면 null 로 지운다. */
  const setMarketingAgreed = useCallback(async (agreed: boolean) => {
    const supabase = createSupabaseBrowserClient();
    const { data } = await supabase.auth.getUser();
    const id = data.user?.id;
    if (!id) return;
    const { error } = await supabase
      .from("profiles")
      .update({ marketing_agreed_at: agreed ? new Date().toISOString() : null })
      .eq("id", id);
    if (!error) setState((s) => ({ ...s, marketingAgreed: agreed }));
  }, []);

  return { ...state, signOut, updateNickname, setMarketingAgreed };
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function toAuthUser(u: any): AuthUser | null {
  if (!u) return null;
  return {
    id: u.id,
    email: u.email ?? null,
    provider: (u.app_metadata?.provider as string | undefined) ?? null,
  };
}
