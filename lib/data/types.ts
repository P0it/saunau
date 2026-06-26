/**
 * PRD 6장 데이터 모델을 TS 타입으로 1:1 정의.
 * 다음 세션에 Supabase로 교체 시 이 타입을 그대로 재사용한다.
 * (Supabase 컬럼 geography(Point,4326) 는 클라이언트에선 { lat, lng } 로 다룬다)
 */

export interface GeoPoint {
  lat: number;
  lng: number;
}

/** saunas — 핵심 엔티티 */
export interface Sauna {
  id: string;
  license_no: string;
  name: string;
  address: string;
  sido: string;
  sigungu: string;
  dong: string;
  location: GeoPoint | null; // 좌표 결측(공공데이터 ~1.3%) 가능
  status: string;
  closed_date?: string | null; // 폐업일자(폐업 전환 시 마킹, 영업이면 null/미설정)
  phone: string | null;
  open_date: string | null; // ISO date
  created_at: string; // ISO datetime
  is_jjimjilbang: boolean;
  is_hot_spring: boolean;
  is_24h: boolean;
  has_outdoor: boolean;
  sauna_room_temp: number | null; // 시그니처 — 에디터 시딩
  cold_bath_temp: number | null;
  has_sesin: boolean;
  sauna_kind: string[]; // 습식/건식/한증막 …
  price: number | null;
  hours: string | null;
  thumbnail_url: string | null;
  editor_note: string | null;
  slug: string;

  /** 표시 전용(목 단계 사전계산 · Supabase에선 ST_Distance 파생) */
  distance_km?: number;
}

/**
 * 사진 출처(provenance). 서버 전용 — 교체 우선순위/퍼지 판단에만 쓴다.
 * 클라이언트로 내보내는 객체(SaunaPhoto/Sauna)에는 절대 포함하지 않는다.
 */
export type PhotoSource =
  | "naver_crawl"
  | "owner"
  | "editor"
  | "google"
  | "licensed";

/**
 * 매장 사진(클라이언트 안전 형태).
 * url 은 항상 우리 Storage URL. 원본URL(source_url)·출처(source)는 서버에서 제거 후 전달.
 */
export interface SaunaPhoto {
  id: string;
  url: string;
  width: number | null;
  height: number | null;
}

/**
 * 블로그 후기 링크 카드(클라이언트 안전 형태).
 * blog_url(원문 링크아웃)은 합법 인용이라 노출. thumb_url 은 우리 Storage 재호스팅분만(없으면 null).
 */
export interface BlogReview {
  id: string;
  title: string;
  snippet: string;
  blog_url: string;
  blogger_name: string | null;
  thumb_url: string | null;
  posted_at: string | null; // ISO date
}

/**
 * 런타임 콘텐츠 표시 정책(킬스위치). 서버에서 system_flags 로 해석해 적용한다.
 * - images.show=false  → 모든 사진 숨김(plain card)
 * - images.allowedSources → 특정 출처만 표시(예: naver_crawl 제외)
 * - blogReviews.show=false → 블로그 후기 섹션 전체 숨김
 */
export interface ContentPolicy {
  images: { show: boolean; allowedSources: PhotoSource[] };
  blogReviews: { show: boolean };
}

/** 사우나 최상위 타입 분류. 모든 행은 기본 대중탕, 플래그로 확장(복수 가능). */
export type SaunaCategory = "bathhouse" | "jjimjilbang" | "hot_spring";

/** visits — 다녀옴(3초 체크인). v1엔 적재 안 함(스키마만). */
export interface Visit {
  id: string;
  sauna_id: string;
  device_id: string;
  satisfaction: "개운해요" | "평범해요" | "아쉬워요";
  tags: string[];
  reported_sauna_temp: number | null;
  reported_cold_temp: number | null;
  created_at: string;
}

/** collections — 큐레이션 레일 */
export interface Collection {
  id: string;
  title: string;
  description: string | null;
  slug: string;
  sort: number;
  is_published: boolean;
  sauna_ids: string[]; // collection_saunas 조인을 목에선 배열로 단순화
}

/** articles — 읽을거리/매거진 */
export type ArticleCategory = "효능" | "소식" | "가이드";

export interface Article {
  id: string;
  title: string;
  summary: string;
  body: string; // markdown
  thumbnail_url: string | null;
  category: ArticleCategory;
  slug: string;
  published_at: string;
  is_published: boolean;
}

/** 사우나의 대표 카테고리 라벨(타입 뱃지용) */
export function primaryCategory(s: Sauna): SaunaCategory {
  if (s.is_hot_spring) return "hot_spring";
  if (s.is_jjimjilbang) return "jjimjilbang";
  return "bathhouse";
}

export const CATEGORY_LABEL: Record<SaunaCategory, string> = {
  bathhouse: "사우나",
  jjimjilbang: "찜질방",
  hot_spring: "온천",
};
