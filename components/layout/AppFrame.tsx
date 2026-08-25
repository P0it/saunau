"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { BottomTabBar } from "./BottomTabBar";
import { SplashScreen, SPLASH_TOTAL_MS } from "./SplashScreen";
import { requestLocationOnce } from "@/lib/geo";
import { useAuth } from "@/lib/auth";

/**
 * App-shell 레이아웃 — 뷰포트 높이에 고정된 프레임. 가운데 main만 내부 스크롤,
 * 하단 탭바는 항상 화면 하단에 고정.
 * 폭: 기본은 430px 중앙 프레임(데스크톱 외곽 배경 분리). 지도 뷰(/map)는 풀블리드.
 */

/** 가입 절차 중에도 열려야 하는 경로 — 온보딩 자신, 약관 열람, 인증 콜백. */
const ONBOARDING_ALLOWED = ["/welcome", "/terms", "/privacy", "/auth"];

export function AppFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const fullBleed = pathname.startsWith("/map");
  const onboarding = pathname.startsWith("/welcome");

  const { loading: authLoading, user, onboarded } = useAuth();

  // 앱 로드 시 1회 위치 동의 — "내 주변"이 내 위치 기준으로 열리도록 좌표를 캐시.
  // 스플래시가 완전히 사라진 뒤 요청해야 권한 프롬프트가 로딩 화면을 가리지 않는다.
  useEffect(() => {
    const timer = setTimeout(requestLocationOnce, SPLASH_TOTAL_MS);
    return () => clearTimeout(timer);
  }, []);

  // 가입 절차 게이트 — 로그인은 했지만 약관 동의·닉네임이 없으면 /welcome 으로.
  // authLoading 동안에는 판정을 보류한다(첫 페인트에 깜빡이며 튕기는 것을 막음).
  useEffect(() => {
    if (authLoading || !user || onboarded) return;
    if (ONBOARDING_ALLOWED.some((p) => pathname.startsWith(p))) return;
    router.replace("/welcome");
  }, [authLoading, user, onboarded, pathname, router]);

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
        {/* 가입 절차 중에는 탭바를 감춘다 — 어차피 게이트가 다른 화면을 막는다. */}
        {!onboarding && <BottomTabBar />}
      </div>
    </>
  );
}
