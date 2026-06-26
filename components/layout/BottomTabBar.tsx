"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { House, LayoutList, User } from "lucide-react";

/** 하단 탭 3개 — 홈 / 목록 / 마이. */
const TABS = [
  { href: "/", label: "홈", icon: House, match: (p: string) => p === "/" },
  {
    href: "/list",
    label: "목록",
    icon: LayoutList,
    match: (p: string) => p.startsWith("/list") || p.startsWith("/map"),
  },
  {
    href: "/my",
    label: "마이",
    icon: User,
    match: (p: string) => p.startsWith("/my") || p.startsWith("/favorites"),
  },
] as const;

export function BottomTabBar() {
  const pathname = usePathname();

  return (
    <nav className="flex w-full flex-none border-t border-line-soft bg-card px-0 pt-[9px] pb-[14px]">
      {TABS.map(({ href, label, icon: Icon, match }) => {
        const active = match(pathname);
        return (
          <Link
            key={href}
            href={href}
            className="flex flex-1 flex-col items-center gap-[3px]"
            style={{ color: active ? "var(--color-brand)" : "var(--color-tab-idle)" }}
          >
            <Icon size={24} />
            <span className="text-[11px] font-semibold">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
