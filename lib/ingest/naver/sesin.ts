/**
 * 1인 세신샵 네이버 수집 — 정밀도 필터(순수 함수).  효소(enzyme.ts)와 같은 패턴.
 *
 * 세신샵은 욕탕이 없어 목욕장업이 아니라 미용업/자유업 등으로 등록돼 공공데이터에 대부분 없다.
 * 네이버 "세신샵"/"1인 세신샵" 검색으로만 잡힌다.
 *
 * ⚠ 효소와 다른 점: 세신샵의 네이버 category 가 "목욕탕,사우나"·"목욕,찜질" 처럼 진짜 목욕탕과
 *   겹친다(1인 세신샵도 그렇게 등록됨). 그래서 category 화이트리스트로 받으면 진짜 목욕탕까지
 *   딸려온다. 대신 **상호에 '세신' 포함**을 채택 기준으로 삼는다(네이버가 "1인 세신샵 ○○"
 *   처럼 세신 descriptor 를 상호에 붙여줘 정밀도가 높다).
 */
import type { NaverPlaceCandidate } from "./placeInfo";

// 상호에 '세신'이 있어야 채택(세신샵/1인 세신샵 …).
const ACCEPT_NAME_RE = /세신/;
// + category 가 목욕/미용 계열이어야 채택. "세신"이 회사명일 뿐인 비-세신(세신상사=도소매,
//   세신이용소=이용원, 세신미용실=미용실, 세신기업사=자전거, 세신센터=오토바이 …)을 컷한다.
//   (진짜 목욕탕은 상호에 '세신'이 없어 어차피 채택되지 않으므로, 목욕/사우나 category 를 넣어도 안전.)
const ACCEPT_CATEGORY_RE = /목욕|찜질|사우나|온천|스파|피부|체형|발관리|세신|때밀이|마사지|테라피/;

/** "세신샵" 검색 후보가 세신샵인지 판정: 상호에 '세신' + category 가 목욕/미용 계열. */
export function isSesinCandidate(c: Pick<NaverPlaceCandidate, "name" | "category">): boolean {
  if (!ACCEPT_NAME_RE.test(c.name)) return false;
  return ACCEPT_CATEGORY_RE.test(c.category ?? "");
}

/** 지역 × 검색어 조합(네이버 list 쿼리 목록). */
export function sesinQueries(regions: readonly string[]): string[] {
  const terms = ["세신샵", "1인 세신샵"];
  const out: string[] = [];
  for (const r of regions) for (const t of terms) out.push(`${r} ${t}`);
  return out;
}
