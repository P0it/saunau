"use client";

import { useEffect, useRef, useState } from "react";
import { MapPinned, Navigation } from "lucide-react";
import type { GeoPoint } from "@/lib/data/types";

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    naver?: any;
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

const PIN_HTML =
  '<div style="transform:translate(-50%,-100%);width:26px;height:26px;border-radius:999px 999px 999px 0;background:#F5402C;border:2px solid #fff;box-shadow:0 3px 10px rgba(0,0,0,.28);transform-origin:center;rotate:45deg"><span style="display:block;width:8px;height:8px;border-radius:999px;background:#fff;margin:7px auto 0"></span></div>';

/**
 * 상세 "위치" 미니맵 — 사우나 좌표에 핀 하나. 좌표/키 없으면 안내 폴백.
 * 네이버 지도 길찾기로 연결되는 버튼 포함.
 */
export function SaunaLocationMap({
  location,
  name,
  address,
}: {
  location: GeoPoint | null;
  name: string;
  address: string;
}) {
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!CLIENT_ID || !location) return;
    const el = mapEl.current;
    if (!el) return;
    let cancelled = false;

    // 지도는 "컨테이너 높이가 잡힌 뒤"에만 생성한다.
    // naver.maps 가 이미 로드돼 있으면 loadNaverMaps()가 마이크로태스크로 즉시 resolve 되어
    // 브라우저가 레이아웃(높이)을 적용하기 전에 지도를 만들 수 있는데, 0높이로 만들어진
    // 지도는 이후 resize 로도 타일이 복구되지 않아 회색으로 남는다. ResizeObserver 로
    // clientHeight>0 이 된 시점에 한 번만 생성한다.
    const create = () => {
      if (cancelled || mapRef.current) return;
      const node = mapEl.current;
      if (!node || node.clientHeight === 0 || node.clientWidth === 0) return;
      loadNaverMaps()
        .then(() => {
          const n = mapEl.current;
          if (cancelled || mapRef.current || !n || n.clientHeight === 0) return;
          const naver = window.naver;
          const ll = new naver.maps.LatLng(location.lat, location.lng);
          const map = new naver.maps.Map(n, {
            center: ll,
            zoom: 16,
            draggable: false,
            pinchZoom: false,
            scrollWheel: false,
            keyboardShortcuts: false,
            disableDoubleClickZoom: true,
            disableDoubleTapZoom: true,
            scaleControl: false,
            mapDataControl: false,
            zoomControl: false,
            logoControlOptions: { position: naver.maps.Position.BOTTOM_RIGHT },
          });
          mapRef.current = map;
          new naver.maps.Marker({
            position: ll,
            map,
            icon: { content: PIN_HTML, anchor: new naver.maps.Point(0, 0) },
          });
          ro.disconnect(); // 생성 완료 — 더 관찰 불필요
        })
        .catch(() => !cancelled && setFailed(true));
    };

    const ro = new ResizeObserver(create);
    ro.observe(el);
    create(); // 이미 높이가 있으면 즉시 생성

    return () => {
      cancelled = true;
      ro.disconnect();
    };
  }, [location]);

  // 네이버 지도 길찾기(도착지 = 좌표 우선, 없으면 주소 검색).
  const directionsHref = location
    ? `https://map.naver.com/p/directions/-/${location.lng},${location.lat},${encodeURIComponent(name)},,/-/transit`
    : `https://map.naver.com/p/search/${encodeURIComponent(name + " " + address)}`;

  const showMap = !!CLIENT_ID && !!location && !failed;

  return (
    <div>
      {showMap ? (
        <div className="relative h-[180px] overflow-hidden rounded-[16px] border border-line">
          <div ref={mapEl} className="absolute inset-0" />
        </div>
      ) : (
        <div className="flex h-[140px] flex-col items-center justify-center gap-[8px] rounded-[16px] border border-line bg-[#F2F5F9] text-muted">
          <MapPinned size={26} className="text-[#9DB2CE]" />
          <span className="text-[13px]">
            {location ? "지도를 불러오지 못했어요" : "위치 정보가 아직 없어요"}
          </span>
        </div>
      )}

      <div className="mt-[8px] flex items-center justify-between gap-[10px]">
        <span className="min-w-0 flex-1 text-[13px] text-muted">{address}</span>
        <a
          href={directionsHref}
          target="_blank"
          rel="noreferrer"
          className="flex flex-none items-center gap-[5px] rounded-full bg-[#F6F5F4] px-[12px] py-[7px] text-[13px] font-semibold text-ink active:scale-95"
        >
          <Navigation size={15} />
          길찾기
        </a>
      </div>
    </div>
  );
}
