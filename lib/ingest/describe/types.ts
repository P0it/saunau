/** 매장 AI 소개 파이프라인 타입. */

export interface DescribeSaunaFacts {
  name: string;
  sido: string | null;
  sigungu: string | null;
  dong: string | null;
  is_jjimjilbang: boolean;
  is_hot_spring: boolean;
  is_enzyme: boolean;
  is_24h: boolean;
  has_outdoor: boolean;
  has_sesin: boolean;
  price: number | null;
  hours: string | null;
  sauna_room_temp: number | null;
  cold_bath_temp: number | null;
}

export interface DescribeReview {
  title: string | null;
  snippet: string | null;
}

export interface DescribeInput {
  sauna: DescribeSaunaFacts;
  reviews: DescribeReview[];
}

/** LLM 출력(JSON). facts 는 참고용(현재 권위 컬럼에 자동반영하지 않음). */
export interface DescribeResult {
  description: string;
  facts?: {
    price_won?: number | null;
    hours?: string | null;
    water?: string | null;
    parking?: string | null;
  };
}
