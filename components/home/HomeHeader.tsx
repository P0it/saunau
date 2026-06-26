import Link from "next/link";
import { Search, Bell, Menu } from "lucide-react";

/** 홈 헤더 — 워드마크(빨강) + 검색/알림/메뉴. */
export function HomeHeader() {
  return (
    <header className="flex flex-none items-center justify-between px-[20px] pb-[12px] pt-[14px]">
      <span className="whitespace-nowrap text-[25px] font-black tracking-[-0.055em] text-brand">
        사우나우
      </span>
      <div className="flex items-center gap-[4px] text-ink">
        <Link
          href="/search"
          aria-label="검색"
          className="flex h-[40px] w-[40px] items-center justify-center"
        >
          <Search size={23} />
        </Link>
        <button
          type="button"
          aria-label="알림"
          className="relative flex h-[40px] w-[40px] items-center justify-center"
        >
          <Bell size={23} />
          <span className="absolute right-[10px] top-[9px] h-[7px] w-[7px] rounded-full border-[1.5px] border-frame bg-brand" />
        </button>
        <button
          type="button"
          aria-label="메뉴"
          className="flex h-[40px] w-[40px] items-center justify-center"
        >
          <Menu size={23} />
        </button>
      </div>
    </header>
  );
}
