/**
 * 네이버 플레이스 **업체제공 사진** + 업종(category) 수집 — pcmap `/home` SSR 파싱.
 *
 * 2026-06 조사에서 "매장사진은 캡차로 막힘"으로 결론났었는데, 그건 `/photo` 페이지와
 * `pcmap-api…/graphql` XHR 경로 이야기다. `/home` SSR 은 캡차 없이 열리고
 * (crawl:naver-info 가 영업시간 때문에 이미 매번 받아온다) 그 `__APOLLO_STATE__` 안에
 * 사진 원본 URL 이 그대로 들어 있다.
 *
 * ⚠ 원시 HTML 을 정규식으로 긁으면 favicon 만 나온다 — 2026-06 조사가 여기 걸렸다.
 *    반드시 `__APOLLO_STATE__` 를 **JSON 파싱**해서 노드를 훑을 것.
 *
 * 출처가 기계 판독 가능하게 갈린다(구글 Places 엔 없는 정보다 — 거긴 업주 여부를 알 방법이 없다):
 *
 *   업체제공   id="business_N"  mediaSource="business"  ldb-phinf.pstatic.net       author 없음
 *   방문자리뷰 id="visitor_N"                           pup-review-phinf.pstatic.net author 닉네임
 *   블로그연동 id="visitor_N"                                                        author + linkUrl
 *
 * 우리는 **업체제공만** 쓴다. 방문자·블로그 사진은 저작자가 개인이라 건드리지 않는다.
 */
const HOME_ENDPOINT = "https://pcmap.place.naver.com/place";

// placeInfo.ts 와 같은 표준 브라우저 헤더(차단 회피용 표준 헤더; 우회/위장 목적 아님).
const BROWSER_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8",
  Referer: "https://pcmap.place.naver.com/",
};

export interface NaverBusinessPhoto {
  /** 업체가 올린 원본 이미지 URL(ldb-phinf). 다운로드·source_url 용. */
  originalUrl: string;
  width: number | null;
  height: number | null;
}

export interface NaverPlaceHome {
  /** 네이버 등록 업종. 예: "목욕탕,사우나" · "찜질방" · "헬스장" · "중식당". */
  category: string | null;
  /** 플레이스에 등록된 상호(우리 상호와 대조해 매칭 검증에 쓴다). */
  placeName: string | null;
  /** 업체제공 사진(mediaSource="business")만. */
  businessPhotos: NaverBusinessPhoto[];
  /** 방문자·블로그 사진 수(진단용 — 수집하지 않는다). */
  visitorPhotoCount: number;
}

/** `__APOLLO_STATE__ = {...}` 의 객체 리터럴만 잘라낸다(문자열 내 중괄호 무시). */
export function extractApolloRaw(html: string): string | null {
  const i = html.indexOf("__APOLLO_STATE__");
  if (i < 0) return null;
  const start = html.indexOf("{", i);
  if (start < 0) return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let j = start; j < html.length; j++) {
    const c = html[j];
    if (esc) {
      esc = false;
      continue;
    }
    if (c === "\\") {
      esc = true;
      continue;
    }
    if (c === '"') {
      inStr = !inStr;
      continue;
    }
    if (inStr) continue;
    if (c === "{") depth++;
    else if (c === "}" && --depth === 0) return html.slice(start, j + 1);
  }
  return null;
}

type Node = Record<string, unknown>;

/** apollo state 에서 업종·상호·사진을 뽑는다. */
export function parsePlaceHome(
  state: Record<string, Node>,
  placeId: string,
): NaverPlaceHome {
  let category: string | null = null;
  let placeName: string | null = null;
  const businessPhotos: NaverBusinessPhoto[] = [];
  let visitorPhotoCount = 0;

  for (const [key, node] of Object.entries(state)) {
    if (!node || typeof node !== "object") continue;
    const typename = String(node.__typename ?? "");

    if (typename === "PlaceDetailTopPhotoItem") {
      const isBusiness =
        node.mediaSource === "business" || String(node.id ?? "").startsWith("business");
      if (!isBusiness) {
        visitorPhotoCount++;
        continue;
      }
      const url = typeof node.originalUrl === "string" ? node.originalUrl : null;
      if (!url) continue;
      businessPhotos.push({
        originalUrl: url,
        width: typeof node.width === "number" ? node.width : null,
        height: typeof node.height === "number" ? node.height : null,
      });
      continue;
    }

    // 업종·상호는 이 플레이스 자신의 노드에서 (다른 업소 노드가 섞여 있을 수 있다).
    const isSelf = String(node.id ?? "") === placeId || key.includes(placeId);
    if (typeof node.category === "string" && node.category) {
      if (isSelf || !category) category = node.category;
    }
    if (typeof node.name === "string" && node.name) {
      if (isSelf || !placeName) placeName = node.name;
    }
  }

  return { category, placeName, businessPhotos, visitorPhotoCount };
}

export interface HomeFetchResult {
  data: NaverPlaceHome | null;
  /** 캡차/차단/구조변경 — 스킵마커를 남기면 안 되는 실패. */
  blocked: boolean;
}

/** placeId → /home SSR 1회 요청. 사진·업종을 한 번에 받는다(추가 요청 없음). */
export async function fetchPlaceHome(placeId: string): Promise<HomeFetchResult> {
  let html: string;
  try {
    const r = await fetch(`${HOME_ENDPOINT}/${encodeURIComponent(placeId)}/home`, {
      headers: BROWSER_HEADERS,
    });
    if (!r.ok) return { data: null, blocked: true };
    html = await r.text();
  } catch {
    return { data: null, blocked: true };
  }
  const raw = extractApolloRaw(html);
  if (!raw) return { data: null, blocked: true };
  let state: Record<string, Node>;
  try {
    state = JSON.parse(raw) as Record<string, Node>;
  } catch {
    return { data: null, blocked: true };
  }
  return { data: parsePlaceHome(state, placeId), blocked: false };
}

/* ── 매칭 검증 ─────────────────────────────────────────────────────────────── */

/**
 * 목욕 계열 업종 화이트리스트. 이게 아니면 **다른 업소가 매칭된 것**으로 본다.
 *
 * 호텔 부속 사우나는 네이버에 독립 등록이 잘 안 돼 있어서, 좌표·상호가 같은 호텔 안
 * 다른 업소(바·뷔페·중식당)가 대신 잡힌다. pickBestMatch 는 좌표+상호로만 판정하므로
 * 이걸 막을 수단이 없다 — 실제로 그랜드하얏트서울=바(BAR), 힐튼 경주=중식당,
 * AC호텔 바이메리어트=뷔페가 매칭돼 있었다. 그 상태로 사진·영업시간을 받으면
 * 사우나 자리에 호텔 바의 정보가 들어간다.
 *
 * 헬스장·복지시설은 **정상 매칭**이다(그 안의 목욕시설이 우리 대상). 제외하지 말 것.
 */
const BATH_CATEGORY_RE =
  /목욕|사우나|찜질|한증|불가마|온천|스파|해수|헬스|피트니스|휘트니스|스포츠|체육|복지|워터파크|수영|세신|때밀이|다이어트|비만|피부|체형|테라피|마사지|관리/;

/**
 * 명백히 **다른 업소**가 잡힌 업종. 화이트리스트보다 우선해 거부한다.
 * 실측 사례: 나인=카페("하동 한국차"), 휘경인삼사우나=이용원("드라이"),
 *   성산탕=이용원("성산탕이발관"), 서울모텔목욕탕=모텔, 휴림원=이용원("염색+컷").
 *   상호가 일반명사면 검색 랭킹에서 목욕탕이 밀려 흔하게 터진다.
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
