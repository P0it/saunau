"use client";

import { useState } from "react";
import { Thermometer, Lock } from "lucide-react";
import { SaunaRoomArt, ColdBathArt } from "./TempArt";
import { TempReportSheet } from "./TempReportSheet";
import { LoginSheet } from "@/components/auth/LoginSheet";
import { useAuth } from "@/lib/auth";
import type { TempInfo, TempStat } from "@/lib/data/types";
import type { CrowdTempInfo } from "@/lib/tempReports";

/** 데이터가 없을 때 사용하는 기본값(TempHeadline 과 동일). */
const DEFAULT_SAUNA_TEMP = 90;
const DEFAULT_COLD_TEMP = 20;

type Gender = "male" | "female";
const GENDERS: { key: Gender; label: string; active: string }[] = [
  { key: "male", label: "남탕", active: "bg-cold text-white" }, // 남=파랑
  { key: "female", label: "여탕", active: "bg-hot text-white" }, // 여=빨강
];

/** 제보 시각 → 상대 표기("오늘"/"N일 전"/"N주 전"). 없으면 빈 문자열. */
function relativeTime(iso: string | null): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const days = Math.floor((Date.now() - then) / 86_400_000);
  if (days <= 0) return "오늘";
  if (days < 7) return `${days}일 전`;
  if (days < 30) return `${Math.floor(days / 7)}주 전`;
  return `${Math.floor(days / 30)}개월 전`;
}

/** crowd 재조회 결과를 기존 TempInfo 에 병합(seed 폴백 유지). */
function mergeCrowd(info: TempInfo, crowd: CrowdTempInfo): TempInfo {
  const apply = (
    cell: TempStat,
    c: CrowdTempInfo["male"]["saunaRoom"],
  ): TempStat => {
    const displayValue = c.crowdValue ?? cell.seedValue ?? null;
    return {
      ...cell,
      crowdValue: c.crowdValue,
      displayValue,
      source:
        c.crowdValue != null
          ? "crowd"
          : cell.seedValue != null
            ? "editor"
            : "none",
      reportCount: c.reportCount,
      latestReportAt: c.latestReportAt,
    };
  };
  return {
    male: {
      saunaRoom: apply(info.male.saunaRoom, crowd.male.saunaRoom),
      coldBath: apply(info.male.coldBath, crowd.male.coldBath),
    },
    female: {
      saunaRoom: apply(info.female.saunaRoom, crowd.female.saunaRoom),
      coldBath: apply(info.female.coldBath, crowd.female.coldBath),
    },
  };
}

/**
 * 상세 화면 히어로 — 사우나실/냉탕 온도를 카드 중앙에 크게 두 칸으로.
 * 표시값은 "제보 + 자동 집계": 최근 30일 회원 제보 median(임계치 이상) → 에디터 시딩 → 기본값.
 * 상단 남탕/여탕 토글로 탕별 전환. 하단에서 로그인 후 직접 "온도 제보" 가능.
 */
export function TempHero({
  tempInfo,
  saunaId,
}: {
  tempInfo: TempInfo;
  saunaId: string;
}) {
  const { user } = useAuth();
  const [gender, setGender] = useState<Gender>("male");
  const [info, setInfo] = useState<TempInfo>(tempInfo);
  const [reportOpen, setReportOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);

  const room = info[gender].saunaRoom;
  const cold = info[gender].coldBath;

  const isEstimate = room.displayValue == null && cold.displayValue == null;
  const saunaVal = room.displayValue ?? DEFAULT_SAUNA_TEMP;
  const coldVal = cold.displayValue ?? DEFAULT_COLD_TEMP;

  const anyCrowd = room.source === "crowd" || cold.source === "crowd";
  const reportCount = Math.max(room.reportCount, cold.reportCount);
  const latest =
    [room.latestReportAt, cold.latestReportAt].filter(Boolean).sort().pop() ??
    null;
  const genderLabel = gender === "male" ? "남탕" : "여탕";

  const footer = isEstimate
    ? "온도 확인 중 · 제보로 채워질 예정이에요"
    : anyCrowd
      ? `${genderLabel} 기준 · 회원 ${reportCount}명 제보${
          relativeTime(latest) ? ` · ${relativeTime(latest)}` : ""
        }`
      : `${genderLabel} 기준 · 제보로 보정 예정`;

  const openReport = () => {
    if (user) setReportOpen(true);
    else setLoginOpen(true);
  };

  return (
    <div className="rounded-[20px] bg-card p-[24px] shadow-[0_2px_12px_rgba(0,0,0,0.05)]">
      {/* 남탕/여탕 토글 — 세그먼트 컨트롤 */}
      <div
        role="tablist"
        aria-label="남탕 여탕 선택"
        className="mx-auto mb-[20px] flex w-fit items-center gap-[2px] rounded-full bg-[#F2F0ED] p-[3px]"
      >
        {GENDERS.map((g) => {
          const active = g.key === gender;
          return (
            <button
              key={g.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setGender(g.key)}
              className={`rounded-full px-[18px] py-[6px] text-[13px] font-semibold transition-colors ${
                active
                  ? `${g.active} shadow-[0_1px_4px_rgba(0,0,0,0.14)]`
                  : "text-muted"
              }`}
            >
              {g.label}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-2 divide-x divide-line">
        <Column
          art={<SaunaRoomArt size={58} />}
          label="사우나실"
          temp={saunaVal}
          tone="hot"
          crowd={room.source === "crowd"}
        />
        <Column
          art={<ColdBathArt size={58} />}
          label="냉탕"
          temp={coldVal}
          tone="cold"
          crowd={cold.source === "crowd"}
        />
      </div>

      <div className="mt-[16px] text-center text-[11px] text-muted">{footer}</div>

      {/* 온도 제보 진입 — 로그인 게이트 */}
      <button
        type="button"
        onClick={openReport}
        className="mt-[14px] flex h-[44px] w-full items-center justify-center gap-[6px] rounded-[14px] border border-dashed border-[#DAD6CF] bg-[#FBFAF8] text-[13px] font-semibold text-ink"
      >
        {user ? <Thermometer size={16} /> : <Lock size={14} />}
        {user ? "온도 제보하기" : "로그인하고 온도 제보하기"}
      </button>

      {user && reportOpen && (
        <TempReportSheet
          open
          onClose={() => setReportOpen(false)}
          saunaId={saunaId}
          userId={user.id}
          gender={gender}
          onDone={(crowd) => setInfo((cur) => mergeCrowd(cur, crowd))}
        />
      )}
      <LoginSheet open={loginOpen} onClose={() => setLoginOpen(false)} />
    </div>
  );
}

function Column({
  art,
  label,
  temp,
  tone,
  crowd,
}: {
  art: React.ReactNode;
  label: string;
  temp: number;
  tone: "hot" | "cold";
  crowd: boolean;
}) {
  const color = tone === "hot" ? "text-hot" : "text-cold";
  return (
    <div className="flex flex-col items-center gap-[10px] px-[12px]">
      <div className="flex h-[58px] w-[58px] items-center justify-center">
        {art}
      </div>
      <div className="flex items-center gap-[5px]">
        <span className="text-[14px] font-semibold text-ink">{label}</span>
        {crowd && (
          <span className="rounded-full bg-[#EEF0F2] px-[6px] py-[1px] text-[10px] font-semibold text-muted">
            제보
          </span>
        )}
      </div>
      <div className={`flex items-baseline gap-[2px] ${color}`}>
        <span className="text-[42px] font-bold leading-none tabular-nums">
          {temp}
        </span>
        <span className="text-[18px] font-bold">°</span>
      </div>
    </div>
  );
}
