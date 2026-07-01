"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Flag, X } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { reportPhoto, type PhotoReportReason } from "@/lib/photos";
import { LoginSheet } from "@/components/auth/LoginSheet";

const REASONS: { key: PhotoReportReason; label: string }[] = [
  { key: "not_sauna", label: "사우나와 무관한 사진" },
  { key: "offensive", label: "부적절·혐오 사진" },
  { key: "privacy", label: "사생활 침해" },
  { key: "spam", label: "스팸·광고" },
  { key: "other", label: "기타" },
];

/**
 * 사진 신고 — 갤러리 현재 사진 위 오버레이 버튼. 로그인 게이트.
 * 신고는 클라 직접 insert(RLS), 임계치(3) 도달 시 트리거가 자동 비활성화한다.
 * 신고 후 router.refresh() 로 (자동 내림된 경우) 갤러리에서 사라지게 한다.
 */
export function PhotoReportButton({ photoId }: { photoId: string }) {
  const { user } = useAuth();
  const router = useRouter();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const open = () => {
    if (user) setSheetOpen(true);
    else setLoginOpen(true);
  };

  const submit = async (reason: PhotoReportReason) => {
    if (!user || busy) return;
    setBusy(true);
    const ok = await reportPhoto(photoId, user.id, reason);
    setBusy(false);
    if (ok) {
      setDone(true);
      setTimeout(() => {
        setSheetOpen(false);
        router.refresh();
      }, 900);
    }
  };

  return (
    <>
      <button
        type="button"
        aria-label="사진 신고"
        onClick={open}
        className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-black/35 text-white backdrop-blur active:scale-95"
      >
        <Flag size={15} />
      </button>

      {sheetOpen && (
        <div className="fixed inset-0 z-[70] mx-auto flex max-w-[430px] flex-col justify-end bg-[rgba(20,18,16,.42)]">
          <div
            className="absolute inset-0"
            onClick={() => setSheetOpen(false)}
            aria-hidden
          />
          <div className="relative flex flex-col overflow-hidden rounded-t-[22px] bg-card">
            <div className="flex justify-center pb-[4px] pt-[10px]">
              <div className="h-[4px] w-[38px] rounded-full bg-[#E2DFD9]" />
            </div>
            <div className="flex items-center justify-between px-[20px] pb-[8px] pt-[10px]">
              <span className="text-[17px] font-bold text-ink">사진 신고</span>
              <button
                type="button"
                aria-label="닫기"
                onClick={() => setSheetOpen(false)}
              >
                <X size={24} className="text-ink" />
              </button>
            </div>
            <div className="px-[20px] pb-[28px] pt-[6px]">
              {done ? (
                <p className="py-[18px] text-center text-[14px] font-semibold text-ink">
                  신고가 접수됐어요. 검토 후 조치할게요.
                </p>
              ) : (
                <>
                  <p className="mb-[10px] text-[13px] leading-[1.6] text-muted">
                    신고 사유를 선택해주세요. 여러 신고가 모이면 자동으로 가려집니다.
                  </p>
                  <div className="flex flex-col">
                    {REASONS.map((r) => (
                      <button
                        key={r.key}
                        type="button"
                        disabled={busy}
                        onClick={() => submit(r.key)}
                        className="flex items-center border-b border-line py-[14px] text-left text-[14px] font-medium text-ink last:border-b-0 disabled:opacity-40"
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <LoginSheet open={loginOpen} onClose={() => setLoginOpen(false)} />
    </>
  );
}
