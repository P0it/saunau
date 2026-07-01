"use client";

import { useCallback, useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { SaunaReview, SaunaPhoto } from "@/lib/data/types";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * 방문자 후기 — DB(sauna_reviews) 읽기/쓰기. 로그인 사용자만 작성(RLS 본인 행).
 * 닉네임 포함 목록은 RPC(sauna_reviews_for)로, 내 후기 모음은 직접 select 로 가져온다.
 */

/** 매장별 후기 목록(닉네임 포함, 최신순) — 작성 후 재조회용. */
export async function fetchSaunaReviews(
  saunaId: string,
): Promise<SaunaReview[]> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase.rpc("sauna_reviews_for", {
    p_sauna_id: saunaId,
  });
  if (error) return [];
  // 후기 첨부 사진(후기 카드 전용) 을 review_id 로 묶어 붙인다.
  const photosByReview = new Map<string, SaunaPhoto[]>();
  const { data: photos } = await supabase
    .from("sauna_photos")
    .select("id, url, width, height, review_id, created_at")
    .eq("sauna_id", saunaId)
    .eq("is_active", true)
    .not("review_id", "is", null)
    .order("created_at", { ascending: true });
  for (const p of photos ?? []) {
    const key = (p as any).review_id as string;
    const photo: SaunaPhoto = {
      id: (p as any).id,
      url: (p as any).url,
      width: (p as any).width ?? null,
      height: (p as any).height ?? null,
    };
    const arr = photosByReview.get(key);
    if (arr) arr.push(photo);
    else photosByReview.set(key, [photo]);
  }
  return (data ?? []).map((r: any) => ({
    id: r.id,
    saunaId,
    userId: r.user_id,
    rating: r.rating ?? 0,
    body: r.body ?? null,
    nickname: r.nickname ?? "사우나우님",
    photos: photosByReview.get(r.id) ?? [],
    created_at: r.created_at,
  }));
}

/**
 * 후기 작성/수정(1인 1후기/매장 upsert). 성공 시 후기 id, 실패 시 null.
 * 사진 첨부는 이 id 를 받아 /api/photos 로 올린다.
 */
export async function upsertReview(
  saunaId: string,
  userId: string,
  rating: number,
  body: string,
): Promise<string | null> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("sauna_reviews")
    .upsert(
      {
        sauna_id: saunaId,
        user_id: userId,
        rating,
        body: body.trim() || null,
      },
      { onConflict: "sauna_id,user_id" },
    )
    .select("id")
    .single();
  if (error || !data) return null;
  return (data as any).id as string;
}

/** 내 후기 삭제. */
export async function deleteReview(
  saunaId: string,
  userId: string,
): Promise<boolean> {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase
    .from("sauna_reviews")
    .delete()
    .eq("sauna_id", saunaId)
    .eq("user_id", userId);
  return !error;
}

/** 마이페이지용 — 내가 쓴 후기 모음(최신순). 닉네임 불필요(본인). */
export interface MyReview {
  saunaId: string;
  rating: number;
  body: string | null;
  created_at: string;
}

export function useMyReviews() {
  const [reviews, setReviews] = useState<MyReview[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const supabase = createSupabaseBrowserClient();
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id ?? null;
    setUserId(uid);
    if (!uid) {
      setReviews([]);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("sauna_reviews")
      .select("sauna_id, rating, body, created_at")
      .eq("user_id", uid)
      .order("created_at", { ascending: false });
    setReviews(
      (data ?? []).map((r: any) => ({
        saunaId: r.sauna_id,
        rating: r.rating ?? 0,
        body: r.body ?? null,
        created_at: r.created_at,
      })),
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
    const supabase = createSupabaseBrowserClient();
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      void refresh();
    });
    return () => sub.subscription.unsubscribe();
  }, [refresh]);

  const setRating = useCallback(
    async (saunaId: string, rating: number) => {
      if (!userId) return;
      const cur = reviews.find((r) => r.saunaId === saunaId);
      if (await upsertReview(saunaId, userId, rating, cur?.body ?? "")) {
        await refresh();
      }
    },
    [userId, reviews, refresh],
  );

  const setBody = useCallback(
    async (saunaId: string, body: string) => {
      if (!userId) return;
      const cur = reviews.find((r) => r.saunaId === saunaId);
      if (await upsertReview(saunaId, userId, cur?.rating ?? 0, body)) {
        await refresh();
      }
    },
    [userId, reviews, refresh],
  );

  const remove = useCallback(
    async (saunaId: string) => {
      if (!userId) return;
      if (await deleteReview(saunaId, userId)) await refresh();
    },
    [userId, refresh],
  );

  return { reviews, userId, loading, refresh, setRating, setBody, remove };
}
