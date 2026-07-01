/**
 * Google Places API (New) — 매장 매칭 + 사진 reference 수집.  **합법 경로**(공식 유료 API).
 *
 *  1) searchText : 상호+주소로 장소 1건 매칭 → place id + photos[](각 photo.name) 획득
 *  2) photoMediaUrl : photo.name → 실제 이미지 바이트를 받는 미디어 URL(키 포함)
 *
 * ⚠ 미디어 URL엔 API 키가 들어가므로 DB(source_url)엔 **키 없는 photo.name**만 남긴다.
 *    수집한 바이트는 store.ts 가 우리 Storage(WebP)로 재호스팅한다(외부 핫링크 0).
 *
 * 사전: GCP 프로젝트에서 "Places API (New)" 사용 설정 + 결제 활성화 + GOOGLE_MAPS_API_KEY.
 */
const SEARCH_ENDPOINT = "https://places.googleapis.com/v1/places:searchText";

export function getGoogleKey(): string {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) {
    throw new Error("GOOGLE_MAPS_API_KEY 환경변수가 필요합니다(Places API New).");
  }
  return key;
}

export interface GooglePhotoRef {
  /** "places/{placeId}/photos/{photoRef}" — 키 미포함. DB source_url 로 안전. */
  name: string;
  widthPx?: number;
  heightPx?: number;
}

export interface GooglePlaceMatch {
  placeId: string;
  displayName: string | null;
  formattedAddress: string | null;
  websiteUri: string | null;
  photos: GooglePhotoRef[];
}

interface SearchTextResponse {
  places?: Array<{
    id?: string;
    displayName?: { text?: string };
    formattedAddress?: string;
    websiteUri?: string;
    photos?: GooglePhotoRef[];
  }>;
}

/** 상호+주소로 장소 1건 매칭(사진 reference 포함). 없으면 null. */
export async function searchPlace(
  name: string,
  address: string | null,
  key: string,
): Promise<GooglePlaceMatch | null> {
  const textQuery = [name, address].filter(Boolean).join(" ");
  const r = await fetch(SEARCH_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
      // 필요한 필드만 요청(과금/페이로드 최소화).
      "X-Goog-FieldMask":
        "places.id,places.displayName,places.formattedAddress,places.websiteUri,places.photos",
    },
    body: JSON.stringify({
      textQuery,
      languageCode: "ko",
      regionCode: "KR",
      maxResultCount: 1,
    }),
  });
  if (!r.ok) {
    throw new Error(`Google searchText 실패: HTTP ${r.status} ${await r.text()}`);
  }
  const json = (await r.json()) as SearchTextResponse;
  const p = json.places?.[0];
  if (!p?.id) return null;
  return {
    placeId: p.id,
    displayName: p.displayName?.text ?? null,
    formattedAddress: p.formattedAddress ?? null,
    websiteUri: p.websiteUri ?? null,
    photos: (p.photos ?? []).filter((ph) => ph.name),
  };
}

/** photo.name → 이미지 바이트 미디어 URL(키 포함). store 의 fetchUrl 로만 쓴다. */
export function photoMediaUrl(
  photoName: string,
  key: string,
  maxPx = 800,
): string {
  return (
    `https://places.googleapis.com/v1/${photoName}/media` +
    `?maxHeightPx=${maxPx}&maxWidthPx=${maxPx}&key=${encodeURIComponent(key)}`
  );
}
