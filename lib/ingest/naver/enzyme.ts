/**
 * 효소(발효) 찜질방 네이버 수집 — 정밀도 필터 + 새 행 생성 헬퍼(순수 함수).
 *
 * 왜 필요한가: 효소찜질은 목욕장업이 아니라 미용업/자유업 등으로 등록돼 공공데이터
 * (목욕장업 API)에 대부분 존재하지 않는다. 그래서 네이버 "효소찜질" 검색으로만 잡힌다.
 * 단 넓게 긁으면 발효식품·건강원 등 노이즈가 섞이므로 여기서 3중으로 걸러낸다.
 *  1) 스크립트가 "효소찜질"/"발효찜질" 같은 **구체 문구**로 검색(1차 필터)
 *  2) isEnzymeCandidate — category 화이트리스트 + 제외 키워드(2차 필터)
 *  3) 스크립트의 --dry 프리뷰(사람 눈검수. 검수 UI 가 없으므로 이 단계가 대체)
 */
import type { NaverPlaceCandidate } from "./placeInfo";

// 채택할 네이버 카테고리 — 목욕/찜질/사우나 계열 + 효소찜질이 흔히 등록되는 미용·체형·건강 계열.
// (테르엔 잠실새내점이 "피부,체형관리" 로 뜨는 것처럼 브랜드마다 등록 업종이 달라 넓게 받는다.)
const ACCEPT_CATEGORY_RE = /찜질|목욕|사우나|온천|스파|불가마|한증|피부|체형|테라피|건강|힐링|스톤/;
// 상호명에 '효소/발효'가 있으면 category 와 무관하게 채택. (브랜드는 category 로 잡히므로
// '찜질/한증/불가마' 같은 넓은 신호는 넣지 않는다 — 황토찜질·불한증막 등 비효소 오탐 방지.)
const ACCEPT_NAME_RE = /효소|발효/;
// 명백한 비-찜질(발효식품/건강원/카페/판매점 등) — 위 채택을 덮어써서 제외.
const REJECT_RE =
  /식품|카페|베이커리|제과|빵|판매|건강원|농장|한의|원액|매실|즙|마트|식당|정육|고깃?집|화장품|비누|세제|공장|도매|쇼핑|약국|약초|반찬|장아찌|김치|청국장|된장|음료|주스|엑기스|효소원/;

/**
 * "효소찜질" 검색 후보가 진짜 효소찜질(류)인지 판정.
 * REJECT 우선 → 그다음 category 화이트리스트 또는 상호 신호로 채택.
 */
// 이름에 효소/발효 신호가 없는데 일반 목욕/한증 시설임이 명시된 경우 — category 로 통과해도 제외.
// (예: "천안대중사우나불한증막" 목욕탕,사우나 — 효소찜질 검색에 걸려도 일반 사우나다.)
const GENERIC_BATH_NAME_RE = /대중사우나|불한증막|찜질방$/;

export function isEnzymeCandidate(c: Pick<NaverPlaceCandidate, "name" | "category">): boolean {
  const hay = `${c.name} ${c.category ?? ""}`;
  if (REJECT_RE.test(hay)) return false;
  const nameHasEnzyme = ACCEPT_NAME_RE.test(c.name);
  if (!nameHasEnzyme && GENERIC_BATH_NAME_RE.test(c.name)) return false;
  return ACCEPT_CATEGORY_RE.test(c.category ?? "") || nameHasEnzyme;
}

/** 전국 시도(네이버 검색 지역 분할용). list 는 쿼리당 상위 결과만 주므로 지역으로 쪼갠다. */
export const KR_REGIONS = [
  "서울", "부산", "대구", "인천", "광주", "대전", "울산", "세종",
  "경기", "강원", "충북", "충남", "전북", "전남", "경북", "경남", "제주",
] as const;

/** 지역 × 검색어 조합(네이버 list 쿼리 목록). */
export function enzymeQueries(regions: readonly string[] = KR_REGIONS): string[] {
  const terms = ["효소찜질", "발효찜질"];
  const out: string[] = [];
  for (const r of regions) for (const t of terms) out.push(`${r} ${t}`);
  return out;
}

/** 네이버 도로명/지번 주소에서 sido·sigungu·dong 분해(mapToSauna.parseRegion 과 동일 규칙). */
export function parseAddressRegion(address: string | null): {
  sido: string | null;
  sigungu: string | null;
  dong: string | null;
} {
  const tok = (address ?? "").trim().split(/\s+/).filter(Boolean);
  const sido = tok[0] ?? null;
  let sigungu: string | null = tok[1] ?? null;
  // 특례시 자치구: "고양시 덕양구" 처럼 시 + 구를 함께.
  if (tok[2] && /구$/.test(tok[2]) && /시$/.test(tok[1] ?? "")) {
    sigungu = `${tok[1]} ${tok[2]}`;
  }
  const dong = tok.find((t) => /(동|읍|면|가|리)$/.test(t)) ?? null;
  return { sido, sigungu, dong };
}

/** 공백/특수문자 정리해 slug base 생성(한글 유지). mapToSauna.slugify 와 동일. */
export function slugifyName(s: string): string {
  return s
    .normalize("NFC")
    .replace(/\(주\)|\(유\)|\(재\)/g, "")
    .toLowerCase()
    .replace(/[^0-9a-z가-힣]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
