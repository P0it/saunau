"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { uploadPhoto } from "@/lib/photos";

const REASON_LABEL: Record<string, string> = {
  forbidden: "운영자 계정에서만 등록할 수 있어요.",
  unsupported_type: "JPG·PNG·WEBP 이미지만 올릴 수 있어요.",
  too_large: "12MB 이하 이미지만 올릴 수 있어요.",
  sauna_not_found: "매장을 찾을 수 없어요.",
};

const MAX_BATCH = 10; // 한 번에 올릴 수 있는 사진 수

/**
 * 매장 사진 등록 — **운영자에게만 렌더된다**(갤러리 위 카메라 버튼).
 * 일반 회원 업로드는 데이터 오염 때문에 닫아둔 상태 → 이 버튼도 관리자 전용.
 * 권한은 서버(/api/photos)가 ADMIN_EMAILS 로 최종 강제하므로 이건 표시 편의일 뿐.
 * 업로드 성공 시 router.refresh() 로 갤러리를 갱신한다.
 */
export function AdminPhotoUpload({ saunaId }: { saunaId: string }) {
  const { isAdmin } = useAuth();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  if (!isAdmin) return null;

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).slice(0, MAX_BATCH);
    e.target.value = ""; // 같은 파일 재선택 허용
    if (files.length === 0 || busy) return;
    setBusy(true);
    setToast(null);
    // 검증·정규화는 라우트가 파일별로 처리 → 순차 업로드.
    let ok = 0;
    let lastReason = "";
    for (const file of files) {
      const res = await uploadPhoto(saunaId, file);
      if (res.ok) ok += 1;
      else lastReason = res.reason ?? "";
    }
    setBusy(false);
    if (ok > 0) {
      const failed = files.length - ok;
      setToast(
        failed > 0 ? `${ok}장 등록 · ${failed}장 실패` : `${ok}장 등록됐어요`,
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
        aria-label="사진 등록(운영자)"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="flex h-[38px] items-center gap-[6px] rounded-full bg-white/85 px-[14px] text-[13px] font-semibold text-ink shadow-[0_1px_6px_rgba(0,0,0,0.12)] backdrop-blur active:scale-95 disabled:opacity-60"
      >
        {busy ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <Camera size={16} />
        )}
        {busy ? "올리는 중…" : "사진 등록"}
      </button>

      {toast && (
        <div className="pointer-events-none fixed bottom-[88px] left-1/2 z-[80] -translate-x-1/2 rounded-full bg-black/80 px-[16px] py-[9px] text-[13px] font-medium text-white">
          {toast}
        </div>
      )}
    </>
  );
}
