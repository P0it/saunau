"use client";

import { useEffect, useState } from "react";

/**
 * 위치 캐시 — 좌표를 localStorage 에 보관해 새로고침·탭 종료 후에도 유지하고,
 * "내 주변"(목록/지도)이 그 좌표를 읽어 거리순·내 위치 중심으로 연다.
 *
 * 권한 동의가 "계속" 이어지도록:
 *  - 좌표는 localStorage(=세션 넘어 유지)에 저장. sessionStorage 가 아니다.
 *  - 브라우저 권한이 이미 granted 면 로드 시마다 조용히 좌표를 재취득(프롬프트 없음)해 신선하게 유지.
 *
 * ⚠ 권한 프롬프트는 **사용자가 "내 주변"을 누른 순간에만** 띄운다.
 *   예전엔 앱 로드 후 스플래시가 끝나면 자동으로 물었는데, 사용자가 원한 적 없는 시점이라
 *   이유 모를 팝업이 첫인상을 깎았고, 위치 이용에 대한 우리 쪽 고지도 없는 상태였다.
 *   지금은 needsLocationNotice() 로 "물어봐야 하는 상황"인지 판별해 먼저 용도를 알리고,
 *   사용자가 동의하면 requestLocation() 을 부른다.
 */
export type Coords = { lat: number; lng: number };

const KEY = "saunau:geo"; // { lat, lng, ts } — localStorage
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
 * 앱 로드 시 호출 — **이미 허용한 사용자**의 좌표만 조용히 갱신한다(프롬프트 없음).
 * 권한이 prompt/denied 면 아무것도 하지 않는다 — 묻는 건 사용자가 "내 주변"을 누를 때다.
 */
export function refreshLocationIfGranted(): void {
  if (typeof window === "undefined" || !navigator.geolocation) return;
  if (!navigator.permissions?.query) return; // 상태를 모르면 건드리지 않는다(프롬프트 위험)
  navigator.permissions
    .query({ name: "geolocation" as PermissionName })
    .then((status) => {
      if (status.state === "granted") void requestLocation();
    })
    .catch(() => {
      /* 상태 조회 실패 — 조용히 넘어간다 */
    });
}

/**
 * "위치를 왜 쓰는지" 고지를 먼저 보여줘야 하는 상황인가.
 * 이미 좌표가 있거나 권한이 확정(granted/denied)이면 고지 없이 바로 진행하면 된다.
 * 상태를 알 수 없는 브라우저(permissions API 미지원)에서는 고지를 보여주는 쪽을 택한다 —
 * 설명 없는 프롬프트보다 낫다.
 */
export async function needsLocationNotice(): Promise<boolean> {
  if (typeof window === "undefined" || !navigator.geolocation) return false;
  if (getCachedCoords()) return false;
  if (!navigator.permissions?.query) return true;
  try {
    const status = await navigator.permissions.query({
      name: "geolocation" as PermissionName,
    });
    return status.state === "prompt";
  } catch {
    return true;
  }
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
