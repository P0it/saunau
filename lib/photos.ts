"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { SaunaPhoto } from "@/lib/data/types";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * 사용자 사진 — 업로드(모더레이션 라우트 경유)·신고(클라 직접 insert).
 * 업로드는 RLS 상 클라 직접 insert 불가 → /api/photos 가 service_role 로 모더레이션 후 단일 게시.
 * 신고는 RLS(auth.uid()=user_id) 로 허용되며, 임계치 도달 시 트리거가 자동 비활성화한다.
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

/**
 * 사진 업로드 → 모더레이션 → 통과 시 즉시 게시. FormData 로 라우트에 전송.
 * reviewId 를 주면 후기 첨부 사진으로 게시(갤러리엔 안 뜨고 후기 카드에만 보인다).
 */
export async function uploadUserPhoto(
  saunaId: string,
  file: File,
  reviewId?: string,
): Promise<UploadResult> {
  const form = new FormData();
  form.append("sauna_id", saunaId);
  form.append("file", file);
  if (reviewId) form.append("review_id", reviewId);
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

/**
 * 본인 업로드 사진 삭제. RLS(source='user' and uploaded_by=auth.uid())로 허용.
 * DB 행만 지운다(Storage 객체는 관리자 정리와 동일하게 남겨둠 — 회귀 없음). 성공 시 true.
 */
export async function deleteUserPhoto(photoId: string): Promise<boolean> {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase
    .from("sauna_photos")
    .delete()
    .eq("id", photoId);
  return !error;
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
