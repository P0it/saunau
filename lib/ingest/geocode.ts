/**
 * 좌표 결측 영업장(약 1.3%)의 주소 → 좌표 폴백.
 * v1: 카카오 로컬 API 스텁. KAKAO_REST_API_KEY 없으면 null 반환(로그만).
 * 외부 호출 비용 최소화를 위해 결측 행에만 사용.
 */
import type { LngLat } from "./projection";

const KAKAO_ENDPOINT = "https://dapi.kakao.com/v2/local/search/address.json";

export async function geocodeAddress(
  address: string,
  apiKey = process.env.KAKAO_REST_API_KEY,
): Promise<LngLat | null> {
  if (!apiKey || !address?.trim()) return null;
  try {
    const url = `${KAKAO_ENDPOINT}?query=${encodeURIComponent(address.trim())}`;
    const r = await fetch(url, {
      headers: { Authorization: `KakaoAK ${apiKey}` },
    });
    if (!r.ok) return null;
    const j = (await r.json()) as {
      documents?: { x: string; y: string }[];
    };
    const doc = j.documents?.[0];
    if (!doc) return null;
    const lng = parseFloat(doc.x);
    const lat = parseFloat(doc.y);
    if (!isFinite(lng) || !isFinite(lat)) return null;
    return { lng, lat };
  } catch {
    return null;
  }
}
