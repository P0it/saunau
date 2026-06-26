/**
 * 네이버 플레이스 매칭 + 사진 수집.
 *
 * ⚠ 두 부분의 성격이 다르다:
 *  1) searchPlaceMatch — **공식 지역검색 Open API**(합법). 상호/좌표 매칭·동음이의 확인용.
 *  2) fetchPlacePhotos — **비공식 플레이스 엔드포인트**(약관/저작권 리스크 구간).
 *     네이버 내부 응답 구조는 비공개·수시 변경이므로, 이 함수는 best-effort 다.
 *     실패하면 빈 배열을 반환(파이프라인은 계속). 라이브 검증 후 파싱을 조정해야 한다.
 *
 * 사진은 수집 후 반드시 store.ts 로 우리 Storage 에 재호스팅한다(외부 URL 노출 0).
 */
import type { NaverPlaceMatch, NaverPhoto } from "./types";
import type { NaverCreds } from "./blogSearch";

const LOCAL_ENDPOINT = "https://openapi.naver.com/v1/search/local.json";

function stripHtml(s: string): string {
  return (s ?? "").replace(/<[^>]+>/g, "").trim();
}

interface LocalItem {
  title?: string;
  category?: string;
  address?: string;
  roadAddress?: string;
  telephone?: string;
  mapx?: string; // 경도 * 1e7 (신형식)
  mapy?: string; // 위도 * 1e7
}

/** 공식 지역검색으로 후보 1건 매칭(상호+주소). 좌표는 1e7 → WGS84. */
export async function searchPlaceMatch(
  name: string,
  address: string | null,
  creds: NaverCreds,
): Promise<NaverPlaceMatch | null> {
  const query = [name, address?.split(/\s+/).slice(0, 2).join(" ")]
    .filter(Boolean)
    .join(" ");
  const url = `${LOCAL_ENDPOINT}?query=${encodeURIComponent(query)}&display=1&sort=random`;

  const r = await fetch(url, {
    headers: {
      "X-Naver-Client-Id": creds.clientId,
      "X-Naver-Client-Secret": creds.clientSecret,
    },
  });
  if (!r.ok) {
    throw new Error(`네이버 지역검색 실패: HTTP ${r.status} ${await r.text()}`);
  }
  const json = (await r.json()) as { items?: LocalItem[] };
  const it = json.items?.[0];
  if (!it) return null;

  const mapx = it.mapx ? Number(it.mapx) : NaN;
  const mapy = it.mapy ? Number(it.mapy) : NaN;
  return {
    placeId: null, // 지역검색 API엔 place id 없음 → 사진은 fetchPlacePhotos 의 검색 해석에 의존
    title: stripHtml(it.title ?? ""),
    category: it.category ?? null,
    roadAddress: it.roadAddress ?? null,
    address: it.address ?? null,
    telephone: it.telephone ?? null,
    lng: Number.isFinite(mapx) ? mapx / 1e7 : null,
    lat: Number.isFinite(mapy) ? mapy / 1e7 : null,
  };
}

/**
 * 플레이스 사진 URL 수집(비공식, best-effort).
 *
 * 네이버 모바일 플레이스의 사진 목록은 내부 API(pcmap-api.place.naver.com)로 제공되며
 * place id 가 필요하다. id 해석/응답 파싱은 비공개·수시 변경이므로 **라이브 검증 필수**.
 * 여기서는 안전하게: 실패/구조 불일치 시 빈 배열을 반환해 파이프라인을 막지 않는다.
 *
 * @param placeId 네이버 플레이스 id (별도 해석 필요)
 * @returns 원본 사진 URL 목록(다운로드 전). store.ts 가 우리 Storage 로 재호스팅.
 */
export async function fetchPlacePhotos(
  placeId: string,
  max = 8,
): Promise<NaverPhoto[]> {
  try {
    // NOTE(검증필요): 아래 엔드포인트/응답 스키마는 비공식이라 라이브에서 확인 후 조정.
    const url = `https://pcmap-api.place.naver.com/place/${encodeURIComponent(placeId)}/images?type=photoView&size=${max}`;
    const r = await fetch(url, {
      headers: {
        // 브라우저 유사 헤더(차단 회피용 표준 헤더; 우회/위장 목적 아님)
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0",
      },
    });
    if (!r.ok) return [];
    const json: unknown = await r.json();
    return parsePhotoUrls(json, max);
  } catch {
    return [];
  }
}

/** 응답에서 이미지 URL을 방어적으로 추출(스키마 변동 대비). */
function parsePhotoUrls(json: unknown, max: number): NaverPhoto[] {
  const urls = new Set<string>();
  const visit = (node: unknown) => {
    if (urls.size >= max) return;
    if (typeof node === "string") {
      if (/^https?:\/\/\S+\.(jpe?g|png|webp)/i.test(node)) urls.add(node);
    } else if (Array.isArray(node)) {
      node.forEach(visit);
    } else if (node && typeof node === "object") {
      Object.values(node as Record<string, unknown>).forEach(visit);
    }
  };
  visit(json);
  return [...urls].slice(0, max).map((sourceUrl) => ({ sourceUrl }));
}
