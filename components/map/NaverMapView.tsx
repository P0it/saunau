"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { List, RefreshCw, MapPinned, Search, SlidersHorizontal, Waves } from "lucide-react";
import type { Sauna, GeoPoint } from "@/lib/data/types";
import { saunaHref } from "@/components/sauna/SaunaCard";
import { TempHeadline } from "@/components/sauna/TempHeadline";

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

// 온도 미시딩(NULL)이어도 핀이 빈 알약이 되지 않도록 기본값 표시(TempHeadline 과 동일).
const DEFAULT_SAUNA_TEMP = 90;
const DEFAULT_COLD_TEMP = 20;

function pinHtml(s: Sauna, selected: boolean): string {
  const sauna = s.sauna_room_temp ?? DEFAULT_SAUNA_TEMP;
  const cold = s.cold_bath_temp ?? DEFAULT_COLD_TEMP;
  const hot = `<span style="color:#F5402C">${sauna}°</span>`;
  const coldSpan = `<span style="color:#1C6FFF">${cold}°</span>`;
  const sep = `<span style="color:#D8D5D1">·</span>`;
  // 선택 핀: 딱딱한 빨강 테두리 대신 사우나 열기처럼 따뜻한 글로우.
  const border = selected ? "1.5px solid #F5402C" : "1px solid #fff";
  const shadow = selected
    ? "0 4px 16px rgba(245,64,44,.34), 0 0 22px rgba(255,110,60,.30)"
    : "0 3px 10px rgba(0,0,0,.18)";
  const z = selected ? "z-index:3;" : "";
  return `<div style="${z}transform:translate(-50%,-100%);background:#fff;border:${border};border-radius:999px;box-shadow:${shadow};padding:5px 11px;display:flex;align-items:center;gap:6px;font:700 13px Pretendard;white-space:nowrap;cursor:pointer;">${hot}${sep}${coldSpan}</div>`;
}

type Status = "loading" | "ready" | "nokey" | "error" | "authfail";

export function NaverMapView({ saunas }: { saunas: Sauna[] }) {
  const withLoc = saunas.filter((s): s is Located => Boolean(s.location));
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<Record<string, any>>({});
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const carouselRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const fromPinRef = useRef(false); // 핀 클릭發 선택이면 캐러셀 스크롤 동기화
  const [selected, setSelected] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>(CLIENT_ID ? "loading" : "nokey");
  const [ready, setReady] = useState(false); // 컨테이너 높이 확보 후 지도 생성

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
        const center = withLoc[0]?.location ?? { lat: 37.5006, lng: 127.0366 };
        const map = new naver.maps.Map(mapEl.current, {
          center: new naver.maps.LatLng(center.lat, center.lng),
          zoom: 13,
          scaleControl: false,
          mapDataControl: false,
          logoControlOptions: { position: naver.maps.Position.BOTTOM_LEFT },
        });
        mapRef.current = map;

        withLoc.forEach((s) => {
          const marker = new naver.maps.Marker({
            position: new naver.maps.LatLng(s.location.lat, s.location.lng),
            map,
            icon: { content: pinHtml(s, false), anchor: new naver.maps.Point(0, 0) },
          });
          naver.maps.Event.addListener(marker, "click", () => {
            fromPinRef.current = true;
            setSelected(s.id);
            cardRefs.current[s.id]?.scrollIntoView({
              behavior: "smooth",
              inline: "center",
              block: "nearest",
            });
          });
          markersRef.current[s.id] = marker;
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

  // 선택 변경 → 핀 스타일 갱신 + 지도 패닝
  useEffect(() => {
    const naver = window.naver;
    if (!naver || !mapRef.current || !selected) return;
    withLoc.forEach((s) => {
      const m = markersRef.current[s.id];
      if (m)
        m.setIcon({
          content: pinHtml(s, s.id === selected),
          anchor: new naver.maps.Point(0, 0),
        });
    });
    const sel = withLoc.find((s) => s.id === selected);
    if (sel) mapRef.current.panTo(new naver.maps.LatLng(sel.location.lat, sel.location.lng));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  // 캐러셀 가운데 카드 → 선택(지도 패닝). 핀 클릭發 스크롤과 충돌 방지.
  useEffect(() => {
    if (status !== "ready") return;
    const root = carouselRef.current;
    if (!root) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (fromPinRef.current) {
          fromPinRef.current = false;
          return;
        }
        const best = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        const id = best?.target.getAttribute("data-id");
        if (id) setSelected(id);
      },
      { root, threshold: [0.4, 0.7, 1], rootMargin: "0px -38% 0px -38%" },
    );
    Object.values(cardRefs.current).forEach((el) => el && obs.observe(el));
    return () => obs.disconnect();
  }, [status]);

  const showFallback = status === "nokey" || status === "error" || status === "authfail";

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

      {/* 상단 툴바 — 검색 + 필터 + 리스트 토글 */}
      <div className="absolute inset-x-0 top-0 z-[6] mx-auto flex max-w-[760px] items-center gap-[8px] px-[16px] pt-[16px]">
        <Link
          href="/search"
          className="flex h-[44px] flex-1 items-center gap-[8px] rounded-full bg-white px-[16px] text-[14px] text-muted shadow-[0_2px_10px_rgba(0,0,0,0.14)]"
        >
          <Search size={18} className="text-muted" />
          상호·지역·키워드 검색
        </Link>
        <button
          type="button"
          aria-label="필터"
          className="flex h-[44px] w-[44px] flex-none items-center justify-center rounded-full bg-white text-ink shadow-[0_2px_10px_rgba(0,0,0,0.14)]"
        >
          <SlidersHorizontal size={18} />
        </button>
        <Link
          href="/list"
          aria-label="리스트 보기"
          className="flex h-[44px] flex-none items-center gap-[6px] rounded-full bg-white px-[14px] text-[13px] font-semibold text-ink shadow-[0_2px_10px_rgba(0,0,0,0.14)]"
        >
          <List size={16} />
          리스트
        </Link>
      </div>

      {/* 이 지역 재검색 */}
      <button
        type="button"
        className="absolute left-1/2 top-[78px] z-[6] flex h-[38px] -translate-x-1/2 items-center gap-[6px] rounded-full bg-white px-[16px] text-[13px] font-semibold text-brand shadow-[0_2px_10px_rgba(0,0,0,0.14)]"
      >
        <RefreshCw size={15} />이 지역 재검색
      </button>

      {/* 하단 가로 카드 캐러셀 — 지도를 최대한 가리지 않게 */}
      {!showFallback && (
        <div className="absolute inset-x-0 bottom-0 z-[7] pb-[14px]">
          <div className="mb-[2px] px-[16px]">
            <span className="inline-flex items-center rounded-full bg-white/95 px-[12px] py-[6px] text-[12px] font-bold text-ink shadow-[0_2px_8px_rgba(0,0,0,0.12)]">
              이 지역 사우나 <span className="ml-[3px] tabular-nums text-brand">{withLoc.length}</span>곳
            </span>
          </div>
          {/* pt/pb 로 카드·글로우가 위아래로 잘리지 않게(overflow-x가 세로도 클리핑) */}
          <div
            ref={carouselRef}
            className="no-scrollbar flex snap-x snap-mandatory gap-[12px] overflow-x-auto px-[16px] pb-[6px] pt-[14px]"
          >
            {withLoc.map((s) => {
              const active = s.id === selected;
              return (
                <div
                  key={s.id}
                  data-id={s.id}
                  ref={(el) => {
                    cardRefs.current[s.id] = el;
                  }}
                  className="w-[82%] max-w-[320px] flex-none snap-center"
                >
                  <Link
                    href={saunaHref(s)}
                    className={`flex items-center gap-[12px] rounded-[18px] bg-card p-[12px] ${
                      active
                        ? "heat-focus"
                        : "shadow-[0_4px_18px_rgba(0,0,0,0.16)]"
                    }`}
                  >
                    <div className="flex h-[58px] w-[58px] flex-none items-center justify-center rounded-[12px] bg-[#EEF0F2]">
                      <Waves size={24} className="text-[#C3C7CD]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[15px] font-semibold text-ink">
                        {s.name}
                      </div>
                      <div className="mt-[5px]">
                        <TempHeadline
                          saunaTemp={s.sauna_room_temp}
                          coldTemp={s.cold_bath_temp}
                        />
                      </div>
                      <div className="mt-[4px] text-[12px] text-muted tabular-nums">
                        {s.distance_km != null && <>{s.distance_km}km · </>}
                        {s.dong}
                      </div>
                    </div>
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
