import { NextResponse, type NextRequest } from "next/server";
import { getSaunasNearby } from "@/lib/data/queries";

export const dynamic = "force-dynamic"; // 좌표마다 다른 결과 — 캐시 금지

/**
 * 지도 "이 지역 재검색" — 현재 지도 중심 좌표로 주변 사우나를 거리순 반환.
 * GET /api/nearby?lat=37.5&lng=127.0&radius=8000
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const lat = Number(sp.get("lat"));
  const lng = Number(sp.get("lng"));
  const radius = Number(sp.get("radius")) || 8000;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: "lat/lng required" }, { status: 400 });
  }
  try {
    const saunas = await getSaunasNearby(lat, lng, radius);
    return NextResponse.json({ saunas });
  } catch (e) {
    const message = e instanceof Error ? e.message : "nearby query failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
