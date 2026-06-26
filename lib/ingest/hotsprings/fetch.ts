/**
 * 온천표준데이터 전수 페치. 전국 ~18건(향후 증가 가능)이라 numOfRows=1000 1콜이면 충분.
 * 목욕장업과 다른 엔드포인트(api.data.go.kr/openapi/...).
 */
import type { PublicDataResponse } from "../types";
import type { HotSpringApiItem } from "./types";

const ENDPOINT = "https://api.data.go.kr/openapi/tn_pubr_public_hot_spring_api";
const PAGE_SIZE = 1000;
const MAX_RETRY = 4;

function items(res: PublicDataResponse<HotSpringApiItem>): HotSpringApiItem[] {
  const it = res.response?.body?.items;
  if (!it) return [];
  return Array.isArray(it) ? it : (it.item ?? []);
}

export async function fetchAllHotSprings(
  apiKey: string,
): Promise<HotSpringApiItem[]> {
  const url =
    `${ENDPOINT}?serviceKey=${encodeURIComponent(apiKey)}` +
    `&pageNo=1&numOfRows=${PAGE_SIZE}&type=json`;

  let lastErr: unknown;
  for (let attempt = 1; attempt <= MAX_RETRY; attempt++) {
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const json = (await r.json()) as PublicDataResponse<HotSpringApiItem>;
      const code = json.response?.header?.resultCode;
      if (code !== "00" && code !== "0") {
        throw new Error(
          `온천 API resultCode=${code} msg=${json.response?.header?.resultMsg}`,
        );
      }
      return items(json);
    } catch (e) {
      lastErr = e;
      await new Promise((res) => setTimeout(res, 400 * attempt));
    }
  }
  throw new Error(`온천표준데이터 페치 실패: ${String(lastErr)}`);
}
