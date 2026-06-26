/**
 * 목욕장업 API 전수 페치.
 * numOfRows 는 서버가 100으로 고정(1000 요청해도 100) → 약 178페이지 순회.
 * 일일 한도 10,000 내. 증분 파라미터는 없으므로 매번 전수 스캔 후 license_no upsert.
 */
import type { BathApiItem, PublicDataResponse } from "./types";

const ENDPOINT = "https://apis.data.go.kr/1741000/public_baths/info";
const PAGE_SIZE = 100; // 서버 상한
const MAX_RETRY = 4;

function items<T>(res: PublicDataResponse<T>): T[] {
  const body = res.response?.body;
  if (!body) return [];
  const it = body.items;
  if (!it) return [];
  return Array.isArray(it) ? it : (it.item ?? []);
}

async function fetchPage(
  key: string,
  pageNo: number,
): Promise<{ rows: BathApiItem[]; totalCount: number }> {
  const url =
    `${ENDPOINT}?serviceKey=${encodeURIComponent(key)}` +
    `&pageNo=${pageNo}&numOfRows=${PAGE_SIZE}&type=json`;

  let lastErr: unknown;
  for (let attempt = 1; attempt <= MAX_RETRY; attempt++) {
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const json = (await r.json()) as PublicDataResponse<BathApiItem>;
      const code = json.response?.header?.resultCode;
      if (code !== "00" && code !== "0") {
        throw new Error(
          `API resultCode=${code} msg=${json.response?.header?.resultMsg}`,
        );
      }
      return {
        rows: items(json),
        totalCount: json.response.body?.totalCount ?? 0,
      };
    } catch (e) {
      lastErr = e;
      await new Promise((res) => setTimeout(res, 400 * attempt)); // 선형 백오프
    }
  }
  throw new Error(`목욕장업 page ${pageNo} 실패: ${String(lastErr)}`);
}

export interface FetchProgress {
  (info: { page: number; pages: number; fetched: number; total: number }): void;
}

/** 전 페이지를 순차 페치해 모든 BathApiItem 반환. */
export async function fetchAllBaths(
  apiKey: string,
  onProgress?: FetchProgress,
): Promise<BathApiItem[]> {
  const first = await fetchPage(apiKey, 1);
  const total = first.totalCount;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const all: BathApiItem[] = [...first.rows];
  onProgress?.({ page: 1, pages, fetched: all.length, total });

  for (let p = 2; p <= pages; p++) {
    const { rows } = await fetchPage(apiKey, p);
    all.push(...rows);
    onProgress?.({ page: p, pages, fetched: all.length, total });
  }
  return all;
}
