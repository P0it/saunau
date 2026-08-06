"use client";

import { useMemo } from "react";
import { X, Flame, Snowflake } from "lucide-react";
import {
  inCategory,
  VENUE_LABEL,
  type Sauna,
  type SaunaCategory,
  type VenueType,
} from "@/lib/data/types";

export interface SheetFilters {
  types: SaunaCategory[];
  venues: VenueType[]; // 장소 유형: 독립/숙박형/커뮤니티
  kinds: string[]; // 습식/건식/한증막
  sesin: "any" | "yes";
  open: "any" | "24h";
  saunaTemp: [number, number];
  coldTemp: [number, number];
}

export const DEFAULT_FILTERS: SheetFilters = {
  types: [],
  venues: [],
  kinds: [],
  sesin: "any",
  open: "any",
  saunaTemp: [40, 110],
  coldTemp: [5, 25],
};

const TYPE_CHIPS: { value: SaunaCategory; label: string }[] = [
  { value: "bathhouse", label: "목욕탕" },
  { value: "jjimjilbang", label: "찜질방" },
  { value: "hot_spring", label: "온천" },
  { value: "enzyme", label: "효소찜질방" },
];
// 체육·복지시설(community)은 칩에서 뺐다 — 0030 이후 데이터 자체가 노출 보류라
// 켜도 결과가 0곳이다. VENUE_LABEL.community 는 분류·관리용으로 남아있다.
const VENUE_CHIPS: { value: VenueType; label: string }[] = [
  { value: "standalone", label: VENUE_LABEL.standalone },
  { value: "lodging", label: VENUE_LABEL.lodging },
];

export function matchesFilters(s: Sauna, f: SheetFilters): boolean {
  if (f.types.length && !f.types.some((t) => inCategory(s, t))) return false;
  // 장소 유형: 선택이 있으면 그대로. 체육·복지시설은 어느 경우에도 숨긴다 —
  // 헬스장 샤워실(◯◯헬스사우나·◯◯휘트니스사우나)·복지관 목욕탕이 목욕탕/찜질방
  // 목록에 섞이면 서비스 신뢰가 깨진다. 서버 쪽 1차 차단은 needs_review(0030),
  // 여기는 아직 보류 처리 안 된 행(신규 크롤 등)까지 막는 2차 방어.
  if (s.venue_type === "community") return false;
  if (f.venues.length && !f.venues.includes(s.venue_type)) return false;
  if (f.kinds.length && !f.kinds.some((k) => s.sauna_kind.includes(k))) return false;
  if (f.sesin === "yes" && !s.has_sesin) return false;
  if (f.open === "24h" && !s.is_24h) return false;
  if (s.sauna_room_temp != null) {
    if (s.sauna_room_temp < f.saunaTemp[0] || s.sauna_room_temp > f.saunaTemp[1])
      return false;
  }
  if (s.cold_bath_temp != null) {
    if (s.cold_bath_temp < f.coldTemp[0] || s.cold_bath_temp > f.coldTemp[1])
      return false;
  }
  return true;
}

export function FilterSheet({
  open,
  value,
  onChange,
  onApply,
  onClose,
  candidates,
  variant = "sheet",
}: {
  open: boolean;
  value: SheetFilters;
  onChange: (f: SheetFilters) => void;
  onApply: () => void;
  onClose: () => void;
  candidates: Sauna[];
  /** sheet=모바일 하단 시트(기본) · panel=좌측 도킹 패널(지도 데스크톱) */
  variant?: "sheet" | "panel";
}) {
  const count = useMemo(
    () => candidates.filter((s) => matchesFilters(s, value)).length,
    [value, candidates],
  );
  if (!open) return null;
  const isPanel = variant === "panel";

  const toggleType = (t: SaunaCategory) =>
    onChange({
      ...value,
      types: value.types.includes(t)
        ? value.types.filter((x) => x !== t)
        : [...value.types, t],
    });
  const toggleVenue = (v: VenueType) =>
    onChange({
      ...value,
      venues: value.venues.includes(v)
        ? value.venues.filter((x) => x !== v)
        : [...value.venues, v],
    });
  return (
    <div
      className={
        isPanel
          ? "fixed inset-0 z-[60]"
          : "fixed inset-0 z-50 mx-auto flex max-w-[430px] flex-col justify-end bg-[rgba(20,18,16,.42)]"
      }
    >
      <div className="absolute inset-0" onClick={onClose} aria-hidden />
      <div
        className={
          isPanel
            ? "absolute inset-y-0 left-0 flex w-full max-w-[400px] flex-col overflow-hidden bg-card shadow-[6px_0_24px_rgba(0,0,0,0.18)]"
            : "relative flex max-h-[82dvh] flex-col overflow-hidden rounded-t-[22px] bg-card"
        }
      >
        {/* handle + header */}
        <div className="flex-none">
          {!isPanel && (
            <div className="flex justify-center pb-[4px] pt-[10px]">
              <div className="h-[4px] w-[38px] rounded-full bg-[#E2DFD9]" />
            </div>
          )}
          <div className="flex items-center justify-between px-[20px] pb-[12px] pt-[14px]">
            <button
              type="button"
              onClick={() => onChange(DEFAULT_FILTERS)}
              className="text-[14px] text-[#A39D94]"
            >
              초기화
            </button>
            <span className="text-[17px] font-bold text-ink">필터</span>
            <button type="button" aria-label="닫기" onClick={onClose}>
              <X size={24} className="text-ink" />
            </button>
          </div>
        </div>

        {/* body */}
        <div className="no-scrollbar flex-1 overflow-y-auto px-[20px] pb-[20px] pt-[6px]">
          <Section title="시설 유형" hint="중복 선택 가능">
            <div className="flex flex-wrap gap-[8px]">
              {TYPE_CHIPS.map((c) => (
                <PillToggle
                  key={c.value}
                  label={c.label}
                  active={value.types.includes(c.value)}
                  onClick={() => toggleType(c.value)}
                />
              ))}
            </div>
          </Section>

          <Section title="장소 유형" hint="중복 선택 가능">
            <div className="flex flex-wrap gap-[8px]">
              {VENUE_CHIPS.map((c) => (
                <PillToggle
                  key={c.value}
                  label={c.label}
                  active={value.venues.includes(c.value)}
                  onClick={() => toggleVenue(c.value)}
                />
              ))}
            </div>
            <p className="mt-[8px] text-[12px] leading-[1.5] text-muted">
              헬스장·복지관 부속 목욕시설(체육·복지시설)은 기본 목록에서 빼둡니다. 칩을 켜면 보입니다.
            </p>
          </Section>

          {/* 사우나 유형(습식/건식/한증막) 필터는 sauna_kind 데이터가
              인제스트에서 채워지지 않아 항상 무매치 → 소스 생기기 전까지 숨김.
              matchesFilters()의 kinds 로직·타입은 유지(kinds는 항상 []). */}

          <div className="mt-[24px] flex gap-[20px]">
            <div className="flex-1">
              <div className="mb-[11px] text-[14px] font-bold text-ink">세신</div>
              <div className="flex gap-[8px]">
                <PillToggle label="가능" active={value.sesin === "yes"} fill onClick={() => onChange({ ...value, sesin: "yes" })} />
                <PillToggle label="무관" active={value.sesin === "any"} fill onClick={() => onChange({ ...value, sesin: "any" })} />
              </div>
            </div>
            <div className="flex-1">
              <div className="mb-[11px] text-[14px] font-bold text-ink">영업</div>
              <div className="flex gap-[8px]">
                <PillToggle label="24시간" active={value.open === "24h"} fill onClick={() => onChange({ ...value, open: "24h" })} />
                <PillToggle label="전체" active={value.open === "any"} fill onClick={() => onChange({ ...value, open: "any" })} />
              </div>
            </div>
          </div>

          {/* 온도 범위 */}
          <div className="mt-[26px] mb-[16px] text-[14px] font-bold text-ink">
            온도 범위
          </div>
          <RangeRow
            icon={<Flame size={15} className="text-hot" />}
            label="사우나실"
            color="var(--color-hot)"
            min={40}
            max={110}
            value={value.saunaTemp}
            onChange={(v) => onChange({ ...value, saunaTemp: v })}
          />
          <RangeRow
            icon={<Snowflake size={15} className="text-cold" />}
            label="냉탕"
            color="var(--color-cold)"
            min={5}
            max={25}
            value={value.coldTemp}
            onChange={(v) => onChange({ ...value, coldTemp: v })}
          />
        </div>

        {/* CTA */}
        <div className="flex-none border-t border-[#EFEFF2] bg-card px-[20px] pb-[22px] pt-[12px]">
          <button
            type="button"
            onClick={onApply}
            className="h-[54px] w-full rounded-[14px] bg-brand text-[16px] font-bold tabular-nums text-white"
          >
            {count}개 사우나 보기
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-[20px] first:mt-[12px]">
      <div className="text-[14px] font-bold text-ink">{title}</div>
      {hint && <div className="mb-[11px] mt-[4px] text-[12px] text-[#A39D94]">{hint}</div>}
      {!hint && <div className="mb-[11px]" />}
      {children}
    </div>
  );
}

function PillToggle({
  label,
  active,
  onClick,
  fill = false,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  fill?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-[38px] rounded-full border px-[16px] text-[13px] font-semibold ${fill ? "flex-1" : ""}`}
      style={
        active
          ? { background: "#FFEEEA", borderColor: "#FAD9D1", color: "var(--color-brand)" }
          : { background: "#fff", borderColor: "#E5E5E9", color: "#5C5854" }
      }
    >
      {label}
    </button>
  );
}

function RangeRow({
  icon,
  label,
  color,
  min,
  max,
  value,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  color: string;
  min: number;
  max: number;
  value: [number, number];
  onChange: (v: [number, number]) => void;
}) {
  // 손잡이 지름 18px → 반지름 9px. 네이티브 range 손잡이 중심은 양끝에서
  // 9px 안쪽까지만 이동하므로, 채움/레일도 그 이동 범위에 맞춰 배치해야
  // 손잡이와 어긋나지 않는다. (fr: 0~1 비율)
  const THUMB = 18;
  const fr = (n: number) => (n - min) / (max - min);
  const atLeft = (n: number) => `calc(9px + ${fr(n)} * (100% - ${THUMB}px))`;
  const atRight = (n: number) => `calc(9px + ${1 - fr(n)} * (100% - ${THUMB}px))`;
  return (
    <div className="mb-[18px]">
      <div className="mb-[9px] flex items-center justify-between">
        <span
          className="inline-flex items-center gap-[5px] text-[13px] font-semibold"
          style={{ color }}
        >
          {icon}
          {label}
        </span>
        <span
          className="text-[13px] font-bold tabular-nums"
          style={{ color }}
        >
          {value[0]}° ~ {value[1]}°
        </span>
      </div>
      <div
        className="dual-range relative h-[24px]"
        style={{ "--range": color } as React.CSSProperties}
      >
        {/* 기본 트랙 — 손잡이 이동 범위(양끝 9px 안쪽)에 맞춤 */}
        <div className="pointer-events-none absolute top-1/2 h-[4px] -translate-y-1/2 rounded-full bg-[#EBEBEE]" style={{ left: "9px", right: "9px" }} />
        {/* 선택 구간 채움(두 손잡이 사이) */}
        <div
          className="pointer-events-none absolute top-1/2 h-[4px] -translate-y-1/2 rounded-full"
          style={{
            left: atLeft(value[0]),
            right: atRight(value[1]),
            background: color,
          }}
        />
        <input
          type="range"
          min={min}
          max={max}
          value={value[0]}
          onChange={(e) =>
            onChange([Math.min(Number(e.target.value), value[1]), value[1]])
          }
          aria-label={`${label} 최저 온도`}
          style={{ zIndex: value[0] >= value[1] ? 5 : 3 }}
        />
        <input
          type="range"
          min={min}
          max={max}
          value={value[1]}
          onChange={(e) =>
            onChange([value[0], Math.max(Number(e.target.value), value[0])])
          }
          aria-label={`${label} 최고 온도`}
          style={{ zIndex: 4 }}
        />
      </div>
    </div>
  );
}
