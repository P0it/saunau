"use client";

import { useState } from "react";
import { Clock, ChevronDown } from "lucide-react";
import {
  DAY_KEYS,
  DAY_LABEL,
  type WeekHours,
  type DayKey,
  type DayHours,
} from "@/lib/data/types";

/** JS Date.getDay()(0=일) → DayKey. */
const JS_DAY_TO_KEY: DayKey[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

function fmtDay(d: DayHours | null): string {
  if (!d) return "휴무";
  return `${d.start}~${d.end}${d.overnight ? " (익일)" : ""}`;
}

/**
 * 영업시간 행. 요일별(hours_json) 데이터가 있으면 "오늘 ○○" + 펼치면 월~일 표(오늘 강조).
 * 24시간/요약/없음은 단순 한 줄(기존 InfoRow 와 동일한 외형).
 */
export function BusinessHours({
  hours,
  hoursJson,
}: {
  hours: string | null;
  hoursJson: WeekHours | null;
}) {
  const [open, setOpen] = useState(false);
  const perDay = hoursJson && !hoursJson.is24h ? hoursJson.days : null;

  // 요일별 없음 → 단순 행(24h 요약 또는 hours 텍스트 또는 정보 없음)
  if (!perDay) {
    const value = hoursJson?.is24h
      ? hoursJson.summary
      : (hours ?? "정보 없음");
    return (
      <Shell>
        <RowFace label="영업시간">
          <span className="flex-1 break-keep text-right text-[14px] font-semibold text-ink">
            {value}
          </span>
        </RowFace>
      </Shell>
    );
  }

  const todayKey = JS_DAY_TO_KEY[new Date().getDay()];
  const today = perDay[todayKey];

  return (
    <Shell>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-[12px] py-[14px] text-left"
      >
        <span className="text-muted">
          <Clock size={18} />
        </span>
        <span className="w-[68px] shrink-0 text-[13px] text-muted">영업시간</span>
        <span className="flex-1 break-keep text-right text-[14px] font-semibold text-ink">
          오늘 {fmtDay(today)}
        </span>
        <ChevronDown
          size={16}
          className={`shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <ul className="pb-[12px] pl-[42px] pr-[2px]">
          {DAY_KEYS.map((k) => {
            const d = perDay[k];
            const isToday = k === todayKey;
            return (
              <li
                key={k}
                className={`flex items-baseline justify-between gap-[10px] py-[5px] text-[13px] ${
                  isToday ? "font-bold text-ink" : "text-muted"
                }`}
              >
                <span className="shrink-0">
                  {DAY_LABEL[k]}
                  {isToday && <span className="ml-[4px] text-[11px] text-dot">오늘</span>}
                </span>
                <span className="break-keep text-right">
                  {fmtDay(d)}
                  {d?.break && (
                    <span className="block text-[11px] font-normal text-dot">
                      브레이크 {d.break}
                    </span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Shell>
  );
}

/** InfoRow 와 같은 구분선 컨테이너(카드 내 첫 행). */
function Shell({ children }: { children: React.ReactNode }) {
  return <div className="border-b border-line last:border-b-0">{children}</div>;
}

function RowFace({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-[12px] py-[14px]">
      <span className="text-muted">
        <Clock size={18} />
      </span>
      <span className="w-[68px] shrink-0 text-[13px] text-muted">{label}</span>
      {children}
    </div>
  );
}
