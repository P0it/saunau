/**
 * 네이버 플레이스 **매칭 정합성 검증** — 업종(category)으로 "다른 업소가 잡혔는지" 판정.
 *
 * pickBestMatch 는 좌표+상호로만 고르기 때문에, 상호가 일반명사거나 목욕시설이
 * 네이버에 독립 등록돼 있지 않으면 같은 건물의 다른 업소가 대신 잡힌다.
 * 실측: 나인=카페("하동 한국차"), 그랜드하얏트서울=바(BAR), 힐튼 경주=중식당,
 *   AC호텔 바이메리어트=뷔페, 성산탕=이용원, 서울모텔목욕탕=모텔.
 * 그 상태로 사진·영업시간·요금표를 받으면 사우나 자리에 카페 메뉴가 들어간다.
 *
 * 수집(사진)과 매칭(placeId 저장) 양쪽이 같은 기준을 써야 해서 여기 한 곳에 둔다.
 */

/**
 * 목욕 계열 업종 화이트리스트.
 * 헬스장·복지시설은 **정상 매칭**이다(그 안의 목욕시설이 우리 대상). 제외하지 말 것.
 */
const BATH_CATEGORY_RE =
  /목욕|사우나|찜질|한증|불가마|온천|스파|해수|헬스|피트니스|휘트니스|스포츠|체육|복지|워터파크|수영|세신|때밀이|다이어트|비만|피부|체형|테라피|마사지|관리/;

/**
 * 명백히 **다른 업소**가 잡힌 업종. 화이트리스트보다 우선해 거부한다.
 * 상호가 일반명사면 검색 랭킹에서 목욕탕이 밀려 흔하게 터진다.
 */
const NON_BATH_CATEGORY_RE =
  /바\(BAR\)|주점|호프|맥주|와인|칵테일|뷔페|한식|중식|일식|양식|식당|음식|카페|커피|베이커리|제과|디저트|치킨|피자|분식|고기|횟집|편의점|마트|약국|병원|의원|학원|미용실|이용원|이발|네일|모텔|여관|펜션|게스트하우스|캠핑|야영|부동산|주차장|주유소|은행|두부|제조|부속건물/;

/**
 * 목욕시설이 **부속된 모체 시설**이 잡힌 업종(호텔·콘도·복지회관 등).
 *
 * 매칭이 "틀린" 건 아니다 — 그 건물이 맞다. 다만 잡힌 플레이스는 숙소·회관 본체라
 * 거기 걸린 사진은 객실·로비지 목욕시설이 아니다. 그래서 **노출은 유지하되 사진은
 * 수집하지 않는다**. 숨은 부속시설 사우나는 서비스의 핵심 재고라 버리면 안 된다.
 */
const PARENT_VENUE_CATEGORY_RE = /호텔|콘도|리조트|회관|공공,행정|관광지|기업|장소대여/;

export type MatchVerdict = "ok" | "wrong_category" | "parent_venue" | "unknown";

/**
 * 네이버 업종으로 매칭 정합성을 판정한다. 사진 수집은 "ok" 에서만 한다.
 *  - wrong_category : 다른 업소가 잡힘 → 수집 금지 + 재매칭 대상으로 리포트.
 *  - parent_venue   : 부속시설의 모체(호텔·회관)가 잡힘 → 수집만 보류(노출은 유지).
 *  - ok             : 목욕 계열 업종.
 *  - unknown        : 업종 없음/판단 불가 → 보수적으로 수집 보류.
 */
export function verifyCategory(
  category: string | null,
  /** 우리 상호와 네이버 상호. 완전일치면 업종 거부를 뒤집는다(아래 설명). */
  names?: { ours: string; theirs: string | null },
): MatchVerdict {
  if (!category) return "unknown";
  if (NON_BATH_CATEGORY_RE.test(category)) {
    // 업종 문자열이 거칠어 진짜를 걷어차는 경우가 있다 — 실측: "성호리조트사우나" 가
    // 네이버 "성호리조트 사우나" [콘도,리조트부속건물] 로 잡혀 '부속건물' 때문에 거부됐다.
    // 상호가 **정규화 후 완전일치**면 같은 업소로 본다.
    // 포함(includes)으로 풀면 안 된다 — "성산탕" vs "성산탕이발관"[이용원] 이 통과해 버린다.
    if (names?.theirs && sameName(names.ours, names.theirs)) return "ok";
    return "wrong_category";
  }
  if (BATH_CATEGORY_RE.test(category)) return "ok";
  if (PARENT_VENUE_CATEGORY_RE.test(category)) return "parent_venue";
  return "unknown";
}

/** 공백·괄호·기호를 털어낸 뒤 완전일치인지. */
function sameName(a: string, b: string): boolean {
  const norm = (s: string) => s.replace(/[\s()（）·・,，.\-_]/g, "").toLowerCase();
  return norm(a) === norm(b);
}
