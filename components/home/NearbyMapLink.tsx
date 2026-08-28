"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { MapPin, Loader2 } from "lucide-react";
import { FeaturedMapScene } from "@/components/illustrations";
import {
  saveCoords,
  getCachedCoords,
  requestLocation,
  needsLocationNotice,
} from "@/lib/geo";
import { LocationNotice } from "@/components/geo/LocationNotice";

/**
 * 홈 "내 주변 사우나" 진입 카드.
 * 클릭(사용자 제스처) 시 브라우저 위치 동의를 띄우고, 허용되면 내 좌표를 들고 지도로 이동.
 * 거부·실패·미지원이어도 지도는 그대로 연다(전국 핀). 좌표는 /map 이 읽어 그 자리에서 연다.
 *
 * 아직 권한을 준 적 없으면 브라우저 프롬프트 앞에 LocationNotice 로 용도를 먼저 알린다
 * (프롬프트만으로는 왜 필요한지·좌표를 어떻게 다루는지 알 길이 없다).
 *
 * Link 대신 button + router.push 로 이동을 일원화 — Link 기본 내비가 위치 동의보다 먼저
 * 일어나 쿼리 없이 /map 으로 가버리는 경합을 원천 차단한다.
 */
export function NearbyMapLink() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const [noticeOpen, setNoticeOpen] = useState(false);

  const go = (qs = "") => router.push(`/map${qs}`);

  /** 실제 권한 요청 → 좌표를 들고(또는 못 들고) 지도로. */
  function locateAndGo() {
    if (typeof navigator === "undefined" || !navigator.geolocation) return go();
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        // 제스처로 확실히 받은 좌표는 캐시에 저장 — 목록/지도가 새로고침 후에도 내 위치로 열린다.
        saveCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        go(
          `?lat=${pos.coords.latitude.toFixed(6)}&lng=${pos.coords.longitude.toFixed(6)}`,
        );
      },
      () => go(), // 권한 거부/타임아웃 — 지도는 전국 핀으로 연다
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 30000 },
    );
  }

  async function handleClick() {
    if (loading) return;

    // 좌표가 캐시돼 있으면 즉시 이동 — GPS 대기 없음.
    // (기존엔 매번 새로 getCurrentPosition 을 기다려 "위치 확인 중"이 최대 8초까지 돌았음.)
    const cached = getCachedCoords();
    if (cached) {
      void requestLocation(); // 다음 진입을 위해 백그라운드로 신선화(내비는 막지 않음)
      return go(`?lat=${cached.lat.toFixed(6)}&lng=${cached.lng.toFixed(6)}`);
    }

    // 아직 물어본 적 없으면 용도부터 알린다.
    if (await needsLocationNotice()) {
      setNoticeOpen(true);
      return;
    }
    locateAndGo();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => void handleClick()}
        aria-busy={loading}
        className="relative block h-[160px] w-full cursor-pointer overflow-hidden rounded-[22px] bg-card text-left shadow-[0_2px_12px_rgba(0,0,0,0.05)] active:scale-[0.99]"
      >
        <div className="absolute inset-y-0 right-0 z-0 w-[190px]">
          <FeaturedMapScene />
          <div className="absolute inset-y-0 left-0 w-[48px] bg-gradient-to-r from-white to-transparent" />
        </div>
        <div className="relative z-[2] p-[20px]">
          <span className="inline-flex items-center gap-[4px] rounded-full bg-brand px-[11px] py-[5px] text-[11px] font-bold text-white">
            <MapPin size={12} />지금 영업중
          </span>
          <div className="mt-[13px] text-[20px] font-extrabold tracking-[-0.025em] text-ink">
            내 주변 사우나
          </div>
          <div className="mt-[5px] flex items-center gap-[6px] text-[13px] font-medium text-muted">
            {loading ? (
              <>
                <Loader2 size={14} className="animate-spin" />위치 확인 중…
              </>
            ) : (
              "지도로 한눈에 보기"
            )}
          </div>
        </div>
      </button>

      <LocationNotice
        open={noticeOpen}
        onClose={() => setNoticeOpen(false)}
        onAllow={() => {
          setNoticeOpen(false);
          locateAndGo();
        }}
      />
    </>
  );
}
