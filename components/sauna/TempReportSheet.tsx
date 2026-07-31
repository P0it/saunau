"use client";

import { useEffect, useState } from "react";
import { X, Minus, Plus } from "lucide-react";
import {
  upsertTempReport,
  fetchMyTempReport,
  fetchCrowdTempInfo,
  type CrowdTempInfo,
} from "@/lib/tempReports";

const SAUNA_MIN = 40;
const SAUNA_MAX = 110;
const COLD_MIN = 1;
const COLD_MAX = 25;
const SAUNA_DEFAULT = 80;
const COLD_DEFAULT = 15;

/**
 * 온도 제보 시트 — 로그인 사용자 전용(부모가 로그인 후에만 연다).
 * 사우나실·냉탕 스테퍼(min/max = DB CHECK 일치). 1인 1제보/매장(upsert, 0027: 남/여 구분 없음).
 * 제출 시 집계(crowd)를 재조회해 onDone 으로 전달 → TempHero 즉시 반영. LoginSheet 시트 스타일.
 */
export function TempReportSheet({
  open,
  onClose,
  saunaId,
  userId,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  saunaId: string;
  userId: string;
  onDone: (crowd: CrowdTempInfo) => void;
}) {
  const [sauna, setSauna] = useState(SAUNA_DEFAULT);
  const [cold, setCold] = useState(COLD_DEFAULT);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  // 내 기존 제보로 스테퍼 초기화(있으면). 부모가 열릴 때만 마운트하므로
  // done 초기화는 useState 초기값이 담당(동기 setState-in-effect 회피).
  useEffect(() => {
    if (!open) return;
    let alive = true;
    void (async () => {
      const mine = await fetchMyTempReport(saunaId, userId);
      if (!alive) return;
      setSauna(mine?.saunaRoomTemp ?? SAUNA_DEFAULT);
      setCold(mine?.coldBathTemp ?? COLD_DEFAULT);
    })();
    return () => {
      alive = false;
    };
  }, [open, saunaId, userId]);

  if (!open) return null;

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    const ok = await upsertTempReport(saunaId, userId, sauna, cold);
    if (ok) {
      const crowd = await fetchCrowdTempInfo(saunaId);
      if (crowd) onDone(crowd);
      setDone(true);
    }
    setBusy(false);
  };

  return (
    <div className="fixed inset-0 z-[70] mx-auto flex max-w-[430px] flex-col justify-end bg-[rgba(20,18,16,.42)]">
      <div className="absolute inset-0" onClick={onClose} aria-hidden />
      <div className="relative flex flex-col overflow-hidden rounded-t-[22px] bg-card">
        <div className="flex justify-center pb-[4px] pt-[10px]">
          <div className="h-[4px] w-[38px] rounded-full bg-[#E2DFD9]" />
        </div>
        <div className="flex items-center justify-between px-[20px] pb-[8px] pt-[10px]">
          <span className="text-[17px] font-bold text-ink">온도 제보</span>
          <button type="button" aria-label="닫기" onClick={onClose}>
            <X size={24} className="text-ink" />
          </button>
        </div>

        <div className="px-[20px] pb-[28px] pt-[6px]">
          {done ? (
            <div className="flex flex-col items-center py-[20px] text-center">
              <p className="text-[15px] font-semibold text-ink">
                제보 고마워요! 🔥
              </p>
              <p className="mt-[6px] text-[13px] leading-[1.6] text-muted">
                여러 회원의 제보가 모이면 평균 온도로 표시돼요.
              </p>
              <button
                type="button"
                onClick={onClose}
                className="mt-[18px] h-[46px] w-full rounded-[14px] bg-brand text-[15px] font-semibold text-white"
              >
                확인
              </button>
            </div>
          ) : (
            <>
              <p className="text-[13px] leading-[1.6] text-muted">
                직접 재거나 표지판에서 본 온도를 알려주세요. 제보가 모이면 평균값으로
                보정돼요.
              </p>

              <div className="mt-[18px] flex flex-col gap-[12px]">
                <Stepper
                  label="사우나실"
                  tone="hot"
                  value={sauna}
                  min={SAUNA_MIN}
                  max={SAUNA_MAX}
                  onChange={setSauna}
                />
                <Stepper
                  label="냉탕"
                  tone="cold"
                  value={cold}
                  min={COLD_MIN}
                  max={COLD_MAX}
                  onChange={setCold}
                />
              </div>

              <button
                type="button"
                disabled={busy}
                onClick={submit}
                className="mt-[18px] h-[50px] w-full rounded-[14px] bg-brand text-[15px] font-semibold text-white disabled:opacity-40"
              >
                {busy ? "보내는 중…" : "제보하기"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Stepper({
  label,
  tone,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  tone: "hot" | "cold";
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  const clamp = (v: number) => Math.max(min, Math.min(max, v));
  const color = tone === "hot" ? "text-hot" : "text-cold";
  return (
    <div className="flex items-center justify-between rounded-[14px] border border-line bg-[#FBFAF8] px-[16px] py-[12px]">
      <span className="text-[14px] font-semibold text-ink">{label}</span>
      <div className="flex items-center gap-[14px]">
        <button
          type="button"
          aria-label={`${label} 온도 내리기`}
          onClick={() => onChange(clamp(value - 1))}
          className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-white text-ink shadow-[0_1px_4px_rgba(0,0,0,0.08)] active:scale-95"
        >
          <Minus size={18} />
        </button>
        <span
          className={`flex items-baseline gap-[1px] tabular-nums ${color}`}
        >
          <span className="text-[26px] font-bold leading-none">{value}</span>
          <span className="text-[14px] font-bold">°</span>
        </span>
        <button
          type="button"
          aria-label={`${label} 온도 올리기`}
          onClick={() => onChange(clamp(value + 1))}
          className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-white text-ink shadow-[0_1px_4px_rgba(0,0,0,0.08)] active:scale-95"
        >
          <Plus size={18} />
        </button>
      </div>
    </div>
  );
}
