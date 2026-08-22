"use client";

import { useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import Link from "next/link";
import {
  List,
  RefreshCw,
  MapPinned,
  LocateFixed,
  Loader2,
  ChevronRight,
  ChevronLeft,
  Plus,
  Minus,
} from "lucide-react";
import {
  BathhouseChip,
  JjimjilbangChip,
  LodgingChip,
  Night24Chip,
} from "@/components/illustrations";
import type {
  Sauna,
  GeoPoint,
  SaunaCategory,
  VenueType,
  SaunaPhoto,
  BlogReview,
  SaunaReview,
} from "@/lib/data/types";
import { VENUE_LABEL } from "@/lib/data/types";

// 지도 상단 컴팩트 칩(네이버식) — 변별력 있는 빠른 필터만. 독립형(≈전체)은 제외.
// type=탕 종류 축, venue=장소 축. 둘 다 현재 필터를 보존한 채 해당 축만 토글한다.
// 아이콘은 범용 라인 아이콘 대신 서비스 공용 일러스트(components/illustrations)를 쓴다 —
// 같은 용어(목욕탕·찜질방…)가 홈/지도 어디서나 같은 시각 언어로 읽히게. 색은 일러스트 자체에 있음.
const TOP_CHIPS: {
  label: string;
  type?: SaunaCategory;
  venue?: VenueType;
  open?: "24h";
  Illust: ComponentType<{ size?: number }>;
}[] = [
  { label: "목욕탕", type: "bathhouse", Illust: BathhouseChip },
  { label: "찜질방", type: "jjimjilbang", Illust: JjimjilbangChip },
  { label: "24시 영업", open: "24h", Illust: Night24Chip },
  { label: VENUE_LABEL.lodging, venue: "lodging", Illust: LodgingChip },
  // 커뮤니티(체육·복지시설)는 변별력·이름 모호성 탓에 상단 빠른칩에서 제외.
  // 필터 시트의 '장소 유형'에는 그대로 남아있다(FilterSheet VENUE_CHIPS).
];
import { MapSidePanel, MapDetailPanel } from "@/components/map/MapSidePanel";
import {
  BottomSheet,
  SHEET_HANDLE_PX,
  type BottomSheetHandle,
} from "@/components/map/BottomSheet";
import {
  FilterSheet,
  DEFAULT_FILTERS,
  isDefaultFilters,
  matchesFilters,
  type SheetFilters,
} from "@/components/sauna/FilterSheet";

type Located = Sauna & { location: GeoPoint };

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    naver?: any;
    navermap_authFailure?: () => void;
  }
}

const CLIENT_ID = process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID;

let loaderPromise: Promise<void> | null = null;
function loadNaverMaps(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject();
  if (window.naver?.maps) return Promise.resolve();
  if (loaderPromise) return loaderPromise;
  loaderPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${CLIENT_ID}`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("naver maps load failed"));
    document.head.appendChild(script);
  });
  return loaderPromise;
}

// 핀 마크 — 카테고리와 무관하게 모든 핀이 같은 ♨ 사우나 심볼을 쓴다.
// (핀마다 다른 분류 아이콘은 범례 없이는 해독 불가 → 혼동만 줬음. 분류는 상단 필터칩이 담당.)
// 글리프는 HomeTabIcon(components/layout/TabIcons.tsx)과 동일 — 시각적 단일 출처(SOT).
// React 컴포넌트는 마커 content에 못 쓰므로 같은 path 를 인라인 SVG 문자열로 둔다.
// stroke=currentColor 라 pinHtml 의 tint(선택·호버=흰색/기본=#2A2724)를 그대로 상속.
// 15px 에서 가늘어 보이지 않게 stroke-width 만 2.4(HomeTabIcon 은 viewBox24 에서 2.6).
const MARK_OPEN =
  '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">';
const SAUNA_MARK =
  MARK_OPEN +
  '<path d="M8 13.2c-1.6-1.6 1.6-3 0-4.6s-1.6-3 0-4.6"/>' +
  '<path d="M12 13.4c-1.7-1.7 1.7-3.1 0-4.9s-1.7-3.1 0-4.9"/>' +
  '<path d="M16 13.2c-1.6-1.6 1.6-3 0-4.6s-1.6-3 0-4.6"/>' +
  '<path d="M3.4 13c-.4 5.6 3.6 6 8.6 6s9-.4 8.6-6"/></svg>';

// 마커 라벨에 그대로 넣기 전 HTML 이스케이프(상호에 &, < 등 섞일 수 있음).
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// 네이버지도식 핀: 말풍선 없이 작은 원형 사우나 아이콘 + 그 아래 상호 텍스트.
// 라벨은 지도 타일 위에 바로 얹히므로 흰 후광(text-shadow)으로 읽히게 한다.
function pinHtml(s: Sauna, selected: boolean, hovered = false): string {
  const on = selected || hovered;
  // 아이콘 토큰: 기본=흰 원 + 먹색 마크 / 선택·호버=빨강 원 + 흰 마크(살짝 확대).
  const dotBg = on ? "#F5402C" : "#fff";
  const tint = on ? "#fff" : "#2A2724"; // 마크 stroke=currentColor 가 상속
  const dotBorder = on ? "1.5px solid #fff" : "1px solid rgba(34,32,30,.10)";
  const shadow = on ? "0 4px 12px rgba(245,64,44,.34)" : "0 2px 6px rgba(0,0,0,.20)";
  const scale = on ? "scale(1.12)" : "scale(1)";
  const z = on ? "z-index:3;" : "";
  const dot = `<div style="width:28px;height:28px;border-radius:999px;background:${dotBg};border:${dotBorder};box-shadow:${shadow};display:flex;align-items:center;justify-content:center;color:${tint};transform:${scale};transform-origin:50% 100%;">${SAUNA_MARK}</div>`;
  // 라벨은 absolute — 아이콘 하단이 좌표에 정확히 앉도록 레이아웃에서 빼둔다.
  const labelColor = on ? "#F5402C" : "#22201E";
  const label = `<div style="position:absolute;top:100%;left:50%;transform:translateX(-50%);margin-top:3px;max-width:96px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:700 12px Pretendard;line-height:1.25;color:${labelColor};text-shadow:0 0 3px #fff,0 0 3px #fff,0 1px 2px rgba(255,255,255,.9);">${escapeHtml(s.name)}</div>`;
  return `<div style="${z}position:relative;transform:translate(-50%,-100%);cursor:pointer;">${dot}${label}</div>`;
}

// 줌아웃 시 개별 핀 대신 지역 집계 버블. 클수록 살짝 크게(밀도 직관).
function clusterHtml(label: string, count: number): string {
  const big = count >= 100;
  const pad = big ? "9px 15px" : "7px 13px";
  const num = big ? 17 : 15;
  return `<div style="transform:translate(-50%,-50%);background:#fff;border:1px solid #fff;border-radius:999px;box-shadow:0 3px 12px rgba(0,0,0,.20);padding:${pad};display:flex;flex-direction:column;align-items:center;line-height:1.1;font-family:Pretendard;white-space:nowrap;cursor:pointer;">
    <span style="font-size:11px;font-weight:600;color:#7A766F">${label}</span>
    <span style="font-weight:800;color:#F5402C;font-size:${num}px">${count}<span style="font-size:11px;font-weight:600;color:#A8A39C">곳</span></span>
  </div>`;
}

// 행정구역명을 줄여 버블 라벨을 짧게(서울특별시→서울, 경상남도→경남).
const SIDO_SHORT: Record<string, string> = {
  충청북도: "충북",
  충청남도: "충남",
  전라북도: "전북",
  전라남도: "전남",
  경상북도: "경북",
  경상남도: "경남",
  전북특별자치도: "전북",
  강원특별자치도: "강원",
  제주특별자치도: "제주",
};
function shortSido(sido: string): string {
  if (SIDO_SHORT[sido]) return SIDO_SHORT[sido];
  return sido.replace(/특별자치시$|광역시$|특별시$|자치도$|도$/u, "") || sido;
}

// 두 좌표 간 거리(m) — "이 지역 재검색" 노출 판단용(대략값이면 충분).
function metersBetween(a: GeoPoint, b: GeoPoint): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

// 내 위치 — 파란 점 + 흰 테두리 + 정확도 후광(중앙 앵커).
const ME_DOT =
  '<div style="transform:translate(-50%,-50%);width:18px;height:18px;border-radius:999px;background:#1C6FFF;border:3px solid #fff;box-shadow:0 0 0 6px rgba(28,111,255,.20),0 2px 6px rgba(0,0,0,.30)"></div>';

type ClusterLevel = "sido" | "sigungu" | "pin";
// 줌 13(기본)부터 개별 핀 → 전국 뷰에서는 시·도로 집계.
function clusterLevel(zoom: number): ClusterLevel {
  if (zoom < 9) return "sido";
  if (zoom < 12) return "sigungu";
  return "pin";
}

type Status = "loading" | "ready" | "nokey" | "error" | "authfail";

export function NaverMapView({
  saunas,
  initialCenter,
}: {
  saunas: Sauna[];
  initialCenter?: GeoPoint;
}) {
  // 사우나 목록은 동적 — "이 지역 재검색" 시 현재 지도 중심으로 교체된다.
  const [saunaList, setSaunaList] = useState<Sauna[]>(saunas);
  // 필터 시트 — draft(시트 안에서 만지는 값) / sheet(적용된 값) 분리(리스트뷰와 동일 패턴).
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetDraft, setSheetDraft] = useState<SheetFilters>(DEFAULT_FILTERS);
  const [sheet, setSheet] = useState<SheetFilters>(DEFAULT_FILTERS);
  // 패널 검색어 — 지도를 떠나지 않고 그 자리에서 목록·마커를 좁힌다(상호·지역·주소).
  const [query, setQuery] = useState("");
  // 좌표가 있는 사우나(필터 후보) → 적용 필터를 통과한 것만 지도·캐러셀에 노출.
  const located = useMemo(
    () => saunaList.filter((s): s is Located => Boolean(s.location)),
    [saunaList],
  );
  const withLoc = useMemo(() => {
    const base = located.filter((s) => matchesFilters(s, sheet));
    const term = query.trim().toLowerCase();
    if (!term) return base;
    // /search 와 동일한 필드 매칭(상호·시군구·동·주소) — 지도 위에서 그대로 좁힌다.
    return base.filter((s) =>
      [s.name, s.sigungu, s.dong, s.address].some((f) =>
        f?.toLowerCase().includes(term),
      ),
    );
  }, [located, sheet, query]);
  const withLocRef = useRef<Located[]>(withLoc); // 마커 생성 클로저가 최신 목록을 읽도록
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<Record<string, any>>({}); // 개별 핀(선택 스타일 갱신용)
  const allMarkersRef = useRef<any[]>([]); // 현재 지도에 올라간 모든 마커(재렌더 시 정리)
  const rootRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<string | null>(withLoc[0]?.id ?? null);
  const [hovered, setHovered] = useState<string | null>(null); // 캐러셀 카드 호버 중인 사우나
  const [status, setStatus] = useState<Status>(CLIENT_ID ? "loading" : "nokey");
  const [ready, setReady] = useState(false); // 컨테이너 높이 확보 후 지도 생성
  const [locating, setLocating] = useState(false); // 내 위치 조회 중
  const [geoMsg, setGeoMsg] = useState<string | null>(null); // 위치 권한 안내 토스트
  const [researching, setResearching] = useState(false); // 이 지역 재검색 진행 중
  const [showResearch, setShowResearch] = useState(false); // 지도 이동 후 재검색 버튼 노출
  const [panelId, setPanelId] = useState<string | null>(null); // 상세 패널 대상(null=목록 뷰)
  const [panelPhotos, setPanelPhotos] = useState<SaunaPhoto[]>([]);
  const [panelReviews, setPanelReviews] = useState<BlogReview[]>([]);
  const [panelVisitorReviews, setPanelVisitorReviews] = useState<SaunaReview[]>([]);
  const [panelLoading, setPanelLoading] = useState(false);
  const [collapsed, setCollapsed] = useState(false); // 좌측 패널 접힘(지도 전체 보기)
  // 좌표 진입 초기 목록 로딩 — 마운트 시 /api/nearby 가 채워질 때까지 패널에 스켈레톤 표시.
  const [listLoading, setListLoading] = useState(
    Boolean(initialCenter) && saunas.length === 0,
  );
  const [isDesktop, setIsDesktop] = useState(false); // lg+ = 좌측 패널, 그 미만 = 바텀시트
  // 모바일 바텀시트가 지도를 가리는 높이(px) — 지도 중심 보정·플로팅 버튼 위치의 기준.
  const [listCover, setListCover] = useState(0);
  // 모바일 시트 조작 핸들(목록→상세로 넘어갈 때 시트를 올려 상세가 바로 읽히게).
  const sheetRef = useRef<BottomSheetHandle | null>(null);
  const meMarkerRef = useRef<any>(null); // 내 위치 파란 점
  // 현재 결과를 가져온 검색 중심(여기서 멀어지면 "이 지역 재검색"을 띄운다).
  const searchCenterRef = useRef<GeoPoint | null>(initialCenter ?? null);
  const suppressPanRef = useRef(false); // 재검색發 선택은 지도를 끌고가지 않게
  const selectedRef = useRef<string | null>(null); // 줌 재렌더 시 선택 핀 스타일 유지용
  const hoveredRef = useRef<string | null>(null);
  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);
  // ref 쓰기는 커밋 후에만 — 아래 마커 재렌더 이펙트보다 먼저 선언돼 있어야 최신 목록이 보인다.
  useEffect(() => {
    withLocRef.current = withLoc;
  }, [withLoc]);

  // 오버레이가 차지하는 영역 — 데스크톱은 좌측 패널 폭(x), 모바일은 바텀시트 높이(y).
  // 모바일 시트는 목록·상세가 한 장을 공유하므로(겹쳐 띄우지 않음) 가림 높이도 하나다.
  const coverPx = isDesktop ? 0 : listCover;
  const occupiedX = isDesktop ? (collapsed ? 0 : 400) + (panelId ? 400 : 0) : 0;

  // 지도 이동의 단일 창구 — 오버레이(좌측 패널·바텀시트)를 뺀 '보이는 지도 영역'의
  // 중앙에 목표 좌표가 오도록 중심을 보정한다. 화면 오프셋에서 y 는 아래로 증가하므로,
  // 중심을 가림 높이의 절반만큼 아래로 밀면 목표는 그만큼 위(=보이는 영역 중앙)로 온다.
  function centerOn(
    point: GeoPoint,
    opts?: { zoom?: number; animate?: boolean },
  ) {
    const naver = window.naver;
    const map = mapRef.current;
    if (!naver || !map) return;
    // 줌을 먼저 확정해야 아래 픽셀 보정이 그 줌 기준으로 계산된다.
    if (opts?.zoom != null && map.getZoom() !== opts.zoom) map.setZoom(opts.zoom);
    const target = new naver.maps.LatLng(point.lat, point.lng);
    const x = occupiedX;
    const y = coverPx;
    let dest = target;
    if (x > 0 || y > 0) {
      const proj = map.getProjection();
      const pt = proj.fromCoordToOffset(target);
      dest = proj.fromOffsetToCoord(
        new naver.maps.Point(pt.x - x / 2, pt.y + y / 2),
      );
    }
    if (opts?.animate === false) map.setCenter(dest);
    else map.panTo(dest);
  }

  // 뷰포트 폭으로 패널 형태 결정 — lg(1024px)+ 좌측 패널 / 미만 바텀시트.
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // 좌표 진입("내 주변") — 서버 SSR 이 목록을 비워 보내므로(=대기 제거), 마운트 즉시
  // /api/nearby 로 주변을 병렬 로드한다. 지도 SDK 다운로드와 동시에 진행돼 진입이 빨라진다.
  useEffect(() => {
    if (!initialCenter || saunaList.length > 0) return;
    let cancelled = false;
    fetch(
      `/api/nearby?lat=${initialCenter.lat.toFixed(6)}&lng=${initialCenter.lng.toFixed(6)}`,
    )
      .then((r) => r.json())
      .then((j) => {
        if (cancelled || !Array.isArray(j.saunas)) return;
        setSaunaList(j.saunas as Sauna[]);
        const first = (j.saunas as Sauna[]).find((s) => s.location);
        suppressPanRef.current = true; // 첫 선택이 지도를 끌고가지 않게
        setSelected(first?.id ?? null);
      })
      .catch(() => {
        /* 실패 시 빈 목록 유지 — 지도는 내 위치 중심으로 열림 */
      })
      .finally(() => {
        if (!cancelled) setListLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 내 주변 보기 — 버튼 클릭 시 브라우저 위치 동의를 띄우고, 허용되면 내 위치로 이동.
  function locateMe() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGeoMsg("이 기기에서는 위치를 사용할 수 없어요.");
      return;
    }
    setLocating(true);
    setGeoMsg(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const naver = window.naver;
        const map = mapRef.current;
        if (!naver || !map) return;
        const ll = new naver.maps.LatLng(pos.coords.latitude, pos.coords.longitude);
        if (meMarkerRef.current) meMarkerRef.current.setPosition(ll);
        else
          meMarkerRef.current = new naver.maps.Marker({
            position: ll,
            map,
            zIndex: 50,
            icon: { content: ME_DOT, anchor: new naver.maps.Point(0, 0) },
          });
        // 개별 핀이 보이는 줌으로 내 주변을 펼치되, 바텀시트에 가려지지 않는 영역의 중앙에 둔다.
        centerOn(
          { lat: pos.coords.latitude, lng: pos.coords.longitude },
          { zoom: 14 },
        );
      },
      (err) => {
        setLocating(false);
        setGeoMsg(
          err.code === err.PERMISSION_DENIED
            ? "위치 권한이 꺼져 있어요. 브라우저 주소창의 위치 아이콘에서 허용해 주세요."
            : "현재 위치를 가져오지 못했어요. 잠시 후 다시 시도해 주세요.",
        );
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 },
    );
  }

  // 이 지역 재검색 — 현재 지도 중심 좌표로 주변 사우나를 다시 불러와 목록·마커·캐러셀 교체.
  async function researchHere() {
    const map = mapRef.current;
    if (!map || researching) return;
    const c = map.getCenter();
    const lat = c.lat();
    const lng = c.lng();
    setResearching(true);
    try {
      const res = await fetch(
        `/api/nearby?lat=${lat.toFixed(6)}&lng=${lng.toFixed(6)}`,
      );
      const json = await res.json();
      if (res.ok && Array.isArray(json.saunas)) {
        setSaunaList(json.saunas as Sauna[]);
        const first = (json.saunas as Sauna[]).find((s) => s.location);
        suppressPanRef.current = true; // 선택이 지도를 가까운 핀으로 끌고가지 않게
        setSelected(first?.id ?? null);
        searchCenterRef.current = { lat, lng };
        setShowResearch(false);
      }
    } catch {
      /* 네트워크 실패 — 기존 목록 유지(조용히) */
    } finally {
      setResearching(false);
    }
  }

  // 사우나 클릭 → 상세 열기(선택 동기화).
  // 데스크톱: 목록 옆에 상세 패널. 모바일: 같은 바텀시트가 목록 → 상세로 넘어간다(겹쳐 띄우지 않음).
  // 리스트 접힘 상태는 건드리지 않는다 — 접어둔 채 클릭하면 상세만 단독으로 뜬다.
  function openPanel(id: string) {
    setSelected(id);
    setPanelId(id);
    // 목록 위치(0.62)에 그대로 두면 상세가 손바닥만큼만 보인다 — 시트를 올려준다.
    sheetRef.current?.raiseTo(0.36);
  }

  // 우측 기능 레일 — 줌.
  function zoomBy(delta: number) {
    const m = mapRef.current;
    if (m) m.setZoom(m.getZoom() + delta, true);
  }

  // 상단 카테고리 칩 — 단일 카테고리 빠른 필터(고급 필터는 초기화).
  function pickCategory(cat: SaunaCategory | null) {
    const next = { ...DEFAULT_FILTERS, types: cat ? [cat] : [] };
    setSheet(next);
    setSheetDraft(next);
    const filtered = located.filter((s) => matchesFilters(s, next));
    suppressPanRef.current = true;
    setSelected(filtered[0]?.id ?? null);
    setPanelId(null); // 목록으로
  }
  // 상단 컴팩트 칩 토글 — 현재 필터를 보존한 채 해당 축(type/venue)만 켜고 끈다.
  function toggleTopChip(c: (typeof TOP_CHIPS)[number]) {
    let next: SheetFilters;
    if (c.open) {
      next = { ...sheet, open: sheet.open === c.open ? "any" : c.open };
    } else if (c.venue) {
      const venues = sheet.venues.includes(c.venue)
        ? sheet.venues.filter((x) => x !== c.venue)
        : [...sheet.venues, c.venue];
      next = { ...sheet, venues };
    } else {
      const t = c.type!;
      const types = sheet.types.includes(t)
        ? sheet.types.filter((x) => x !== t)
        : [...sheet.types, t];
      next = { ...sheet, types };
    }
    setSheet(next);
    setSheetDraft(next);
    const filtered = located.filter((s) => matchesFilters(s, next));
    suppressPanRef.current = true;
    setSelected(filtered[0]?.id ?? null);
    setPanelId(null);
  }
  const isTopChipActive = (c: (typeof TOP_CHIPS)[number]) =>
    c.open
      ? sheet.open === c.open
      : c.venue
        ? sheet.venues.includes(c.venue)
        : sheet.types.includes(c.type!);

  // 칩 활성: 단일 타입 필터일 때만(고급 필터 조합은 칩 비활성).
  const activeCategory: SaunaCategory | null =
    sheet.kinds.length === 0 &&
    sheet.sesin === "any" &&
    sheet.open === "any" &&
    sheet.types.length === 1
      ? sheet.types[0]
      : null;
  const filterActive = !isDefaultFilters(sheet);

  // 패널 대상이 바뀌면 이전 매장의 사진·후기를 즉시 비운다.
  // 이펙트가 아니라 렌더 중 조정 — 이펙트로 비우면 새 매장 화면에 이전 매장 사진이 한 프레임 남는다.
  const [fetchedPanelId, setFetchedPanelId] = useState<string | null>(null);
  if (panelId !== fetchedPanelId) {
    setFetchedPanelId(panelId);
    setPanelPhotos([]);
    setPanelReviews([]);
    setPanelVisitorReviews([]);
    setPanelLoading(Boolean(panelId));
  }

  // 패널 대상이 바뀌면 사진+후기를 가져온다(정책 OFF/미수집이면 빈 배열 → 폴백 표시).
  useEffect(() => {
    if (!panelId) return;
    let cancelled = false;
    fetch(`/api/sauna-detail?id=${encodeURIComponent(panelId)}`)
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        if (Array.isArray(j.photos)) setPanelPhotos(j.photos as SaunaPhoto[]);
        if (Array.isArray(j.reviews)) setPanelReviews(j.reviews as BlogReview[]);
        if (Array.isArray(j.visitorReviews))
          setPanelVisitorReviews(j.visitorReviews as SaunaReview[]);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setPanelLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [panelId]);

  // 안내 토스트는 잠깐 보여주고 사라지게.
  useEffect(() => {
    if (!geoMsg) return;
    const t = setTimeout(() => setGeoMsg(null), 4000);
    return () => clearTimeout(t);
  }, [geoMsg]);

  // 핀 하나의 아이콘을 현재 선택·호버 상태에 맞춰 다시 그린다(선택 글로우와 호버 링 공존).
  function styleMarker(id: string | null) {
    if (!id) return;
    const naver = window.naver;
    const m = markersRef.current[id];
    const s = withLocRef.current.find((x) => x.id === id);
    if (naver && m && s)
      m.setIcon({
        content: pinHtml(s, id === selectedRef.current, id === hoveredRef.current),
        anchor: new naver.maps.Point(0, 0),
      });
  }

  // 현재 줌에 맞춰 마커를 (재)구성: 줌인이면 개별 핀, 줌아웃이면 지역 집계 버블.
  function renderMarkers() {
    const naver = window.naver;
    const map = mapRef.current;
    if (!naver || !map) return;

    allMarkersRef.current.forEach((m) => m.setMap(null));
    allMarkersRef.current = [];
    markersRef.current = {};

    if (clusterLevel(map.getZoom()) === "pin") {
      withLocRef.current.forEach((s) => {
        const marker = new naver.maps.Marker({
          position: new naver.maps.LatLng(s.location.lat, s.location.lng),
          map,
          icon: {
            content: pinHtml(
              s,
              s.id === selectedRef.current,
              s.id === hoveredRef.current,
            ),
            anchor: new naver.maps.Point(0, 0),
          },
        });
        naver.maps.Event.addListener(marker, "click", () => openPanel(s.id));
        markersRef.current[s.id] = marker;
        allMarkersRef.current.push(marker);
      });
      return;
    }

    // 지역 집계: 시·도(전국 뷰) 또는 시·군·구(중간 줌)로 묶어 카운트 버블 하나씩.
    const level = clusterLevel(map.getZoom());
    const groups = new Map<string, Located[]>();
    withLocRef.current.forEach((s) => {
      const key = level === "sido" ? s.sido : `${s.sido} ${s.sigungu}`;
      const arr = groups.get(key);
      if (arr) arr.push(s);
      else groups.set(key, [s]);
    });

    groups.forEach((members) => {
      const lat = members.reduce((a, s) => a + s.location.lat, 0) / members.length;
      const lng = members.reduce((a, s) => a + s.location.lng, 0) / members.length;
      const label = level === "sido" ? shortSido(members[0].sido) : members[0].sigungu;
      const marker = new naver.maps.Marker({
        position: new naver.maps.LatLng(lat, lng),
        map,
        icon: {
          content: clusterHtml(label, members.length),
          anchor: new naver.maps.Point(0, 0),
        },
      });
      // 버블 클릭 → 한 단계 더 파고든다(시·도→시·군·구 줌, 시·군·구→개별 핀 줌).
      naver.maps.Event.addListener(marker, "click", () =>
        map.morph(new naver.maps.LatLng(lat, lng), level === "sido" ? 10 : 13),
      );
      allMarkersRef.current.push(marker);
    });
  }

  // 인증 실패(Web 서비스 URL 미등록 등) 전역 콜백 — 스크립트 로드 전에 등록
  useEffect(() => {
    window.navermap_authFailure = () => setStatus("authfail");
  }, []);

  // 지도 초기화 + 마커 — 컨테이너 높이가 잡힌(ready) 뒤에 1회 생성
  useEffect(() => {
    if (!CLIENT_ID || !ready || mapRef.current || !mapEl.current) return;
    let cancelled = false;

    loadNaverMaps()
      .then(() => {
        if (cancelled || mapRef.current || !mapEl.current) return;
        const naver = window.naver;
        // 홈 "내 주변"에서 위치 동의 후 넘어왔으면 내 좌표에서, 아니면 첫 사우나/서울 기본값에서 연다.
        const center = initialCenter ?? withLoc[0]?.location ?? { lat: 37.5006, lng: 127.0366 };
        const map = new naver.maps.Map(mapEl.current, {
          center: new naver.maps.LatLng(center.lat, center.lng),
          zoom: initialCenter ? 14 : 13,
          scaleControl: false,
          mapDataControl: false,
          // NAVER 로고는 약관상 숨길 수 없어 좌측 패널을 피해 우하단에 둔다.
          logoControlOptions: { position: naver.maps.Position.BOTTOM_RIGHT },
        });
        mapRef.current = map;

        renderMarkers();
        // 줌이 바뀔 때마다 집계 단계(시·도/시·군·구/개별 핀)를 다시 그린다.
        naver.maps.Event.addListener(map, "zoom_changed", renderMarkers);

        // 지도가 멈출 때마다, 검색 중심에서 충분히 벗어났으면 "이 지역 재검색" 노출.
        naver.maps.Event.addListener(map, "idle", () => {
          if (clusterLevel(map.getZoom()) !== "pin") {
            setShowResearch(false); // 집계(줌아웃) 상태에선 지역검색 무의미
            return;
          }
          const c = map.getCenter();
          const cur = { lat: c.lat(), lng: c.lng() };
          if (!searchCenterRef.current) {
            searchCenterRef.current = cur; // 기준점 미설정(좌표없이 진입) → 첫 정지에서 baseline
            return;
          }
          const b = map.getBounds();
          const sw = b.getSW();
          const ne = b.getNE();
          const spanM = metersBetween(
            { lat: sw.lat(), lng: sw.lng() },
            { lat: sw.lat(), lng: ne.lng() },
          );
          const moved = metersBetween(searchCenterRef.current, cur);
          setShowResearch(moved > Math.max(400, spanM * 0.25));
        });

        naver.maps.Event.trigger(map, "resize");
        setStatus("ready");
      })
      .catch(() => !cancelled && setStatus("error"));

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  // 내 위치(initialCenter)로 확실히 이동 + 파란 점 — 지도가 준비된 직후 1회 적용.
  // init 에서 center 를 잡지만, 이 효과가 status=ready 시점에 다시 보장하므로
  // 좌표만 바뀌는 클라이언트 내비(같은 /map 경로 유지)도 커버한다.
  // 바텀시트 높이는 마운트 직후엔 아직 0 이라, 시트가 정착해 가림 높이가 잡히면
  // 같은 좌표로 한 번 더 보정한다(그 뒤 사용자가 시트를 끌어도 지도는 건드리지 않음).
  const initCenteredRef = useRef<{ key: string; cover: number } | null>(null);
  useEffect(() => {
    if (!initialCenter || status !== "ready") return;
    const naver = window.naver;
    const map = mapRef.current;
    if (!naver || !map) return;
    const key = `${initialCenter.lat},${initialCenter.lng}`;
    const prev = initCenteredRef.current;
    if (prev && prev.key === key && (prev.cover > 0 || coverPx === 0)) return;
    initCenteredRef.current = { key, cover: coverPx };
    const ll = new naver.maps.LatLng(initialCenter.lat, initialCenter.lng);
    centerOn(initialCenter, { zoom: 14, animate: false });
    if (meMarkerRef.current) meMarkerRef.current.setPosition(ll);
    else
      meMarkerRef.current = new naver.maps.Marker({
        position: ll,
        map,
        zIndex: 50,
        icon: { content: ME_DOT, anchor: new naver.maps.Point(0, 0) },
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, initialCenter?.lat, initialCenter?.lng, coverPx]);

  // 상세로 넘어가면 시트에 가려지지 않는 영역의 중앙으로 해당 핀을 다시 잡아준다.
  // 시트가 올라가 가림 높이가 갱신된 뒤 한 번만 — 이미 선택돼 있던 핀을 눌러도 동작한다.
  const detailCenteredRef = useRef<string | null>(null);
  useEffect(() => {
    if (!panelId) {
      detailCenteredRef.current = null;
      return;
    }
    if (isDesktop || !coverPx || detailCenteredRef.current === panelId) return;
    const s = withLocRef.current.find((x) => x.id === panelId);
    if (!s) return;
    detailCenteredRef.current = panelId;
    centerOn(s.location);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panelId, coverPx, isDesktop]);

  // 재검색·필터로 노출 목록이 바뀌면 마커를 다시 그린다(withLocRef 동기화 이펙트가 먼저 돈다).
  useEffect(() => {
    if (status === "ready") renderMarkers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [withLoc, status]);

  // 높이를 부모의 실제 픽셀(clientHeight)로 직접 지정 — CSS 높이 체인 우회.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const measure = () => {
      const parent = root.parentElement;
      const w = parent?.clientWidth || window.innerWidth;
      const h = parent?.clientHeight || window.innerHeight - 66;
      root.style.height = h + "px";
      // mapEl(지도가 들어가는 실제 요소)에 픽셀 크기를 직접 박는다 — 0크기 방지
      if (mapEl.current) {
        mapEl.current.style.width = w + "px";
        mapEl.current.style.height = h + "px";
        if (mapEl.current.clientHeight > 0) setReady(true);
      }
      if (mapRef.current && window.naver)
        window.naver.maps.Event.trigger(mapRef.current, "resize");
    };
    measure();
    const t1 = setTimeout(measure, 100);
    const t2 = setTimeout(measure, 400);
    const ro = root.parentElement ? new ResizeObserver(measure) : null;
    if (ro && root.parentElement) ro.observe(root.parentElement);
    window.addEventListener("resize", measure);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      ro?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  // 선택 변경 → 바뀐 핀 2개(이전·현재)만 갱신 + 지도 패닝.
  // 과거엔 매 선택마다 withLoc 전체(최대 250개) setIcon → 핀 DOM 통째 재생성으로
  // 렌더 폭주·버벅임이 났고, 캐러셀 스크롤 중 선택이 연속으로 바뀌면 더 심했다.
  // 초기값을 첫 선택(withLoc[0])으로 — 마운트 때 지도 미준비로 효과가 early-return 해도
  // "이전 선택 핀"이 기록돼, 첫 클릭에서 초기 포커스 핀이 정상 원복된다.
  const prevSelectedRef = useRef<string | null>(withLoc[0]?.id ?? null);
  useEffect(() => {
    const naver = window.naver;
    const prev = prevSelectedRef.current;
    prevSelectedRef.current = selected; // 가드보다 먼저 — 지도 미준비여도 추적 유지
    if (!naver || !mapRef.current) return;
    if (prev && prev !== selected) styleMarker(prev); // 이전 선택 핀 원복(호버 중이면 호버 유지)
    styleMarker(selected);
    const sel = selected && withLoc.find((s) => s.id === selected);
    // 좌측 패널(데스크톱)·바텀시트(모바일)를 뺀 '보이는 지도 영역' 중앙으로.
    if (sel && !suppressPanRef.current) centerOn(sel.location);
    suppressPanRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  // 캐러셀 카드 호버 → 해당 핀만 갱신(이전·현재 2개). 선택 핀이면 styleMarker가 선택 우선 처리.
  const prevHoveredRef = useRef<string | null>(null);
  useEffect(() => {
    hoveredRef.current = hovered;
    if (!window.naver || !mapRef.current) return;
    const prev = prevHoveredRef.current;
    prevHoveredRef.current = hovered;
    if (prev && prev !== hovered) styleMarker(prev);
    styleMarker(hovered);
  }, [hovered]);

  const showFallback = status === "nokey" || status === "error" || status === "authfail";
  // 모바일 플로팅 UI(줌·현재위치·리스트로 보기·재검색·토스트)는 바텀시트 위에 얹는다 —
  // 시트를 끌어 올리거나 내리면 그만큼 같이 움직여 가려지지 않게. (데스크톱은 클래스 그대로)
  const floatBottom = (extra: number) =>
    !isDesktop && coverPx > 0 ? { bottom: coverPx + extra } : undefined;
  // 패널 대상(목록에서 사라지면 자동으로 닫힘 처리됨).
  const panelSauna = panelId
    ? (saunaList.find((s) => s.id === panelId) ?? null)
    : null;

  return (
    <div ref={rootRef} className="relative w-full overflow-hidden bg-[#ECEAE5]">
      {/* 지도 영역 */}
      <div ref={mapEl} className="absolute inset-0" />

      {/* 폴백(키없음/인증실패/에러) */}
      {showFallback && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#ECEAE5] px-[24px] text-center">
          <div className="flex h-[76px] w-[76px] items-center justify-center rounded-full bg-white/70">
            <MapPinned size={34} className="text-[#9DB2CE]" />
          </div>
          <p className="mt-[16px] text-[14px] font-semibold text-ink">
            {status === "nokey"
              ? "네이버 지도 키가 필요해요"
              : status === "authfail"
                ? "네이버 지도 인증에 실패했어요"
                : "지도를 불러오지 못했어요"}
          </p>
          <p className="mt-[6px] max-w-[300px] text-[12px] leading-[1.6] text-muted">
            {status === "nokey"
              ? ".env.local 에 NEXT_PUBLIC_NAVER_MAP_CLIENT_ID 를 설정하세요. 아래 목록은 그대로 사용할 수 있어요."
              : status === "authfail"
                ? "NCP Maps Application의 ‘Web 서비스 URL’에 현재 접속 주소(예: http://localhost:3100)를 등록했는지 확인하세요."
                : "잠시 후 다시 시도해 주세요."}
          </p>
        </div>
      )}

      {/* 상단 컴팩트 칩 — 네이버식(지도 위 떠있음). 변별력 있는 빠른 필터. 패널 오른쪽 오프셋. */}
      {status === "ready" && !showFallback && (
        <div
          className={`absolute top-[14px] z-[7] hidden items-center gap-[7px] md:flex ${
            collapsed ? "left-[44px]" : "left-[416px]"
          }`}
        >
          {TOP_CHIPS.map((c) => {
            const active = isTopChipActive(c);
            const Illust = c.Illust;
            return (
              <button
                key={c.label}
                type="button"
                onClick={() => toggleTopChip(c)}
                aria-pressed={active}
                className="flex flex-none items-center gap-[7px] rounded-full py-[6px] pl-[6px] pr-[14px] text-[13px] font-semibold shadow-[0_3px_12px_rgba(0,0,0,0.18)] transition-colors"
                style={
                  active
                    ? { background: "var(--color-brand)", color: "#fff" }
                    : { background: "#fff", color: "var(--color-ink)" }
                }
              >
                {/* 다색 일러스트는 currentColor 틴트가 안 되므로, 활성(빨강)/비활성(흰)
                    어느 칩에서도 또렷하게 보이도록 둥근 토큰 배경에 얹는다. */}
                <span
                  className="flex h-[22px] w-[22px] flex-none items-center justify-center rounded-full"
                  style={{ background: active ? "#fff" : "#F4F2EF" }}
                >
                  <Illust size={17} />
                </span>
                {c.label}
              </button>
            );
          })}
        </div>
      )}

      {/* 이 지역 재검색 — 지도를 충분히 옮겼을 때만 노출(표준 패턴).
          좌측 패널이 열려있으면 '남은 지도 영역' 기준 중앙으로(패널 폭만큼 오프셋). */}
      {status === "ready" && (showResearch || researching) && (
        <div
          style={floatBottom(64)}
          className={`absolute bottom-[238px] right-0 z-[6] flex justify-center transition-[left] duration-300 lg:bottom-[78px] ${
            collapsed
              ? panelSauna
                ? "left-0 lg:left-[400px]"
                : "left-0"
              : panelSauna
                ? "left-0 sm:left-[400px] lg:left-[800px]"
                : "left-0 sm:left-[400px]"
          }`}
        >
          <button
            type="button"
            onClick={researchHere}
            disabled={researching}
            aria-busy={researching}
            className="flex h-[40px] items-center gap-[6px] rounded-full bg-brand px-[16px] text-[13px] font-semibold text-white shadow-[0_2px_10px_rgba(0,0,0,0.20)] active:scale-95"
          >
            {researching ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <RefreshCw size={15} />
            )}
            {researching ? "검색 중…" : "이 지역 재검색"}
          </button>
        </div>
      )}

      {/* floating "리스트로 보기" — 화면 하단 중앙(리스트뷰의 "지도로 보기"와 대칭).
          데스크톱은 좌측 패널 폭만큼 오프셋해 '남은 지도 영역' 중앙에 둔다. */}
      {status === "ready" && !showFallback && (
        <div
          style={floatBottom(12)}
          className={`pointer-events-none absolute bottom-[186px] right-0 z-[6] flex justify-center transition-[left] duration-300 lg:bottom-[24px] ${
            collapsed
              ? panelSauna
                ? "left-0 lg:left-[400px]"
                : "left-0"
              : panelSauna
                ? "left-0 sm:left-[400px] lg:left-[800px]"
                : "left-0 sm:left-[400px]"
          }`}
        >
          <Link
            href="/list"
            aria-label="리스트로 보기"
            className="pointer-events-auto flex h-[40px] items-center gap-[5px] rounded-full bg-white px-[16px] text-[13px] font-semibold text-brand shadow-[0_3px_12px_rgba(245,64,44,0.16)] active:scale-95"
          >
            <List size={15} />
            리스트로 보기
          </Link>
        </div>
      )}

      {/* 우측 기능 레일 — 줌(위) · 현재 위치(맨 아래). 하단 정렬. */}
      {status === "ready" && (
        <div
          style={floatBottom(12)}
          className="absolute bottom-[186px] right-[16px] z-[7] flex flex-col items-center gap-[18px] lg:bottom-[24px]"
        >
          {/* 줌 +/- 그룹 */}
          <div className="flex flex-col overflow-hidden rounded-[12px] bg-white shadow-[0_3px_12px_rgba(0,0,0,0.18)]">
            <button
              type="button"
              onClick={() => zoomBy(1)}
              aria-label="확대"
              className="flex h-[44px] w-[44px] items-center justify-center text-ink active:bg-[#F4F2EF]"
            >
              <Plus size={19} />
            </button>
            <div className="mx-auto h-px w-[24px] bg-[#EEECE8]" />
            <button
              type="button"
              onClick={() => zoomBy(-1)}
              aria-label="축소"
              className="flex h-[44px] w-[44px] items-center justify-center text-ink active:bg-[#F4F2EF]"
            >
              <Minus size={19} />
            </button>
          </div>
          {/* 현재 위치 — 레일 맨 아래 */}
          <button
            type="button"
            onClick={locateMe}
            aria-label="현재 위치"
            aria-busy={locating}
            className="flex h-[44px] w-[44px] items-center justify-center rounded-[12px] bg-white text-brand shadow-[0_3px_12px_rgba(0,0,0,0.18)] active:scale-95"
          >
            {locating ? (
              <Loader2 size={20} className="animate-spin" />
            ) : (
              <LocateFixed size={20} />
            )}
          </button>
        </div>
      )}

      {/* 위치 권한 안내 토스트 */}
      {geoMsg && (
        <div
          style={floatBottom(70)}
          className="absolute inset-x-0 bottom-[244px] z-[8] flex justify-center px-[24px]"
        >
          <div className="max-w-[320px] rounded-[14px] bg-ink/90 px-[14px] py-[10px] text-center text-[12px] font-medium leading-[1.5] text-white shadow-[0_4px_16px_rgba(0,0,0,0.28)]">
            {geoMsg}
          </div>
        </div>
      )}

      {/* ── 데스크톱(lg+): 좌측 슬라이드 패널 ── */}
      {!showFallback && isDesktop && (
        <>
          {/* 좌측 목록 패널 — 풀하이트. 접기 탭으로 숨길 수 있고, 접힘 상태는 상세 열림과 독립이다. */}
          <div
            className={`absolute inset-y-0 left-0 z-[8] w-full max-w-[400px] bg-card shadow-[6px_0_24px_rgba(0,0,0,0.12)] transition-transform duration-300 ${
              collapsed ? "-translate-x-full" : "translate-x-0"
            }`}
          >
            <div className="h-full w-full overflow-hidden">
              <MapSidePanel
                saunas={withLoc}
                loading={listLoading}
                selectedId={selected}
                onSelect={openPanel}
                onHover={setHovered}
                onOpenFilter={() => {
                  setSheetDraft(sheet);
                  setSheetOpen(true);
                }}
                activeCategory={activeCategory}
                onPickCategory={pickCategory}
                filterActive={filterActive}
                query={query}
                onQueryChange={setQuery}
              />
            </div>
            {/* 접기 탭 — 상세가 없을 때는 목록 패널 오른쪽 가장자리에 */}
            {!panelSauna && (
              <button
                type="button"
                onClick={() => setCollapsed(true)}
                aria-label="패널 접기"
                className="absolute right-0 top-1/2 flex h-[52px] w-[24px] -translate-y-1/2 translate-x-full cursor-pointer items-center justify-center rounded-r-[12px] bg-card text-muted shadow-[4px_0_10px_rgba(0,0,0,0.10)] hover:text-ink"
              >
                <ChevronLeft size={18} />
              </button>
            )}
          </div>

          {/* 상세 패널 — 리스트가 접혀 있으면 왼쪽 단독(left-0), 펼쳐져 있으면 목록 옆(left-[400px]) */}
          {panelSauna && (
            <div
              className={`absolute inset-y-0 z-[9] w-full max-w-[400px] bg-card shadow-[6px_0_24px_rgba(0,0,0,0.14)] ${
                collapsed ? "left-0" : "left-[400px]"
              }`}
            >
              <div className="h-full w-full overflow-hidden">
                <MapDetailPanel
                  sauna={panelSauna}
                  photos={panelPhotos}
                  reviews={panelReviews}
                  visitorReviews={panelVisitorReviews}
                  loading={panelLoading}
                  onClose={() => setPanelId(null)}
                />
              </div>
              {/* 접기 탭 — 리스트가 펼쳐져 있을 때만(접힌 상태에선 이미 리스트가 없으므로 불필요) */}
              {!collapsed && (
                <button
                  type="button"
                  onClick={() => setCollapsed(true)}
                  aria-label="패널 접기"
                  className="absolute right-0 top-1/2 flex h-[52px] w-[24px] -translate-y-1/2 translate-x-full cursor-pointer items-center justify-center rounded-r-[12px] bg-card text-muted shadow-[4px_0_10px_rgba(0,0,0,0.10)] hover:text-ink"
                >
                  <ChevronLeft size={18} />
                </button>
              )}
            </div>
          )}

          {/* 접힌 목록 다시 열기 — 왼쪽 가장자리 탭(상세를 보는 중엔 숨겨 깨끗하게) */}
          {collapsed && !panelSauna && (
            <button
              type="button"
              onClick={() => setCollapsed(false)}
              className="absolute left-0 top-1/2 z-[8] flex h-[52px] w-[26px] -translate-y-1/2 cursor-pointer items-center justify-center rounded-r-[12px] bg-card text-muted shadow-[4px_0_10px_rgba(0,0,0,0.12)] hover:text-ink active:scale-95"
              aria-label={`목록 열기 (${withLoc.length}곳)`}
            >
              <ChevronRight size={20} />
            </button>
          )}
        </>
      )}

      {/* ── 모바일(lg 미만): 네이버지도식 바텀시트 ── */}
      {!showFallback && !isDesktop && (
        /* 시트는 한 장 — 목록에서 하나를 고르면 그 자리에서 상세로 넘어간다(겹쳐 띄우지 않음).
           목록은 언마운트하지 않고 감춰만 둬, 뒤로 돌아왔을 때 스크롤·입력이 그대로 남는다. */
        <BottomSheet
          zClassName="z-[8]"
          peekPx={SHEET_HANDLE_PX}
          restRatio={0.62}
          handleRef={sheetRef}
          onCoverChange={setListCover}
        >
          <div className={panelSauna ? "hidden" : "h-full"}>
            <MapSidePanel
              saunas={withLoc}
              loading={listLoading}
              selectedId={selected}
              onSelect={openPanel}
              onHover={setHovered}
              onOpenFilter={() => {
                setSheetDraft(sheet);
                setSheetOpen(true);
              }}
              activeCategory={activeCategory}
              onPickCategory={pickCategory}
              filterActive={filterActive}
              query={query}
              onQueryChange={setQuery}
            />
          </div>
          {panelSauna && (
            <div key={panelId} className="h-full">
              <MapDetailPanel
                sauna={panelSauna}
                photos={panelPhotos}
                reviews={panelReviews}
                visitorReviews={panelVisitorReviews}
                loading={panelLoading}
                onClose={() => setPanelId(null)}
                asBack
              />
            </div>
          )}
        </BottomSheet>
      )}

      {/* 필터 시트 — 적용 시 노출 목록이 줄어드니 선택을 첫 결과로 옮긴다(없으면 해제) */}
      <FilterSheet
        open={sheetOpen}
        value={sheetDraft}
        variant="panel"
        candidates={located}
        onChange={setSheetDraft}
        onApply={() => {
          setSheet(sheetDraft);
          setSheetOpen(false);
          const next = located.filter((s) => matchesFilters(s, sheetDraft));
          suppressPanRef.current = true; // 필터發 선택은 지도를 끌고가지 않게
          setSelected(next[0]?.id ?? null);
        }}
        onClose={() => setSheetOpen(false)}
      />
    </div>
  );
}
