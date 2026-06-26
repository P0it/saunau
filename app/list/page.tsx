"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Map as MapIcon, SlidersHorizontal } from "lucide-react";
import { getDiscoverSaunas } from "@/lib/data/queries";
import { primaryCategory, type Sauna } from "@/lib/data/types";
import { SaunaCard } from "@/components/sauna/SaunaCard";
import { Segment } from "@/components/ui/Segment";
import { Chip } from "@/components/ui/Chip";
import {
  FilterSheet,
  DEFAULT_FILTERS,
  matchesFilters,
  type SheetFilters,
} from "@/components/sauna/FilterSheet";

type TypeKey = "all" | "hot_spring" | "bathhouse" | "jjimjilbang";
type SortKey = "distance" | "temp" | "recommend" | "new";

const TYPE_OPTIONS: { value: TypeKey; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "hot_spring", label: "온천" },
  { value: "bathhouse", label: "사우나" },
  { value: "jjimjilbang", label: "찜질방" },
];

const ATTR_FILTERS = [
  { key: "sesin", label: "세신" },
  { key: "wet", label: "습식" },
  { key: "24h", label: "24시간" },
  { key: "hot", label: "고온 90°+" },
  { key: "outdoor", label: "노천" },
] as const;
type AttrKey = (typeof ATTR_FILTERS)[number]["key"];

function ListInner() {
  const sp = useSearchParams();

  const [type, setType] = useState<TypeKey>((sp.get("type") as TypeKey) || "all");
  const [sort, setSort] = useState<SortKey>((sp.get("sort") as SortKey) || "distance");
  const [attrs, setAttrs] = useState<Set<AttrKey>>(() => {
    const f = sp.get("filter") as AttrKey | null;
    return new Set(f && ATTR_FILTERS.some((a) => a.key === f) ? [f] : []);
  });

  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetDraft, setSheetDraft] = useState<SheetFilters>(DEFAULT_FILTERS);
  const [sheet, setSheet] = useState<SheetFilters>(DEFAULT_FILTERS);

  const [all, setAll] = useState<Sauna[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    getDiscoverSaunas(800)
      .then((rows) => alive && setAll(rows))
      .catch(() => alive && setAll([]))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  const toggleAttr = (k: AttrKey) =>
    setAttrs((prev) => {
      const next = new Set(prev);
      next.has(k) ? next.delete(k) : next.add(k);
      return next;
    });

  const list = useMemo(() => {
    let rows = all.filter((s) => {
      if (type !== "all" && primaryCategory(s) !== type) return false;
      if (attrs.has("sesin") && !s.has_sesin) return false;
      if (attrs.has("wet") && !s.sauna_kind.includes("습식")) return false;
      if (attrs.has("24h") && !s.is_24h) return false;
      if (attrs.has("hot") && (s.sauna_room_temp ?? 0) < 90) return false;
      if (attrs.has("outdoor") && !s.has_outdoor) return false;
      if (!matchesFilters(s, sheet)) return false;
      return true;
    });
    rows = [...rows].sort((a, b) => {
      if (sort === "distance") return (a.distance_km ?? 1e9) - (b.distance_km ?? 1e9);
      if (sort === "temp") return (b.sauna_room_temp ?? -1) - (a.sauna_room_temp ?? -1);
      if (sort === "new") return (b.open_date ?? "") < (a.open_date ?? "") ? -1 : 1;
      return 0;
    });
    return rows;
  }, [all, type, sort, attrs, sheet]);

  return (
    <div className="flex flex-col">
      {/* header */}
      <header className="sticky top-0 z-20 flex flex-none items-center justify-between bg-frame/90 px-[18px] pb-[10px] pt-[14px] backdrop-blur">
        <span className="text-[18px] font-extrabold tracking-[-0.02em] text-ink">
          전체 사우나
        </span>
        <Link
          href="/map"
          className="flex items-center gap-[5px] rounded-full bg-card px-[12px] py-[7px] text-[13px] font-semibold text-ink shadow-[0_1px_6px_rgba(0,0,0,0.06)]"
        >
          <MapIcon size={16} />
          지도
        </Link>
      </header>

      {/* type segment */}
      <div className="px-[14px] pb-[10px]">
        <Segment options={TYPE_OPTIONS} value={type} onChange={setType} />
      </div>

      {/* attribute filter chips */}
      <div className="no-scrollbar flex items-center gap-[8px] overflow-x-auto px-[16px] pb-[12px]">
        <button
          type="button"
          aria-label="필터"
          onClick={() => {
            setSheetDraft(sheet);
            setSheetOpen(true);
          }}
          className="relative flex-none rounded-full border border-line bg-card p-[8px] text-ink"
        >
          <SlidersHorizontal size={16} />
          {sheet !== DEFAULT_FILTERS && (
            <span className="absolute -right-[2px] -top-[2px] h-[8px] w-[8px] rounded-full bg-brand" />
          )}
        </button>
        {ATTR_FILTERS.map((a) => (
          <Chip
            key={a.key}
            label={a.label}
            active={attrs.has(a.key)}
            onClick={() => toggleAttr(a.key)}
          />
        ))}
      </div>

      {/* sort */}
      <div className="flex items-center justify-end gap-[12px] px-[18px] pb-[10px] text-[13px] font-medium">
        {(
          [
            ["distance", "거리순"],
            ["temp", "온도순"],
            ["recommend", "추천순"],
          ] as [SortKey, string][]
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setSort(k)}
            style={{ color: sort === k ? "var(--color-brand)" : "var(--color-muted)" }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* list */}
      <div className="flex flex-col gap-[14px] px-[16px] pb-[20px]">
        {loading ? (
          <div className="py-[60px] text-center text-[14px] text-muted">
            불러오는 중…
          </div>
        ) : list.length === 0 ? (
          <div className="py-[60px] text-center text-[14px] text-muted">
            조건에 맞는 사우나가 없어요
          </div>
        ) : (
          list.map((s) => <SaunaCard key={s.id} sauna={s} />)
        )}
      </div>

      <FilterSheet
        open={sheetOpen}
        value={sheetDraft}
        candidates={all}
        onChange={setSheetDraft}
        onApply={() => {
          setSheet(sheetDraft);
          setSheetOpen(false);
        }}
        onClose={() => setSheetOpen(false)}
      />
    </div>
  );
}

export default function ListPage() {
  return (
    <Suspense fallback={null}>
      <ListInner />
    </Suspense>
  );
}
