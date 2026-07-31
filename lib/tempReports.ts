"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * 온도 제보 — DB(sauna_temp_reports) 쓰기 + 집계(sauna_temp_agg) 재조회.
 * 로그인 사용자만 작성(RLS 본인 행). 1인 1제보/매장 upsert(0027: 남/여 구분 없음).
 * 표시 온도는 직접 덮어쓰지 않고 제보를 쌓아 median 으로 자동 산출(reviews.ts 미러).
 */

/** 온도 제보 작성/수정(upsert). room/cold 둘 중 하나 이상 필요. 성공 시 true. */
export async function upsertTempReport(
  saunaId: string,
  userId: string,
  saunaRoomTemp: number | null,
  coldBathTemp: number | null,
): Promise<boolean> {
  if (saunaRoomTemp == null && coldBathTemp == null) return false;
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.from("sauna_temp_reports").upsert(
    {
      sauna_id: saunaId,
      user_id: userId,
      sauna_room_temp: saunaRoomTemp,
      cold_bath_temp: coldBathTemp,
    },
    { onConflict: "sauna_id,user_id" },
  );
  return !error;
}

/** 내 온도 제보 삭제. */
export async function deleteTempReport(
  saunaId: string,
  userId: string,
): Promise<boolean> {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase
    .from("sauna_temp_reports")
    .delete()
    .eq("sauna_id", saunaId)
    .eq("user_id", userId);
  return !error;
}

/** 내 제보값 — 제보 시트 초기값 채우기용. 없으면 null. */
export async function fetchMyTempReport(
  saunaId: string,
  userId: string,
): Promise<{ saunaRoomTemp: number | null; coldBathTemp: number | null } | null> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("sauna_temp_reports")
    .select("sauna_room_temp, cold_bath_temp")
    .eq("sauna_id", saunaId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return null;
  return {
    saunaRoomTemp: (data as any).sauna_room_temp ?? null,
    coldBathTemp: (data as any).cold_bath_temp ?? null,
  };
}

/**
 * 집계 재조회(제출 직후 UI 갱신용) — 임계치/표시값 해석은 queries.getSaunaTempInfo 와 동일 규칙.
 * 단, seed 폴백은 호출부가 이미 가진 TempInfo 로 합치므로 여기선 crowd 만 계산해 반환.
 */
const TEMP_CROWD_THRESHOLD = 2;

export interface CrowdTempCell {
  crowdValue: number | null;
  reportCount: number;
  latestReportAt: string | null;
}

export interface CrowdTempInfo {
  saunaRoom: CrowdTempCell;
  coldBath: CrowdTempCell;
}

/** 매장 온도 집계만(crowd) 재조회. 제보 직후 TempHero 즉시 반영용. */
export async function fetchCrowdTempInfo(
  saunaId: string,
): Promise<CrowdTempInfo | null> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase.rpc("sauna_temp_agg", {
    p_sauna_id: saunaId,
  });
  if (error) return null;

  const cell = (metric: "sauna_room" | "cold_bath"): CrowdTempCell => {
    const r = (data ?? []).find((x: any) => x.metric === metric);
    const median = r?.crowd_median != null ? Number(r.crowd_median) : null;
    const count = r?.report_count ?? 0;
    return {
      crowdValue:
        median != null && count >= TEMP_CROWD_THRESHOLD
          ? Math.round(median)
          : null,
      reportCount: count,
      latestReportAt: r?.latest_report_at ?? null,
    };
  };

  return { saunaRoom: cell("sauna_room"), coldBath: cell("cold_bath") };
}
