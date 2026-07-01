/**
 * 공공데이터 적재 파이프라인 공용 타입.
 * 목욕장업 API(행정안전부 1741000) 응답은 영문 코드 필드명을 쓴다.
 */
import type { VenueType } from "../data/types";

/** 목욕장업 /info 응답의 item 1건 (사용하는 필드 위주, 값은 string | null). */
export interface BathApiItem {
  MNG_NO: string; // 관리번호 → license_no (upsert 키)
  BPLC_NM: string; // 사업장명
  ROAD_NM_ADDR: string | null; // 도로명주소
  LOTNO_ADDR: string | null; // 지번주소
  OPN_ATMY_GRP_CD: string | null; // 개방자치단체코드
  CRD_INFO_X: string | null; // 좌표 X (EPSG:5174 TM)
  CRD_INFO_Y: string | null; // 좌표 Y
  SALS_STTS_CD: string | null; // 영업상태코드 (01=영업/정상)
  SALS_STTS_NM: string | null; // 영업상태명
  BZSTAT_SE_NM: string | null; // 업태구분명 (공동탕업/한증막업/찜질시설/목욕장업 기타) — 1급 분류 신호
  SNTTN_BZSTAT_NM: string | null; // 위생업태명(업태구분명과 동일값)
  BTHRM_CNT: string | null; // 욕실수 — 구조적 대중탕 유무 보조 신호
  SWEATRM_YN: string | null; // 발한실여부 (Y/N) — 찜질방 신호
  TELNO: string | null; // 전화번호
  LCPMT_YMD: string | null; // 인허가일자 → open_date
  CLSBIZ_YMD: string | null; // 폐업일자
  [key: string]: string | null | undefined; // 그 외 필드 통과
}

/** data.go.kr 표준 응답 래퍼. */
export interface PublicDataResponse<T> {
  response: {
    header: { resultCode: string; resultMsg: string };
    body?: {
      items?: { item?: T[] } | T[];
      numOfRows?: number;
      pageNo?: number;
      totalCount?: number;
    };
  };
}

/** saunas 테이블에 upsert 할 공공 컬럼만(에디터 시딩 컬럼은 제외). */
export interface SaunaUpsertRow {
  license_no: string;
  name: string;
  address: string | null;
  sido: string | null;
  sigungu: string | null;
  dong: string | null;
  /** PostGIS geography 입력용 EWKT. 좌표 결측 시 null. */
  location: string | null;
  status: string | null;
  closed_date: string | null; // 영업 적재 행은 항상 null(재오픈 시 폐업 마킹 해제)
  phone: string | null;
  open_date: string | null; // YYYY-MM-DD
  is_jjimjilbang: boolean;
  is_hot_spring: boolean;
  is_enzyme: boolean; // 효소(발효) 찜질방 — 별도 카테고리
  venue_type: VenueType; // 장소 유형(탕 종류와 직교): 독립/숙박형/커뮤니티형
  is_24h: boolean;
  needs_review: boolean; // 노출 보류(강한 탕 라이선스+피트니스名)
  slug: string;
}
