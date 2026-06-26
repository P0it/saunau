"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";

/** 사진 위에 떠 있는 뒤로가기 버튼. */
export function FloatingBack() {
  const router = useRouter();
  return (
    <button
      type="button"
      aria-label="뒤로"
      onClick={() => router.back()}
      className="flex h-[38px] w-[38px] items-center justify-center rounded-full bg-white/85 text-ink shadow-[0_1px_6px_rgba(0,0,0,0.12)] backdrop-blur"
    >
      <ChevronLeft size={22} />
    </button>
  );
}
