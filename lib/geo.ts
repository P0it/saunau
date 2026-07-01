"use client";

import { useEffect, useState } from "react";

/**
 * 위치 캐시 — 좌표를 localStorage 에 보관해 새로고침·탭 종료 후에도 유지하고,
 * "내 주변"(목록/지도)이 그 좌표를 읽어 거리순·내 위치 중심으로 연다.
 *
 * 권한 동의가 "계속" 이어지도록:
 *  - 좌표는 localStorage(=세션 넘어 유지)에 저장. sessionStorage 가 아니다.
 *  - 브라우저 권한이 이미 granted 면 로드 시마다 조용히 좌표를 재취득(프롬프트 없음)해 신선하게 유지.
 *  - 권한 미정(prompt)일 때만 세션당 1회 자동 요청(과한 팝업 방지). 거부(denied)면 조용히 폴백.
 *  - 자동 요청이 막히는 브라우저를 위해, 목록 화면이 사용자 제스처로 requestLocation() 을 직접 호출할 수 있다.
 */
export type Coords = { lat: number; lng: number };

const KEY = "saunau:geo"; // { lat, lng, ts } — localStorage
const ASKED = "saunau:geo-asked"; // 권한 prompt 상태에서 자동요청 1회 throttle(sessionStorage)
const EVENT = "saunau:geo"; // 좌표 확보 시 같은 탭 내 구독자에게 알림

export function getCachedCoords(): Coords | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw);
    if (typeof v?.lat === "number" && typeof v?.lng === "number") {
      return { lat: v.lat, lng: v.lng };
    }
  } catch {
    /* 무시 */
  }
  return null;
}

/** 좌표를 캐시에 저장하고 같은 탭 구독자에게 알린다(홈 카드·목록 버튼·자동요청 공용). */
export function saveCoords(c: Coords): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify({ lat: c.lat, lng: c.lng, ts: Date.now() }));
    window.dispatchEvent(new Event(EVENT));
  } catch {
    /* 무시 */
  }
}

const GEO_OPTS: PositionOptions = {
  enableHighAccuracy: false,
  timeout: 8000,
  maximumAge: 60_000,
};

/**
 * 좌표를 능동적으로 취득해 캐시에 저장(성공 시). 사용자 제스처(버튼 클릭)에서 호출하면
 * 자동요청을 막는 브라우저에서도 권한 프롬프트가 확실히 뜬다. 실패하면 null.
 */
export function requestLocation(): Promise<Coords | null> {
  if (typeof window === "undefined" || !navigator.geolocation) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const c = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        saveCoords(c);
        resolve(c);
      },
      () => resolve(null),
      GEO_OPTS,
    );
  });
}

/**
 * 앱 로드 시 호출 — 권한 상태에 맞춰 좌표를 확보/갱신.
 *  granted → 매 로드 조용히 재취득(프롬프트 없음, 항상 최신).
 *  prompt  → 세션당 1회 자동 요청.
 *  denied  → 아무것도 안 함(전국 폴백).
 * permissions API 미지원 환경은 세션당 1회 시도로 폴백.
 */
export function requestLocationOnce(): void {
  if (typeof window === "undefined" || !navigator.geolocation) return;

  const askOncePerSession = () => {
    if (sessionStorage.getItem(ASKED)) return;
    sessionStorage.setItem(ASKED, "1");
    void requestLocation();
  };

  if (navigator.permissions?.query) {
    navigator.permissions
      .query({ name: "geolocation" as PermissionName })
      .then((status) => {
        if (status.state === "granted") {
          void requestLocation(); // 권한 있음 → 프롬프트 없이 매번 신선하게
        } else if (status.state === "prompt") {
          askOncePerSession();
        }
        // denied → 폴백
      })
      .catch(() => askOncePerSession());
    return;
  }

  // permissions API 없음 → 좌표 없을 때만 세션당 1회
  if (!getCachedCoords()) askOncePerSession();
}

/** 캐시된 좌표를 구독(동의가 늦게 떨어지거나 다른 탭에서 갱신돼도 반영). */
export function useCoords(): Coords | null {
  const [coords, setCoords] = useState<Coords | null>(() => getCachedCoords());
  useEffect(() => {
    const sync = () => setCoords(getCachedCoords());
    window.addEventListener(EVENT, sync);
    // 다른 탭에서 localStorage 가 바뀌면 storage 이벤트로 반영(크로스 탭).
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) sync();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", onStorage);
    };
  }, []);
  return coords;
}
