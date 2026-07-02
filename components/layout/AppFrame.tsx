"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { BottomTabBar } from "./BottomTabBar";
import { SplashScreen, SPLASH_TOTAL_MS } from "./SplashScreen";
import { requestLocationOnce } from "@/lib/geo";

/**
 * App-shell 레이아웃 — 뷰포트 높이에 고정된 프레임. 가운데 main만 내부 스크롤,
 * 하단 탭바는 항상 화면 하단에 고정.
 * 폭: 기본은 430px 중앙 프레임(데스크톱 외곽 배경 분리). 지도 뷰(/map)는 풀블리드.
 */
export function AppFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const fullBleed = pathname.startsWith("/map");

  // 앱 로드 시 1회 위치 동의 — "내 주변"이 내 위치 기준으로 열리도록 좌표를 캐시.
  // 스플래시가 완전히 사라진 뒤 요청해야 권한 프롬프트가 로딩 화면을 가리지 않는다.
  useEffect(() => {
    const timer = setTimeout(requestLocationOnce, SPLASH_TOTAL_MS);
    return () => clearTimeout(timer);
  }, []);

  return (
    <>
      <SplashScreen fullBleed={fullBleed} />
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
    </>
  );
}
