"use client";

import { usePathname } from "next/navigation";
import { BottomTabBar } from "./BottomTabBar";

/**
 * App-shell 레이아웃 — 뷰포트 높이에 고정된 프레임. 가운데 main만 내부 스크롤,
 * 하단 탭바는 항상 화면 하단에 고정.
 * 폭: 기본은 430px 중앙 프레임(데스크톱 외곽 배경 분리). 지도 뷰(/map)는 풀블리드.
 */
export function AppFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const fullBleed = pathname.startsWith("/map");

  return (
    <div
      className={
        fullBleed
          ? "flex h-dvh w-full flex-col overflow-hidden bg-frame"
          : "mx-auto flex h-dvh w-full max-w-[430px] flex-col overflow-hidden bg-frame shadow-[0_8px_28px_rgba(0,0,0,0.08)]"
      }
    >
      <main className="no-scrollbar relative flex min-h-0 flex-1 flex-col overflow-y-auto">
        {children}
      </main>
      <BottomTabBar />
    </div>
  );
}
