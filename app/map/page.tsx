import { getNearbySaunas } from "@/lib/data/queries";
import { NaverMapView } from "@/components/map/NaverMapView";

export const metadata = { title: "지도" };
export const dynamic = "force-dynamic"; // 동기화된 DB를 항상 최신으로

/** 지도뷰 — 네이버 지도 SDK. 핀(대표 온도 라벨) + 하단 시트. */
export default async function MapPage() {
  const saunas = await getNearbySaunas();
  return <NaverMapView saunas={saunas} />;
}
