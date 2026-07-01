"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HomeTabIcon, FindTabIcon, MyTabIcon } from "./TabIcons";
import { ScrubberIcon } from "@/components/sauna/ScrubberIcon";

/** 하단 탭 4개 — 홈 / 찾기 / 찜(때수건) / 마이. 플랫 컬러 일러스트로 통일. */
const TABS: {
  href: string;
  label: string;
  match: (p: string) => boolean;
  Icon: (props: { size?: number }) => React.ReactNode;
}[] = [
  {
    href: "/",
    label: "홈",
    match: (p) => p === "/",
    Icon: ({ size }) => <HomeTabIcon size={size} />,
  },
  {
    href: "/list",
    label: "찾기",
    match: (p) => p.startsWith("/list") || p.startsWith("/map"),
    Icon: ({ size }) => <FindTabIcon size={size} />,
  },
  {
    href: "/favorites",
    label: "찜",
    match: (p) => p.startsWith("/favorites"),
    Icon: ({ size }) => <ScrubberIcon size={size} filled />,
  },
  {
    href: "/my",
    label: "마이",
    match: (p) => p.startsWith("/my"),
    Icon: ({ size }) => <MyTabIcon size={size} />,
  },
];

export function BottomTabBar() {
  const pathname = usePathname();

  return (
    <nav className="flex w-full flex-none border-t border-line-soft bg-card px-0 pt-[8px] pb-[14px]">
      {TABS.map(({ href, label, match, Icon }) => {
        const active = match(pathname);
        return (
          <Link
            key={href}
            href={href}
            className="flex flex-1 flex-col items-center gap-[3px]"
          >
            {/* 활성=풀컬러 / 비활성=회색조로 살짝 죽인다 */}
            <span
              className={
                active
                  ? "transition-[filter,opacity]"
                  : "opacity-55 grayscale transition-[filter,opacity]"
              }
            >
              <Icon size={26} />
            </span>
            <span
              className="text-[11px] font-semibold"
              style={{
                color: active ? "var(--color-brand)" : "var(--color-tab-idle)",
              }}
            >
              {label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
