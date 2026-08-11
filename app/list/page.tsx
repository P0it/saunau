"use client";

import { useEffect, useMemo, useRef, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Map as MapIcon,
  Funnel,
  LocateFixed,
  Loader2,
  Search,
  X,
} from "lucide-react";
import { getDiscoverSaunas, getSaunasByCategory, getSaunasNearby } from "@/lib/data/queries";
import { inCategory, type Sauna, type VenueType } from "@/lib/data/types";
import { useCoords, requestLocation } from "@/lib/geo";
import { SaunaCard } from "@/components/sauna/SaunaCard";
import { SaunaListSkeleton } from "@/components/ui/Skeleton";
import { Segment } from "@/components/ui/Segment";
import {
  FilterSheet,
  DEFAULT_FILTERS,
  matchesFilters,
  type SheetFilters,
} from "@/components/sauna/FilterSheet";

type TypeKey = "all" | "hot_spring" | "bathhouse" | "jjimjilbang" | "enzyme";
type SortKey = "distance" | "temp" | "recommend" | "new";

const TYPE_OPTIONS: { value: TypeKey; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "bathhouse", label: "목욕탕" },
  { value: "jjimjilbang", label: "찜질방" },
  { value: "hot_spring", label: "온천" },
  { value: "enzyme", label: "효소" },
];

const ATTR_FILTERS = [
  { key: "sesin", label: "세신" },
  // 습식(sauna_kind)·노천(has_outdoor)은 인제스트에서 데이터가 안 채워져 항상 무매치 →
  // 소스 생기기 전까지 칩에서 숨김. matchesFilters/attrs 로직은 아래에 그대로 유지.
  { key: "24h", label: "24시간" },
  { key: "hot", label: "고온 90°+" },
] as const;
type AttrKey = (typeof ATTR_FILTERS)[number]["key"];

const VENUE_OPTIONS: VenueType[] = ["standalone", "lodging", "community"];

/** 두 좌표 간 거리(km, 소수 1자리). 전국 카테고리 로딩 시 거리순 정렬용(RPC distance 대체). */
function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.min(1, Math.sqrt(s))) * 10) / 10;
}

function ListInner() {
  const sp = useSearchParams();

  const [type, setType] = useState<TypeKey>((sp.get("type") as TypeKey) || "all");
  const [sort, setSort] = useState<SortKey>((sp.get("sort") as SortKey) || "distance");
  // 속성 필터는 홈 화면 딥링크(?filter=hot 등)로만 들어옴 — 시트에 통합돼 UI 토글은 없음.
  const [attrs] = useState<Set<AttrKey>>(() => {
    const f = sp.get("filter") as AttrKey | null;
    return new Set(f && ATTR_FILTERS.some((a) => a.key === f) ? [f] : []);
  });

  // 검색어 — 별도 페이지로 가지 않고 그 자리에서 목록을 좁힌다(상호·지역·주소).
  const [query, setQuery] = useState("");

  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetDraft, setSheetDraft] = useState<SheetFilters>(DEFAULT_FILTERS);
  // 장소 유형(venue)은 필터 시트와 같은 sheet.venues 를 공유 — 상단 칩과 시트가 동기.
  const [sheet, setSheet] = useState<SheetFilters>(() => {
    const v = sp.get("venue") as VenueType | null;
    const venues = v && VENUE_OPTIONS.includes(v) ? [v] : [];
    return { ...DEFAULT_FILTERS, venues };
  });

  // 앱 로드 시 받은 내 위치(있으면 거리순 "내 주변", 없으면 전국 발견 목록).
  const coords = useCoords();
  const [locating, setLocating] = useState(false);
  // 자동요청이 막히는 브라우저 대비 — 사용자 제스처로 직접 권한 요청.
  function requestMyLocation() {
    if (locating) return;
    setLocating(true);
    void requestLocation().finally(() => setLocating(false));
  }
  const [all, setAll] = useState<Sauna[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    // 효소·세신은 전국에 드물게 흩어져 있어 "내 주변 15km"로는 대부분 잘린다.
    // 이 니치 테마는 카테고리 전체를 전국에서 불러오고, 거리순은 아래에서 클라이언트 계산.
    const nicheTheme: "enzyme" | "sesin" | null =
      type === "enzyme" ? "enzyme" : attrs.has("sesin") ? "sesin" : null;
    const load = nicheTheme
      ? getSaunasByCategory(nicheTheme, 600)
      : coords
        ? getSaunasNearby(coords.lat, coords.lng, 15_000, 300)
        : getDiscoverSaunas(800);
    load
      .then((rows) => {
        if (!alive) return;
        // 전국 로딩 경로는 distance_km 가 비어 있으므로, 위치가 있으면 여기서 채운다(거리순 정렬용).
        const withDist =
          coords && nicheTheme
            ? rows.map((s) =>
                s.location
                  ? { ...s, distance_km: haversineKm(coords, s.location) }
                  : s,
              )
            : rows;
        setAll(withDist);
      })
      .catch(() => alive && setAll([]))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [coords, type, attrs]);

  const list = useMemo(() => {
    const term = query.trim().toLowerCase();
    let rows = all.filter((s) => {
      if (type !== "all" && !inCategory(s, type)) return false;
      if (attrs.has("sesin") && !s.has_sesin) return false;
      if (attrs.has("24h") && !s.is_24h) return false;
      if (attrs.has("hot") && (s.sauna_room_temp ?? 0) < 90) return false;
      if (!matchesFilters(s, sheet)) return false;
      if (
        term &&
        ![s.name, s.sigungu, s.dong, s.address].some((f) =>
          f?.toLowerCase().includes(term),
        )
      )
        return false;
      return true;
    });
    rows = [...rows].sort((a, b) => {
      if (sort === "distance") return (a.distance_km ?? 1e9) - (b.distance_km ?? 1e9);
      if (sort === "temp") return (b.sauna_room_temp ?? -1) - (a.sauna_room_temp ?? -1);
      if (sort === "new") return (b.open_date ?? "") < (a.open_date ?? "") ? -1 : 1;
      return 0;
    });
    return rows;
  }, [all, type, sort, attrs, sheet, query]);

  // 렌더 windowing — 수백 개 카드(각 Image)를 한 번에 그리면 전환이 버벅인다.
  // 처음 PAGE 개만 그리고, 하단 센티넬이 보이면 이어서 채운다(무한 스크롤).
  const PAGE = 20;
  const [visible, setVisible] = useState(PAGE);
  // 필터·정렬·검색으로 목록이 바뀌면 처음부터 다시.
  // 이펙트가 아니라 렌더 중 조정 — 이펙트로 되돌리면 이전 목록을 한 프레임 그렸다가 잘린다.
  const [pagedList, setPagedList] = useState(list);
  if (pagedList !== list) {
    setPagedList(list);
    setVisible(PAGE);
  }
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting)
          setVisible((v) => Math.min(v + PAGE, list.length));
      },
      { rootMargin: "400px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [list.length]);

  // 헤더 문맥: 테마(타입/세신)로 들어오면 그 이름, 기본 진입은 근접성 의미의 "내 주변".
  const heading =
    type !== "all"
      ? (TYPE_OPTIONS.find((t) => t.value === type)?.label ?? "찾기")
      : attrs.has("sesin")
        ? "세신샵"
        : "내 주변";

  return (
    <div className="flex min-h-full flex-col">
      {/* header */}
      <header className="sticky top-0 z-20 flex flex-none items-center bg-frame/90 px-[18px] pb-[10px] pt-[14px] backdrop-blur">
        <span className="text-[18px] font-extrabold tracking-[-0.02em] text-ink">
          {heading}
        </span>
      </header>

      {/* 검색 — 그 자리에서 목록을 좁힌다(상호·지역·주소) */}
      <div className="px-[14px] pb-[10px]">
        <div className="flex h-[42px] items-center gap-[8px] rounded-full bg-card px-[14px] shadow-[0_1px_6px_rgba(0,0,0,0.06)]">
          <Search size={17} className="flex-none text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="상호·지역·키워드 검색"
            className="w-full bg-transparent text-[14px] text-ink outline-none placeholder:text-muted"
          />
          {query && (
            <button
              type="button"
              aria-label="검색어 지우기"
              onClick={() => setQuery("")}
              className="flex-none text-muted hover:text-ink"
            >
              <X size={15} />
            </button>
          )}
        </div>
      </div>

      {/* type segment + 필터(오른쪽 끝) */}
      <div className="flex items-center gap-[8px] px-[14px] pb-[10px]">
        <div className="no-scrollbar min-w-0 flex-1 overflow-x-auto">
          <Segment
            options={TYPE_OPTIONS}
            value={type}
            // 이미 선택된 유형 칩을 다시 누르면 "전체"로 해제(토글).
            onChange={(v) => setType(v === type && v !== "all" ? "all" : v)}
          />
        </div>
        <button
          type="button"
          aria-label="필터"
          onClick={() => {
            setSheetDraft(sheet);
            setSheetOpen(true);
          }}
          className="relative flex flex-none items-center gap-[5px] rounded-full border border-line bg-card px-[12px] py-[7px] text-[13px] font-semibold text-ink"
        >
          <Funnel size={15} />
          필터
          {sheet !== DEFAULT_FILTERS && (
            <span className="absolute -right-[2px] -top-[2px] h-[8px] w-[8px] rounded-full bg-brand" />
          )}
        </button>
      </div>

      {/* sort */}
      <div className="flex items-center justify-end gap-[12px] px-[16px] pb-[10px] text-[13px] font-medium">
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

      {/* 위치 없으면 전국 목록 표시 중임을 알리고, 제스처로 내 위치를 받을 수 있게 */}
      {!coords && (
        <div className="mx-[16px] mb-[12px] flex items-center justify-between gap-[10px] rounded-[14px] bg-card px-[14px] py-[11px] shadow-[0_1px_6px_rgba(0,0,0,0.04)]">
          <span className="text-[13px] font-medium text-muted">
            전국 목록을 보고 있어요
          </span>
          <button
            type="button"
            onClick={requestMyLocation}
            aria-busy={locating}
            className="flex flex-none items-center gap-[5px] rounded-full bg-brand px-[12px] py-[7px] text-[13px] font-semibold text-white active:scale-[0.98]"
          >
            {locating ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                위치 확인 중…
              </>
            ) : (
              <>
                <LocateFixed size={14} />내 위치로 보기
              </>
            )}
          </button>
        </div>
      )}

      {/* list */}
      <div className="flex flex-col gap-[14px] px-[16px] pb-[20px]">
        {loading ? (
          <SaunaListSkeleton count={6} />
        ) : list.length === 0 ? (
          <div className="py-[60px] text-center text-[14px] text-muted">
            {query.trim()
              ? `‘${query.trim()}’ 검색 결과가 없어요`
              : "조건에 맞는 사우나가 없어요"}
          </div>
        ) : (
          <>
            {list.slice(0, visible).map((s) => (
              <SaunaCard key={s.id} sauna={s} />
            ))}
            {visible < list.length && (
              <div ref={sentinelRef} className="h-[1px]" aria-hidden />
            )}
          </>
        )}
      </div>

      {/* floating "지도로 보기" — 하단 탭바 위에 떠 있음 */}
      <div className="pointer-events-none sticky bottom-0 z-20 mt-auto flex justify-center pb-[16px] pt-[10px]">
        <Link
          href={
            coords
              ? `/map?lat=${coords.lat.toFixed(6)}&lng=${coords.lng.toFixed(6)}`
              : "/map"
          }
          className="pointer-events-auto flex items-center gap-[5px] rounded-full bg-white px-[14px] py-[8px] text-[13px] font-semibold text-brand shadow-[0_3px_12px_rgba(245,64,44,0.16)]"
        >
          <MapIcon size={15} />
          지도로 보기
        </Link>
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
