"use client";

import { useState } from "react";

export type SaunaTab = {
  key: string;
  label: string;
  /** 우측에 작은 카운트 배지(후기 수 등). 0/없으면 숨김. */
  count?: number;
  /**
   * 패널 내용. 함수로 주면 다른 탭으로 이동하는 goTo 를 받는다
   * (상세 탭의 "후기 모두 보기" → 후기 탭 전환 등).
   */
  content: React.ReactNode | ((goTo: (key: string) => void) => React.ReactNode);
};

/**
 * 상세 화면 탭 — 상세 정보 / 후기 등(네이버 지도식).
 * 서버 컴포넌트에서 렌더한 섹션을 content 로 받아 클라이언트에서 전환만 담당.
 * 비활성 패널은 hidden(언마운트하지 않음)으로 스크롤 위치·상태 보존.
 * 활성 표시(밑줄·배지)는 브랜드 색으로 통일한다.
 */
export function SaunaTabs({ tabs }: { tabs: SaunaTab[] }) {
  const [active, setActive] = useState(tabs[0]?.key);
  const goTo = (key: string) => setActive(key);

  return (
    <div>
      {/* 탭 바 — 스크롤 시 상단 고정 */}
      <div className="sticky top-0 z-10 -mx-[20px] flex gap-[20px] border-b border-line bg-frame px-[20px]">
        {tabs.map((t) => {
          const on = active === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setActive(t.key)}
              className={`relative -mb-px flex items-center gap-[6px] py-[13px] text-[15px] font-semibold transition-colors ${
                on ? "text-brand" : "text-tab-idle"
              }`}
            >
              {t.label}
              {t.count != null && t.count > 0 && (
                <span
                  className={`inline-flex min-w-[18px] items-center justify-center rounded-full px-[5px] py-[1px] text-[11px] font-semibold tabular-nums ${
                    on ? "bg-brand text-white" : "bg-line text-muted"
                  }`}
                >
                  {t.count}
                </span>
              )}
              {on && (
                <span className="absolute inset-x-0 -bottom-px h-[2px] rounded-full bg-brand" />
              )}
            </button>
          );
        })}
      </div>

      {tabs.map((t) => (
        <div
          key={t.key}
          className={
            active === t.key ? "flex flex-col gap-[28px] pt-[20px]" : "hidden"
          }
        >
          {typeof t.content === "function" ? t.content(goTo) : t.content}
        </div>
      ))}
    </div>
  );
}
