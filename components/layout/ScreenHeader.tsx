"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";

/** 서브 화면 공통 헤더 — 뒤로가기 + 타이틀 + (선택) 우측 액션. */
export function ScreenHeader({
  title,
  right,
  className,
}: {
  title?: string;
  right?: React.ReactNode;
  /** 헤더 배경 등 오버라이드(기본: bg-frame/90). */
  className?: string;
}) {
  const router = useRouter();
  return (
    <header
      className={`sticky top-0 z-20 flex h-[52px] flex-none items-center justify-between border-b border-line-soft px-[8px] backdrop-blur ${
        className ?? "bg-frame/90"
      }`}
    >
      <button
        type="button"
        aria-label="뒤로"
        onClick={() => router.back()}
        className="flex h-[40px] w-[40px] items-center justify-center text-ink"
      >
        <ChevronLeft size={24} />
      </button>
      {title && (
        <span className="text-[16px] font-semibold text-ink">{title}</span>
      )}
      <div className="flex h-[40px] min-w-[40px] items-center justify-end pr-[6px]">
        {right}
      </div>
    </header>
  );
}
