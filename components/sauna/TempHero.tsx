"use client";

import { useState } from "react";
import { Thermometer, Lock } from "lucide-react";
import { SaunaRoomArt, ColdBathArt } from "./TempArt";
import { TempReportSheet } from "./TempReportSheet";
import { LoginSheet } from "@/components/auth/LoginSheet";
import { useAuth } from "@/lib/auth";
import type { TempInfo, TempStat } from "@/lib/data/types";
import type { CrowdTempInfo } from "@/lib/tempReports";

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
  const apply = (cell: TempStat, c: CrowdTempInfo["saunaRoom"]): TempStat => {
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
    saunaRoom: apply(info.saunaRoom, crowd.saunaRoom),
    coldBath: apply(info.coldBath, crowd.coldBath),
  };
}

/**
 * 상세 화면 히어로 — 사우나실/냉탕 온도를 카드 중앙에 크게 두 칸으로.
 * 표시값은 "제보 + 자동 집계": 최근 30일 회원 제보 median(임계치 이상) → 에디터 시딩 → 없음.
 * 값이 없으면 숫자를 지어내지 않고 "—" 로 비운다(추정치를 실측처럼 보이게 하지 않는다).
 * 하단에서 로그인 후 직접 "온도 제보" 가능.
 */
export function TempHero({
  tempInfo,
  saunaId,
}: {
  tempInfo: TempInfo;
  saunaId: string;
}) {
  const { user } = useAuth();
  const [info, setInfo] = useState<TempInfo>(tempInfo);
  const [reportOpen, setReportOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);

  const room = info.saunaRoom;
  const cold = info.coldBath;

  const isEmpty = room.displayValue == null && cold.displayValue == null;
  const anyCrowd = room.source === "crowd" || cold.source === "crowd";
  const reportCount = Math.max(room.reportCount, cold.reportCount);
  const latest =
    [room.latestReportAt, cold.latestReportAt].filter(Boolean).sort().pop() ??
    null;

  const footer = isEmpty
    ? "아직 제보가 없어요 · 첫 제보를 남겨주세요"
    : anyCrowd
      ? `회원 ${reportCount}명 제보${
          relativeTime(latest) ? ` · ${relativeTime(latest)}` : ""
        }`
      : "제보로 보정 예정";

  const openReport = () => {
    if (user) setReportOpen(true);
    else setLoginOpen(true);
  };

  return (
    <div className="rounded-[20px] bg-card p-[24px] shadow-[0_2px_12px_rgba(0,0,0,0.05)]">
      <div className="grid grid-cols-2 divide-x divide-line">
        <Column
          art={<SaunaRoomArt size={58} />}
          label="사우나실"
          temp={room.displayValue}
          tone="hot"
          crowd={room.source === "crowd"}
        />
        <Column
          art={<ColdBathArt size={58} />}
          label="냉탕"
          temp={cold.displayValue}
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
  /** null 이면 값이 없다는 뜻 — 기본값을 지어내지 않고 "—" 로 비운다. */
  temp: number | null;
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
      {temp == null ? (
        <div className="flex items-baseline text-[#C9C4BB]">
          <span className="text-[42px] font-bold leading-none">—</span>
        </div>
      ) : (
        <div className={`flex items-baseline gap-[2px] ${color}`}>
          <span className="text-[42px] font-bold leading-none tabular-nums">
            {temp}
          </span>
          <span className="text-[18px] font-bold">°</span>
        </div>
      )}
    </div>
  );
}
