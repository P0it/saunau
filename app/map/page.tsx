import { getNearbySaunas, getSaunasNearby } from "@/lib/data/queries";
import type { Sauna } from "@/lib/data/types";
import { NaverMapView } from "@/components/map/NaverMapView";

export const metadata = { title: "지도" };
export const dynamic = "force-dynamic"; // 동기화된 DB를 항상 최신으로

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

  // 내 위치를 받았으면 거리순 주변을, 아니면 전국 최신 목록을. (0007 미적용 시 폴백)
  let saunas: Sauna[];
  if (initialCenter) {
    try {
      saunas = await getSaunasNearby(initialCenter.lat, initialCenter.lng);
    } catch {
      saunas = await getNearbySaunas();
    }
  } else {
    saunas = await getNearbySaunas();
  }

  return <NaverMapView saunas={saunas} initialCenter={initialCenter} />;
}
