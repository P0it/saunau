"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { uploadUserPhoto } from "@/lib/photos";
import { LoginSheet } from "@/components/auth/LoginSheet";

const REASON_LABEL: Record<string, string> = {
  moderation_unavailable: "사진 검수 기능이 준비 중이에요. 잠시 후 다시 시도해주세요.",
  blocked_adult: "부적절한 사진으로 판단돼 등록되지 않았어요.",
  blocked_violence: "부적절한 사진으로 판단돼 등록되지 않았어요.",
  blocked_racy: "부적절한 사진으로 판단돼 등록되지 않았어요.",
  unsupported_type: "JPG·PNG·WEBP 이미지만 올릴 수 있어요.",
  too_large: "12MB 이하 이미지만 올릴 수 있어요.",
  rate_limited: "오늘 업로드 한도를 초과했어요. 내일 다시 시도해주세요.",
};

const MAX_BATCH = 5; // 한 번에 올릴 수 있는 사진 수

/**
 * 사용자 사진 추가 — 갤러리 위 카메라 버튼. 로그인 게이트.
 * 업로드 → /api/photos(모더레이션) → 통과 시 즉시 게시 → router.refresh() 로 갤러리 갱신.
 */
export function UserPhotoUpload({ saunaId }: { saunaId: string }) {
  const { user } = useAuth();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const pick = () => {
    if (!user) {
      setLoginOpen(true);
      return;
    }
    inputRef.current?.click();
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).slice(0, MAX_BATCH);
    e.target.value = ""; // 같은 파일 재선택 허용
    if (files.length === 0 || busy) return;
    setBusy(true);
    setToast(null);
    // 모더레이션·레이트리밋은 라우트가 파일별로 처리 → 순차 업로드.
    let ok = 0;
    let lastReason = "";
    for (const file of files) {
      const res = await uploadUserPhoto(saunaId, file);
      if (res.ok) ok += 1;
      else lastReason = res.reason ?? "";
    }
    setBusy(false);
    if (ok > 0) {
      const failed = files.length - ok;
      setToast(
        failed > 0
          ? `${ok}장 등록됐어요 · ${failed}장 실패`
          : "사진이 등록됐어요. 고마워요!",
      );
      router.refresh();
    } else {
      setToast(REASON_LABEL[lastReason] ?? "업로드에 실패했어요. 다시 시도해주세요.");
    }
    setTimeout(() => setToast(null), 3000);
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={onFile}
      />
      <button
        type="button"
        aria-label="사진 추가"
        onClick={pick}
        disabled={busy}
        className="flex h-[38px] items-center gap-[6px] rounded-full bg-white/85 px-[14px] text-[13px] font-semibold text-ink shadow-[0_1px_6px_rgba(0,0,0,0.12)] backdrop-blur active:scale-95 disabled:opacity-60"
      >
        {busy ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <Camera size={16} />
        )}
        {busy ? "올리는 중…" : "사진 추가"}
      </button>

      {toast && (
        <div className="pointer-events-none fixed bottom-[88px] left-1/2 z-[80] -translate-x-1/2 rounded-full bg-black/80 px-[16px] py-[9px] text-[13px] font-medium text-white">
          {toast}
        </div>
      )}

      <LoginSheet open={loginOpen} onClose={() => setLoginOpen(false)} />
    </>
  );
}
