"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { adminHidePhoto } from "@/lib/photos";

/**
 * 관리자 전용 — 현재 갤러리 사진을 숨김(soft delete). 관리자에게만 렌더된다.
 * 권한은 서버(/api/admin/photos)가 ADMIN_EMAILS 로 최종 강제하므로, 이 버튼은 표시 편의일 뿐.
 * 숨김 성공 시 router.refresh() 로 갤러리에서 즉시 사라지게 한다.
 */
export function AdminPhotoHideButton({ photoId }: { photoId: string }) {
  const { isAdmin } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  if (!isAdmin) return null;

  const onClick = async () => {
    if (busy) return;
    if (!window.confirm("이 사진을 숨길까요? (갤러리에서 가려지며 나중에 되돌릴 수 있어요)")) {
      return;
    }
    setBusy(true);
    const ok = await adminHidePhoto(photoId);
    setBusy(false);
    if (ok) router.refresh();
    else window.alert("숨김 처리에 실패했어요. 다시 시도해주세요.");
  };

  return (
    <button
      type="button"
      aria-label="사진 숨기기(관리자)"
      onClick={onClick}
      disabled={busy}
      className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-red-600/80 text-white backdrop-blur active:scale-95 disabled:opacity-60"
    >
      {busy ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
    </button>
  );
}
