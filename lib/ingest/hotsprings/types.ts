/**
 * 전국온천표준데이터 API(tn_pubr_public_hot_spring_api) 타입.
 * 필드는 영문 camelCase. 위경도(lat/lot)는 이미 WGS84.
 */

export interface HotSpringApiItem {
  htspNm: string; // 온천명
  ctpvNm: string | null; // 시도명
  sggNm: string | null; // 시군구명
  lctnRoadNmAddr: string | null; // 도로명주소
  lctnLotnoAddr: string | null; // 지번주소
  lat: string | null; // 위도(WGS84)
  lot: string | null; // 경도(WGS84)
  htspIgrdNm: string | null; // 온천성분명
  htspTp: string | null; // 온천온도(원천 수온 ℃) — 욕탕 온도 아님
  htspQlty: string | null; // 온천천질
  htwlCnt: string | null; // 온천공수
  dpth: string | null; // 심도
  dsgnYr: string | null; // 지정연도
  mngInstNm: string | null; // 관리기관명
  mngInstTelno: string | null; // 관리기관전화번호
  dataCrtrYmd: string | null; // 데이터기준일자
  [key: string]: string | null | undefined;
}

/** hot_springs 테이블 upsert 행. */
export interface HotSpringRow {
  name: string;
  sido: string | null;
  sigungu: string | null;
  address: string | null;
  location: string | null; // EWKT
  source_temp: number | null;
  spring_quality: string | null;
  composition: string | null;
  well_count: number | null;
  depth: number | null;
  designated_year: number | null;
  manager_org: string | null;
  manager_tel: string | null;
  data_base_date: string | null;
}
