"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { SaunaPhoto } from "@/lib/data/types";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * 매장 사진 — 등록(운영자 전용)·숨김(운영자)·신고(회원).
 *
 * ⚠ 사진 등록은 운영자만 한다. 일반 회원 업로드는 데이터 오염(무관·중복·저화질)
 *   때문에 닫아두었다 — 서버 강제 지점은 /api/photos.
 * 신고는 RLS(auth.uid()=user_id) 로 회원 누구나 가능하며, 임계치 도달 시
 * 트리거가 해당 사진을 자동 비활성화한다.
 */

export type PhotoReportReason =
  | "not_sauna"
  | "offensive"
  | "privacy"
  | "spam"
  | "other";

export interface UploadResult {
  ok: boolean;
  photo?: SaunaPhoto;
  reason?: string; // 거부/오류 사유 코드
}

/** 운영자: 매장 사진 등록. 권한은 서버(/api/photos)가 ADMIN_EMAILS 로 최종 강제. */
export async function uploadPhoto(
  saunaId: string,
  file: File,
): Promise<UploadResult> {
  const form = new FormData();
  form.append("sauna_id", saunaId);
  form.append("file", file);
  try {
    const res = await fetch("/api/photos", { method: "POST", body: form });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, reason: json?.reason ?? `http_${res.status}` };
    }
    return { ok: true, photo: json.photo as SaunaPhoto };
  } catch {
    return { ok: false, reason: "network_error" };
  }
}

/** 관리자: 사진 숨김(soft delete). 서버에서 ADMIN_EMAILS 로 권한 강제. 성공 시 true. */
export async function adminHidePhoto(photoId: string): Promise<boolean> {
  try {
    const res = await fetch("/api/admin/photos", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ photoId, action: "hide" }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** 사진 신고(1인 1신고/사진). 로그인 필요(RLS). 성공 시 true. */
export async function reportPhoto(
  photoId: string,
  userId: string,
  reason: PhotoReportReason,
  note?: string,
): Promise<boolean> {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.from("photo_reports").insert({
    photo_id: photoId,
    user_id: userId,
    reason,
    note: note?.trim() || null,
  });
  // 중복 신고(unique 위반)도 사용자 관점엔 "신고됨"으로 처리.
  if (error && (error as any).code !== "23505") return false;
  return true;
}
