"use client";

import { useMemo } from "react";
import { X, Flame, Snowflake } from "lucide-react";
import { primaryCategory, type Sauna, type SaunaCategory } from "@/lib/data/types";

export interface SheetFilters {
  types: SaunaCategory[];
  kinds: string[]; // 습식/건식/한증막
  sesin: "any" | "yes";
  open: "any" | "24h";
  saunaTemp: [number, number];
  coldTemp: [number, number];
}

export const DEFAULT_FILTERS: SheetFilters = {
  types: [],
  kinds: [],
  sesin: "any",
  open: "any",
  saunaTemp: [40, 110],
  coldTemp: [5, 25],
};

const TYPE_CHIPS: { value: SaunaCategory; label: string }[] = [
  { value: "hot_spring", label: "온천" },
  { value: "bathhouse", label: "사우나" },
  { value: "jjimjilbang", label: "찜질방" },
];
const KIND_CHIPS = ["습식", "건식", "한증막"];

export function matchesFilters(s: Sauna, f: SheetFilters): boolean {
  if (f.types.length && !f.types.includes(primaryCategory(s))) return false;
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
}: {
  open: boolean;
  value: SheetFilters;
  onChange: (f: SheetFilters) => void;
  onApply: () => void;
  onClose: () => void;
  candidates: Sauna[];
}) {
  const count = useMemo(
    () => candidates.filter((s) => matchesFilters(s, value)).length,
    [value, candidates],
  );
  if (!open) return null;

  const toggleType = (t: SaunaCategory) =>
    onChange({
      ...value,
      types: value.types.includes(t)
        ? value.types.filter((x) => x !== t)
        : [...value.types, t],
    });
  const toggleKind = (k: string) =>
    onChange({
      ...value,
      kinds: value.kinds.includes(k)
        ? value.kinds.filter((x) => x !== k)
        : [...value.kinds, k],
    });

  return (
    <div className="fixed inset-0 z-50 mx-auto flex max-w-[430px] flex-col justify-end bg-[rgba(20,18,16,.42)]">
      <div
        className="absolute inset-0"
        onClick={onClose}
        aria-hidden
      />
      <div className="relative flex max-h-[82dvh] flex-col overflow-hidden rounded-t-[22px] bg-card">
        {/* handle + header */}
        <div className="flex-none">
          <div className="flex justify-center pb-[4px] pt-[10px]">
            <div className="h-[4px] w-[38px] rounded-full bg-[#E2DFD9]" />
          </div>
          <div className="flex items-center justify-between px-[20px] pb-[12px] pt-[8px]">
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

          <Section title="사우나 유형">
            <div className="flex flex-wrap gap-[8px]">
              {KIND_CHIPS.map((k) => (
                <PillToggle
                  key={k}
                  label={k}
                  active={value.kinds.includes(k)}
                  onClick={() => toggleKind(k)}
                />
              ))}
            </div>
          </Section>

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
          {value[0]}° – {value[1]}°
        </span>
      </div>
      <div className="flex items-center gap-[10px]">
        <input
          type="range"
          min={min}
          max={max}
          value={value[0]}
          onChange={(e) =>
            onChange([Math.min(Number(e.target.value), value[1]), value[1]])
          }
          className="h-[4px] flex-1 cursor-pointer appearance-none rounded-full bg-[#EBEBEE]"
          style={{ accentColor: color }}
        />
        <input
          type="range"
          min={min}
          max={max}
          value={value[1]}
          onChange={(e) =>
            onChange([value[0], Math.max(Number(e.target.value), value[0])])
          }
          className="h-[4px] flex-1 cursor-pointer appearance-none rounded-full bg-[#EBEBEE]"
          style={{ accentColor: color }}
        />
      </div>
    </div>
  );
}
