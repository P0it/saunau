import { getNearbySaunas } from "@/lib/data/queries";
import type { Sauna } from "@/lib/data/types";
import { NaverMapView } from "@/components/map/NaverMapView";

export const metadata = { title: "지도" };
export const revalidate = 60; // ISR: 60초마다 백그라운드 갱신(?lat=&lng= 진입은 동적 렌더)

/** 지도뷰 — 네이버 지도 SDK. 핀(분류 아이콘+상호) + 하단 시트.
 * 홈 "내 주변"에서 위치 동의 후 넘어오면 ?lat=&lng= 로 내 위치를 받아 그 자리에서 연다. */
export default async function MapPage({
  searchParams,
}: {
  searchParams: Promise<{ lat?: string; lng?: string }>;
}) {
  const { lat, lng } = await searchParams;
  const latN = Number(lat);
  const lngN = Number(lng);
  const initialCenter =
    Number.isFinite(latN) && Number.isFinite(lngN) && lat && lng
      ? { lat: latN, lng: lngN }
      : undefined;

  // 좌표로 진입("내 주변")했으면 서버 RPC를 기다리지 않고 셸을 즉시 렌더한다 —
  // NaverMapView 가 마운트 즉시 /api/nearby 로 주변을 가져오므로, 지도 SDK 로드와 병렬로
  // 진행돼 진입 체감이 크게 짧아진다. 좌표가 없을 때만 전국 핀을 SSR 로 미리 채운다.
  const saunas: Sauna[] = initialCenter ? [] : await getNearbySaunas();

  return <NaverMapView saunas={saunas} initialCenter={initialCenter} />;
}
