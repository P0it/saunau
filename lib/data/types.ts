/**
 * PRD 6장 데이터 모델을 TS 타입으로 1:1 정의.
 * 다음 세션에 Supabase로 교체 시 이 타입을 그대로 재사용한다.
 * (Supabase 컬럼 geography(Point,4326) 는 클라이언트에선 { lat, lng } 로 다룬다)
 */

export interface GeoPoint {
  lat: number;
  lng: number;
}

/** 요일 키(월~일). */
export type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

/** 하루 영업시간(null = 그 요일 휴무). */
export interface DayHours {
  start: string; // "09:00"
  end: string; // "21:00"
  overnight: boolean; // 종료가 익일(자정 넘김)
  break: string | null; // 브레이크타임 "13:30~15:00"
  note: string | null; // 그 요일 비고
}

/** 요금표 항목 1개(네이버 Menu 노드). saunas.price_list. */
export interface PriceItem {
  name: string; // "성인(7세 이상)", "대인 목욕 (주간)" …
  price: number | null; // 원 단위(파싱 가능할 때)
  priceText: string | null; // 비정형("시가" 등)일 때 원문
}

/** 요일별 영업시간(네이버 newBusinessHours 구조화). saunas.hours_json. */
export interface WeekHours {
  is24h: boolean;
  days: Record<DayKey, DayHours | null>;
  summary: string; // 사람이 읽는 한 줄(hours 컬럼에도 저장)
}

/** 요일 표시 순서(월→일)와 한글 라벨. UI 공용. */
export const DAY_KEYS: DayKey[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
export const DAY_LABEL: Record<DayKey, string> = {
  mon: "월", tue: "화", wed: "수", thu: "목", fri: "금", sat: "토", sun: "일",
};

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
  is_enzyme: boolean; // 효소(발효) 찜질방 — 별도 카테고리
  is_sesin_shop: boolean; // 1인 세신샵(욕탕 없는 독립 세신) — 별도 카테고리(목욕탕 필터서 제외)
  venue_type: VenueType; // 장소 유형(탕 종류와 직교): 독립/숙박형/커뮤니티형
  is_24h: boolean;
  has_outdoor: boolean;
  sauna_room_temp: number | null; // 시그니처(대표/공통) — 에디터 시딩
  cold_bath_temp: number | null;
  // 탕별(남/여) 온도 — 없으면 위 공통값으로 폴백. (0012_gender_temps)
  sauna_room_temp_m?: number | null;
  sauna_room_temp_f?: number | null;
  cold_bath_temp_m?: number | null;
  cold_bath_temp_f?: number | null;
  has_sesin: boolean;
  sauna_kind: string[]; // 습식/건식/한증막 …
  price: number | null;
  price_list?: PriceItem[] | null; // 요금표(네이버 Menu). 없으면 null/빈배열.
  hours: string | null; // 요약 한 줄(hours_json.summary 또는 24시간 등). 표시 폴백.
  hours_json?: WeekHours | null; // 요일별 구조(네이버). 없으면 null.
  amenities?: string[] | null; // 편의시설(네이버 conveniences). 예: ["주차","무선 인터넷"]
  has_parking: boolean | null; // null=확인 안 됨
  parking_note: string | null;
  water_note: string | null; // 수질 특징(예: 천연암반수)
  thumbnail_url: string | null;
  editor_note: string | null;
  ai_description: string | null;
  slug: string;

  /** 방문자 후기(sauna_reviews) 집계 — 트리거로 유지하는 선계산 컬럼. */
  rating_avg: number | null; // 평균(1~5), 후기 없으면 null
  rating_count: number; // 후기 수

  /** 표시 전용(목 단계 사전계산 · Supabase에선 ST_Distance 파생) */
  distance_km?: number;
}

/**
 * 사진 출처(provenance). 서버 전용 — 교체 우선순위/퍼지 판단에만 쓴다.
 * 클라이언트로 내보내는 객체(SaunaPhoto/Sauna)에는 절대 포함하지 않는다.
 */
export type PhotoSource =
  | "naver_crawl"
  | "website"
  | "owner"
  | "editor"
  | "google"
  | "licensed"
  | "user"; // 사용자 업로드(0014) — 갤러리에만, 대표 썸네일 승격 금지

/**
 * 매장 사진(클라이언트 안전 형태).
 * url 은 항상 우리 Storage URL. 원본URL(source_url)·출처(source)는 서버에서 제거 후 전달.
 */
export interface SaunaPhoto {
  id: string;
  url: string;
  width: number | null;
  height: number | null;
  /** 출처 — 갤러리 출처 표기(저작권 고지)에 쓴다. 운영자 사진('editor')은 표기하지 않는다. */
  source: PhotoSource;
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

/**
 * 방문자 후기(회원 작성, 공유 노출). 불꽃 5점 + 한줄평.
 * nickname 은 표시용(profiles 조인). userId 로 "내 후기" 여부를 판별한다.
 */
export interface SaunaReview {
  id: string;
  saunaId: string;
  userId: string;
  rating: number; // 1~5
  body: string | null;
  nickname: string;
  created_at: string; // ISO datetime
}

/**
 * 온도 한 지표(사우나실 또는 냉탕)의 집계 상태.
 * displayValue = crowdValue(최근 30일 median, 제보 >= 임계치) ?? seedValue(에디터/성별 시딩) ?? null.
 */
export interface TempStat {
  crowdValue: number | null; // 최근 30일 median(반올림). 제보 < 임계치면 null
  seedValue: number | null; // 에디터/성별 시딩값(폴백)
  displayValue: number | null; // 우선순위 해석 결과(crowd → seed → null)
  source: "crowd" | "editor" | "none";
  reportCount: number; // 최근 30일 이 지표 제보 수
  latestReportAt: string | null; // 가장 최근 제보 시각(ISO)
}

/**
 * 매장 온도 정보 — 사우나실/냉탕. TempHero 표시용.
 * 남/여 축은 0027 에서 제거(제보·표시 모두 단일 축). saunas 의 *_m/_f 컬럼은 DB 에만 남아 있다.
 */
export interface TempInfo {
  saunaRoom: TempStat;
  coldBath: TempStat;
}

/** 사우나 최상위 타입 분류. 모든 행은 기본 대중탕, 플래그로 확장(복수 가능). */
export type SaunaCategory =
  | "bathhouse"
  | "jjimjilbang"
  | "hot_spring"
  | "enzyme"
  | "sesin";

/**
 * 장소 유형 — "탕 종류(SaunaCategory)"와 직교하는 "어떤 장소인가" 축.
 *  - standalone : 독립형(전통 대중탕/사우나/찜질방)
 *  - lodging    : 숙박형(호텔·리조트·숙소 부속) 예) 루프 사우나, 아늑 시그니처
 *  - community  : 커뮤니티형(휘트니스·주민체육·복지시설 부속) 예) 버핏그라운드, 구립체육센터
 */
export type VenueType = "standalone" | "lodging" | "community";

export const VENUE_LABEL: Record<VenueType, string> = {
  standalone: "독립형",
  lodging: "호텔·숙소",
  // "커뮤니티"는 사용자에게 모호 → 실제 담는 내용(체육·복지시설 부속 목욕/샤워)을 그대로 라벨화.
  community: "체육·복지시설",
};

/** visits — 다녀옴(3초 체크인). v1엔 적재 안 함(스키마만). */
export interface Visit {
  id: string;
  sauna_id: string;
  device_id: string;
  satisfaction: "개운해요" | "평범해요" | "아쉬워요";
  tags: string[];
  reported_sauna_temp: number | null;
  reported_cold_temp: number | null;
  reported_gender?: "male" | "female" | null; // 어느 탕에서 잰 값인지(0012_gender_temps)
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
  category: ArticleCategory | null; // 단일 피드에선 미사용(NULL)
  slug: string;
  published_at: string;
  is_published: boolean;
}

/** 사우나의 대표 카테고리 라벨(타입 뱃지용) — 독립 세신샵·효소가 가장 구체적이라 최우선. */
export function primaryCategory(s: Sauna): SaunaCategory {
  if (s.is_sesin_shop) return "sesin";
  if (s.is_enzyme) return "enzyme";
  if (s.is_hot_spring) return "hot_spring";
  if (s.is_jjimjilbang) return "jjimjilbang";
  return "bathhouse";
}

/**
 * 카테고리 "소속" 판정 — 겹침 허용(필터링용). primaryCategory(단일 라벨)와 달리 한 곳이 복수 소속될 수 있다.
 * 거의 모든 찜질방·온천이 안에 목욕탕(욕탕)을 포함하므로, "목욕탕" 필터는 찜질방·온천도 포함한다.
 * 효소찜질방(건식 발효)만 욕탕이 없어 목욕탕에서 제외.
 */
export function inCategory(s: Sauna, cat: SaunaCategory): boolean {
  switch (cat) {
    case "sesin":
      return s.is_sesin_shop;
    case "enzyme":
      return s.is_enzyme;
    case "hot_spring":
      return s.is_hot_spring;
    case "jjimjilbang":
      return s.is_jjimjilbang;
    case "bathhouse":
    default:
      // 독립 세신샵(욕탕 없음)·효소찜질은 목욕탕에서 제외.
      return !s.is_sesin_shop && (s.is_jjimjilbang || s.is_hot_spring || !s.is_enzyme);
  }
}

export const CATEGORY_LABEL: Record<SaunaCategory, string> = {
  bathhouse: "사우나",
  jjimjilbang: "찜질방",
  hot_spring: "온천",
  enzyme: "효소찜질방",
  sesin: "세신샵",
};
