import Link from "next/link";
import { Search } from "lucide-react";
import { Logo } from "@/components/layout/Logo";

/** 홈 헤더 — 좌측 로고(마크 + 빨강 워드마크) + 우측 검색. */
export function HomeHeader() {
  return (
    <header className="flex flex-none items-center justify-between px-[20px] pb-[12px] pt-[16px]">
      <Logo size={30} />
      <div className="flex items-center gap-[2px] text-ink">
        <Link
          href="/search"
          aria-label="검색"
          className="flex h-[40px] w-[40px] items-center justify-center"
        >
          <Search size={23} />
        </Link>
      </div>
    </header>
  );
}
