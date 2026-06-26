/** 네이버 수집 파이프라인 공용 타입. */

/** 네이버 지역 검색으로 매칭된 장소(좌표·도로명 확인용). */
export interface NaverPlaceMatch {
  /** place id (사진 조회에 필요). 지역검색 API엔 없어 별도 해석. */
  placeId: string | null;
  title: string; // 태그 제거된 상호
  category: string | null;
  roadAddress: string | null;
  address: string | null;
  telephone: string | null;
  lng: number | null; // mapx → WGS84
  lat: number | null; // mapy → WGS84
}

/** 수집한 사진 1장(다운로드 전 원본 URL). */
export interface NaverPhoto {
  sourceUrl: string; // 원본(서버 전용)
  width?: number | null;
  height?: number | null;
}

/** 네이버 블로그 검색 결과 1건(공식 API). */
export interface NaverBlogPost {
  title: string; // 태그·엔티티 제거
  snippet: string; // 태그·엔티티 제거
  blogUrl: string; // 원문 링크아웃
  bloggerName: string | null;
  postedAt: string | null; // YYYY-MM-DD
  /** og:image 를 우리 Storage 로 재호스팅한 URL(수집 단계에서 채움). 없으면 null. */
  thumbUrl?: string | null;
}
