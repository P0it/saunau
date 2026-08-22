"use client";

import { useEffect, useRef, useState } from "react";
import {
  X,
  Search,
  Funnel,
  ChevronLeft,
  ChevronRight,
  Copy,
  Check,
} from "lucide-react";
import type {
  Sauna,
  SaunaPhoto,
  SaunaCategory,
  BlogReview,
  SaunaReview,
} from "@/lib/data/types";
import { CATEGORY_LABEL, primaryCategory } from "@/lib/data/types";
import { TempHeadline } from "@/components/sauna/TempHeadline";
import { SaunaImage } from "@/components/sauna/SaunaImage";
import { SaunaDetailBody } from "@/components/sauna/SaunaDetailBody";
import { FavoriteScrubber } from "@/components/sauna/FavoriteScrubber";
import { FlameRating } from "@/components/sauna/FlameRating";
import { PanelRowSkeleton } from "@/components/ui/Skeleton";

// 빠른 카테고리 칩(상단). 효소찜질방은 칩에선 "효소"로 축약.
const CHIP_CATS: SaunaCategory[] = [
  "bathhouse",
  "jjimjilbang",
  "hot_spring",
  "enzyme",
];
const CHIP_LABEL: Record<SaunaCategory, string> = {
  bathhouse: "사우나",
  jjimjilbang: "찜질방",
  hot_spring: "온천",
  enzyme: "효소",
  sesin: "세신샵",
};

/**
 * 지도 좌측 "목록" 패널(네이버 지도식, 풀하이트). 검색·카테고리 칩 + 주변 사우나 리스트.
 * 사우나를 고르면 MapDetailPanel 이 뜨는데, 목록이 펼쳐져 있으면 옆에 나란히,
 * 목록이 접혀 있으면 상세만 왼쪽 단독으로 표시된다(위치 분기는 NaverMapView 가 담당).
 */
export function MapSidePanel({
  saunas,
  loading = false,
  selectedId,
  onSelect,
  onHover,
  onOpenFilter,
  activeCategory,
  onPickCategory,
  filterActive,
  query,
  onQueryChange,
}: {
  saunas: Sauna[];
  loading?: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
  onOpenFilter: () => void;
  activeCategory: SaunaCategory | null;
  onPickCategory: (c: SaunaCategory | null) => void;
  filterActive: boolean;
  query: string;
  onQueryChange: (v: string) => void;
}) {
  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-card">
      <ListView
        saunas={saunas}
        loading={loading}
        selectedId={selectedId}
        onSelect={onSelect}
        onHover={onHover}
        onOpenFilter={onOpenFilter}
        activeCategory={activeCategory}
        onPickCategory={onPickCategory}
        filterActive={filterActive}
        query={query}
        onQueryChange={onQueryChange}
      />
    </div>
  );
}

/** 리스트 옆에 뜨는 별도 "상세" 패널. 스크롤하면 전체 상세가 그대로 나온다. */
export function MapDetailPanel({
  sauna,
  photos,
  reviews,
  visitorReviews,
  loading,
  photosLoading = loading,
  onClose,
  asBack = false,
}: {
  sauna: Sauna;
  photos: SaunaPhoto[];
  reviews: BlogReview[];
  visitorReviews: SaunaReview[];
  loading: boolean;
  /** 사진만의 로딩(후기와 별도 요청) — 갤러리 스켈레톤은 이 값으로 건다. */
  photosLoading?: boolean;
  onClose: () => void;
  /** 모바일 바텀시트처럼 '목록 → 상세'로 넘어온 경우 — 닫기 대신 뒤로(목록) 버튼으로 표시. */
  asBack?: boolean;
}) {
  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-card">
      {/* key — 다른 매장을 열면 새로 마운트한다. 없으면 캐러셀 인덱스·가로 스크롤
          위치·제목 고정 상태가 이전 매장 것 그대로 남는다(예: 새 매장인데 "3 / 5"). */}
      <DetailView
        key={sauna.id}
        sauna={sauna}
        photos={photos}
        reviews={reviews}
        visitorReviews={visitorReviews}
        loading={loading}
        photosLoading={photosLoading}
        onClose={onClose}
        asBack={asBack}
      />
    </div>
  );
}

/* ── 목록 ── */
function ListView({
  saunas,
  loading = false,
  selectedId,
  onSelect,
  onHover,
  onOpenFilter,
  activeCategory,
  onPickCategory,
  filterActive,
  query,
  onQueryChange,
}: {
  saunas: Sauna[];
  loading?: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
  onOpenFilter: () => void;
  activeCategory: SaunaCategory | null;
  onPickCategory: (c: SaunaCategory | null) => void;
  filterActive: boolean;
  query: string;
  onQueryChange: (v: string) => void;
}) {
  // "이 지역 재검색"·필터·검색으로 목록이 통째로 바뀌면 맨 위부터 다시 읽혀야 한다 —
  // 스크롤이 남아있으면 새 결과 중간이 보여 "안 바뀐 것"처럼 읽힌다.
  const listRef = useRef<HTMLUListElement>(null);
  useEffect(() => {
    listRef.current?.scrollTo({ top: 0 });
  }, [saunas]);

  return (
    <div className="flex h-full flex-col">
      <header className="flex-none border-b border-[#EEECE8]">
        {/* 검색 + 필터 + 접기 — 지도를 떠나지 않고 그 자리에서 목록·마커를 좁힌다. */}
        <div className="flex items-center gap-[8px] px-[12px] pt-[12px]">
          <div className="flex h-[42px] flex-1 items-center gap-[8px] rounded-full bg-[#F4F2EF] px-[14px]">
            <Search size={17} className="flex-none text-muted" />
            <input
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder="상호·지역·키워드 검색"
              className="w-full bg-transparent text-[14px] text-ink outline-none placeholder:text-muted"
            />
            {query && (
              <button
                type="button"
                aria-label="검색어 지우기"
                onClick={() => onQueryChange("")}
                className="flex-none text-muted hover:text-ink"
              >
                <X size={15} />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={onOpenFilter}
            aria-label="필터"
            className="relative flex h-[42px] w-[42px] flex-none items-center justify-center rounded-full bg-[#F4F2EF] text-ink"
          >
            <Funnel size={18} />
            {filterActive && (
              <span className="absolute right-[9px] top-[9px] h-[7px] w-[7px] rounded-full bg-brand" />
            )}
          </button>
        </div>

        {/* 카테고리 칩 */}
        <div className="no-scrollbar flex gap-[6px] overflow-x-auto px-[12px] py-[10px]">
          <Chip active={activeCategory === null} onClick={() => onPickCategory(null)}>
            전체
          </Chip>
          {CHIP_CATS.map((c) => (
            <Chip
              key={c}
              active={activeCategory === c}
              onClick={() => onPickCategory(activeCategory === c ? null : c)}
            >
              {CHIP_LABEL[c]}
            </Chip>
          ))}
        </div>

        <div className="px-[16px] pb-[10px] text-[13px] font-bold text-ink">
          {query.trim() ? (
            <>
              ‘{query.trim()}’ 검색{" "}
              <span className="tabular-nums text-brand">{saunas.length}</span>곳
            </>
          ) : (
            <>
              이 지역 사우나{" "}
              <span className="tabular-nums text-brand">
                {loading && saunas.length === 0 ? "…" : saunas.length}
              </span>
              곳
            </>
          )}
        </div>
      </header>

      {loading && saunas.length === 0 ? (
        <div className="flex flex-1 flex-col gap-[16px] overflow-hidden px-[16px] pt-[6px]">
          {Array.from({ length: 6 }).map((_, i) => (
            <PanelRowSkeleton key={i} />
          ))}
        </div>
      ) : saunas.length === 0 ? (
        <div className="flex flex-1 items-center justify-center px-[24px] text-center text-[13px] font-medium leading-[1.6] text-muted">
          {query.trim() ? (
            <>
              ‘{query.trim()}’ 검색 결과가 이 지역에 없어요.
              <br />
              지도를 옮기거나 검색어를 바꿔보세요.
            </>
          ) : (
            <>
              이 조건에 맞는 사우나가 이 근처에 없어요.
              <br />
              지도를 옮기거나 필터를 바꿔보세요.
            </>
          )}
        </div>
      ) : (
        <ul ref={listRef} className="no-scrollbar flex-1 overflow-y-auto">
          {saunas.map((s) => {
            const active = s.id === selectedId;
            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => onSelect(s.id)}
                  onMouseEnter={() => onHover(s.id)}
                  onMouseLeave={() => onHover(null)}
                  className={`flex w-full items-center gap-[12px] border-b border-[#F2F0EC] px-[16px] py-[12px] text-left ${
                    active ? "bg-[#FCF3F1]" : "hover:bg-[#F8F6F3]"
                  }`}
                >
                  <div className="relative h-[60px] w-[60px] flex-none overflow-hidden rounded-[12px]">
                    <SaunaImage
                      src={s.thumbnail_url}
                      alt={s.name}
                      sizes="60px"
                      iconSize={22}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-[6px]">
                      <span className="truncate text-[15px] font-semibold text-ink">
                        {s.name}
                      </span>
                      <span className="flex-none text-[11px] font-medium text-muted">
                        {CATEGORY_LABEL[primaryCategory(s)]}
                      </span>
                    </div>
                    <div className="mt-[5px]">
                      <TempHeadline
                        saunaTemp={s.sauna_room_temp}
                        coldTemp={s.cold_bath_temp}
                      />
                    </div>
                    <div className="mt-[4px] text-[12px] tabular-nums text-muted">
                      {s.distance_km != null && <>{s.distance_km}km · </>}
                      {s.dong}
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-[32px] flex-none rounded-full border px-[14px] text-[13px] font-semibold ${
        active
          ? "border-[#FAD9D1] bg-[#FFEEEA] text-brand"
          : "border-[#E5E5E9] bg-white text-[#5C5854]"
      }`}
    >
      {children}
    </button>
  );
}

/* ── 상세 (스크롤하면 전체 상세가 그대로 — 별도 페이지 이동 없음) ── */
function DetailView({
  sauna,
  photos,
  reviews,
  visitorReviews,
  loading,
  photosLoading = loading,
  onClose,
  asBack = false,
}: {
  sauna: Sauna;
  photos: SaunaPhoto[];
  reviews: BlogReview[];
  visitorReviews: SaunaReview[];
  loading: boolean;
  photosLoading?: boolean;
  onClose: () => void;
  asBack?: boolean;
}) {
  const cat = CATEGORY_LABEL[primaryCategory(sauna)];
  const galleryRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [idx, setIdx] = useState(0);
  const [copied, setCopied] = useState(false);
  // 본문 제목이 상단 바 아래로 밀려 들어가면 바에 사우나명을 고정해 보여준다(네이버지도식).
  const [titleStuck, setTitleStuck] = useState(false);

  function onScroll() {
    const el = scrollRef.current;
    const t = titleRef.current;
    if (!el || !t) return;
    const BAR_H = 52; // 상단 고정 바 높이(px)
    setTitleStuck(
      t.getBoundingClientRect().top <= el.getBoundingClientRect().top + BAR_H,
    );
  }

  async function copyAddress() {
    try {
      await navigator.clipboard.writeText(sauna.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* 클립보드 권한 없음 — 무시 */
    }
  }

  function onGalleryScroll() {
    const el = galleryRef.current;
    if (!el) return;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    setIdx(Math.max(0, Math.min(photos.length - 1, i)));
  }
  // 좌우 화살표 — 한 장씩 부드럽게 이동(데스크톱 마우스용).
  function goPhoto(delta: number) {
    const el = galleryRef.current;
    if (!el) return;
    const target = Math.max(0, Math.min(photos.length - 1, idx + delta));
    el.scrollTo({ left: target * el.clientWidth, behavior: "smooth" });
  }

  return (
    <div className="relative flex h-full flex-col">
      {/* 상단 고정 바 — 닫기·찜은 항상 보이고, 스크롤로 제목이 밀리면 사우나명이 여기 고정된다.
          비스크롤(사진 위)에선 배경 투명, 스크롤되면 흰 배경으로 바뀐다. */}
      <div
        className={`pointer-events-none absolute inset-x-0 top-0 z-20 flex h-[52px] items-center gap-[8px] px-[12px] transition-colors duration-200 ${
          titleStuck ? "border-b border-[#EEECE8] bg-card/95 backdrop-blur" : ""
        }`}
      >
        <span
          className={`min-w-0 flex-1 truncate text-[16px] font-extrabold tracking-[-0.02em] text-ink transition-opacity duration-200 ${
            titleStuck ? "opacity-100" : "opacity-0"
          }`}
        >
          {sauna.name}
        </span>
        <div className="pointer-events-auto flex h-[38px] w-[38px] items-center justify-center rounded-full bg-white/90 shadow-[0_1px_6px_rgba(0,0,0,0.18)] backdrop-blur">
          <FavoriteScrubber saunaId={sauna.id} size={28} onLight />
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={asBack ? "목록으로" : "상세 닫기"}
          className="pointer-events-auto flex h-[34px] w-[34px] cursor-pointer items-center justify-center rounded-full bg-white/90 text-ink shadow-[0_1px_6px_rgba(0,0,0,0.18)] backdrop-blur hover:bg-white"
        >
          {asBack ? <ChevronLeft size={19} /> : <X size={18} />}
        </button>
      </div>

      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="no-scrollbar flex flex-1 flex-col overflow-y-auto"
      >
      {/* 사진 갤러리 */}
      <div className="relative flex-none">
        {photosLoading ? (
          <div className="h-[220px] w-full animate-pulse bg-[#EEF0F2]" />
        ) : photos.length > 0 ? (
          <div
            ref={galleryRef}
            onScroll={onGalleryScroll}
            className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto"
          >
            {photos.map((p, i) => (
              // 회색 판을 칸에 깔아둔다 — 응답은 왔는데 이미지 바이트가 아직인 구간에
              // 흰 여백이 보이던 것을 막는다(이미지가 그 위에 얹힌다).
              <div
                key={p.id}
                className="relative h-[220px] w-full flex-none snap-center bg-[#EEF0F2]"
              >
                <SaunaImage
                  src={p.url}
                  alt={sauna.name}
                  sizes="400px"
                  priority={i === 0}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="relative h-[160px] w-full">
            <SaunaImage src={null} alt={sauna.name} iconSize={40} />
          </div>
        )}

        {photos.length > 1 && (
          <>
            {idx > 0 && (
              <button
                type="button"
                onClick={() => goPhoto(-1)}
                aria-label="이전 사진"
                className="absolute left-[10px] top-1/2 flex h-[32px] w-[32px] -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-white/85 text-ink shadow-[0_1px_6px_rgba(0,0,0,0.22)] backdrop-blur hover:bg-white"
              >
                <ChevronLeft size={20} />
              </button>
            )}
            {idx < photos.length - 1 && (
              <button
                type="button"
                onClick={() => goPhoto(1)}
                aria-label="다음 사진"
                className="absolute right-[10px] top-1/2 flex h-[32px] w-[32px] -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-white/85 text-ink shadow-[0_1px_6px_rgba(0,0,0,0.22)] backdrop-blur hover:bg-white"
              >
                <ChevronRight size={20} />
              </button>
            )}
            <span className="absolute bottom-[10px] right-[12px] rounded-full bg-black/55 px-[9px] py-[3px] text-[11px] font-semibold tabular-nums text-white">
              {idx + 1} / {photos.length}
            </span>
          </>
        )}
      </div>

      <div className="flex flex-col gap-[20px] px-[20px] pb-[28px] pt-[16px]">
        {/* 헤더 */}
        <div>
          <div className="flex items-center gap-[8px]">
            <h2
              ref={titleRef}
              className="text-[20px] font-extrabold leading-[1.2] tracking-[-0.02em] text-ink"
            >
              {sauna.name}
            </h2>
            <span className="inline-flex flex-none items-center rounded-full bg-[#F6F5F4] px-[10px] py-[3px] text-[12px] font-semibold text-ink">
              {cat}
            </span>
          </div>
          <div className="mt-[8px] flex items-center gap-[7px]">
            <FlameRating value={sauna.rating_avg ?? 0} size={16} gap={2} />
            <span
              className={`text-[14px] font-bold tabular-nums ${
                sauna.rating_avg != null ? "text-hot" : "text-dot"
              }`}
            >
              {(sauna.rating_avg ?? 0).toFixed(1)}
            </span>
            <span className="text-[13px] text-muted tabular-nums">
              후기 {sauna.rating_count ?? 0}
            </span>
          </div>
          <div className="mt-[6px] flex items-start gap-[6px] text-[13px] text-muted">
            <span className="min-w-0 flex-1 tabular-nums">
              {sauna.distance_km != null && <>{sauna.distance_km}km · </>}
              {sauna.address}
            </span>
            <button
              type="button"
              onClick={copyAddress}
              aria-label="주소 복사"
              className={`flex h-[24px] w-[24px] flex-none cursor-pointer items-center justify-center rounded-[7px] hover:bg-[#F4F2EF] ${
                copied ? "text-brand" : "text-muted hover:text-ink"
              }`}
            >
              {copied ? <Check size={15} /> : <Copy size={15} />}
            </button>
          </div>
        </div>

        {/* 상세 본문 — 상세 페이지와 동일(탭: 상세 정보 / 후기, 상세 탭에 대표 후기 미리보기).
            위치 미니맵은 이미 지도 위라 중복이므로 패널에선 숨긴다. */}
        <SaunaDetailBody
          sauna={sauna}
          reviews={reviews}
          visitorReviews={visitorReviews}
          showLocationMap={false}
        />
      </div>
      </div>
    </div>
  );
}
