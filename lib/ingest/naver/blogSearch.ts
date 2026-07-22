/**
 * 네이버 블로그 검색 — **공식 Open API**(합법 경로).
 *   GET https://openapi.naver.com/v1/search/blog.json
 *   헤더: X-Naver-Client-Id / X-Naver-Client-Secret
 *
 * 제목·발췌·원문링크·블로거명·작성일만 가져온다(본문 복제 없음).
 * 표시는 "제목 + 짧은 발췌 + 원문 링크아웃"으로, 정당한 인용 범위.
 * 무료 쿼터(일 25,000) 내. 자격증명: env NAVER_CLIENT_ID / NAVER_CLIENT_SECRET.
 */
import type { NaverBlogPost } from "./types";

const ENDPOINT = "https://openapi.naver.com/v1/search/blog.json";

/** <b> 등 태그 제거 + HTML 엔티티 디코드. */
function stripHtml(s: string): string {
  return (s ?? "")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .trim();
}

/** "20260603" → "2026-06-03". 형식 불명이면 null. */
function parsePostDate(raw: string | undefined): string | null {
  const m = /^(\d{4})(\d{2})(\d{2})$/.exec((raw ?? "").trim());
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

interface NaverBlogItem {
  title?: string;
  link?: string;
  description?: string;
  bloggername?: string;
  postdate?: string;
}

export interface NaverCreds {
  clientId: string;
  clientSecret: string;
}

export function getNaverCreds(): NaverCreds {
  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      "NAVER_CLIENT_ID / NAVER_CLIENT_SECRET 환경변수가 필요합니다(네이버 검색 Open API).",
    );
  }
  return { clientId, clientSecret };
}

/** 검색 쿼리용 상호 정리: 괄호 병기 제거. ("토바(TOVA)" → "토바" — 괄호째 검색하면 0건) */
export function cleanNameForQuery(name: string): string {
  return (name ?? "").replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();
}

/** 매칭용 정규화: 공백·괄호 제거 + 소문자. ("스파 랜드" ↔ "스파랜드", "역삼 GFC" ↔ "역삼GFC") */
function normalizeForMatch(s: string): string {
  return (s ?? "").replace(/[\s()]+/g, "").toLowerCase();
}

/** 업종 범용 토큰 — 상호 고유성 판단에서 제외. (예: "작은목욕탕" → 고유 토큰 "작은") */
const GENERIC_TOKENS = [
  "사우나",
  "찜질방",
  "찜질",
  "스파",
  "온천",
  "목욕탕",
  "목욕",
  "불가마",
  "한증막",
  "24시간",
  "24시",
  "헬스",
  "휘트니스",
  "피트니스",
  "주식회사",
];

/** 상호를 공백 단위 토큰으로 쪼개 범용어를 걷어낸 "고유 토큰" 목록. */
function distinctiveTokens(name: string): string[] {
  const out: string[] = [];
  for (const raw of cleanNameForQuery(name).split(/\s+/)) {
    let t = normalizeForMatch(raw);
    for (const g of GENERIC_TOKENS) t = t.split(g).join("");
    if (t.length >= 2) out.push(t);
  }
  return out;
}

/** 목욕·사우나 글임을 뒷받침하는 도메인 어휘. (상호 일치만으론 "세키토바"류 오탐을 못 거른다) */
const DOMAIN_TERMS = [
  "사우나",
  "찜질",
  "목욕",
  "온천",
  "스파",
  "세신",
  "불가마",
  "한증막",
  "수면실",
  "냉탕",
  "온탕",
  "열탕",
  "가족탕",
  "대중탕",
  "입욕",
  "반신욕",
  "족욕",
  "효소",
  "자쿠지",
];

/**
 * 후기가 아니라 **업소 정보를 나열하는 디렉터리 사이트**. 상호·지역이 정확히 일치해
 * 관련성 필터를 통과하지만, 방문기가 아니라 등록 정보라 후기로 노출하면 안 된다.
 *
 * 판별 근거(수집분 7,164건 실측): 정상 블로그는 og:image 보유율 92~100% 인데
 * 이 도메인들은 **0%** 였고, 제목이 "{상호} - {지역} {업태} | {사이트명}" 꼴로 획일적이다.
 */
const BLOCKED_HOSTS = new Set([
  "bloomjda.net", // 꽃피다 — 업체 디렉터리
  "dumbndumber.co.kr", // 업소 나열
  "march14th.net", // 업소 나열
]);

/** 디렉터리 사이트 글인가. 파싱 불가 URL 은 막지 않는다(보수적). */
export function isBlockedBlogHost(url: string): boolean {
  try {
    return BLOCKED_HOSTS.has(new URL(url).hostname.replace(/^www\./, ""));
  } catch {
    return false;
  }
}

/**
 * 검색 결과 중 "이 업소 글"만 남기는 보수적 관련성 필터.
 * 쿼리(`상호 시군구`)만으론 동명·범용 상호가 엉뚱한 글을 끌어오므로:
 *
 *  0) 디렉터리 사이트(BLOCKED_HOSTS)는 상호가 맞아도 제외 — 후기가 아니다,
 *  1) 도메인 어휘가 제목+발췌에 있어야 하고(카페·인테리어·시술 글 차단),
 *  2) 상호가 실제로 등장해야 한다 —
 *     전체 상호(공백 무시) 일치면 통과, 아니면 고유 토큰 다수결(2개 이하=전부,
 *     3개 이상=70%)로 판정. 긴 상호("아늑 호텔 앤 스파 부천 상동…")도 부분 표기와 매칭된다.
 *  3) 상호가 범용어뿐이면 전체 상호 + 시군구 동시 일치 요구.
 */
export function filterRelevantPosts(
  posts: NaverBlogPost[],
  sauna: { name: string; sigungu?: string | null },
): NaverBlogPost[] {
  const fullName = normalizeForMatch(cleanNameForQuery(sauna.name));
  const tokens = distinctiveTokens(sauna.name);
  const sigungu = normalizeForMatch(sauna.sigungu ?? "");
  const required =
    tokens.length <= 2 ? tokens.length : Math.ceil(tokens.length * 0.7);

  return posts.filter((p) => {
    if (isBlockedBlogHost(p.blogUrl)) return false;
    const hay = normalizeForMatch(`${p.title} ${p.snippet}`);
    if (!DOMAIN_TERMS.some((t) => hay.includes(t))) return false;
    if (!tokens.length) {
      // 상호가 범용어뿐 → 전체 상호 + 지역 동시 일치 요구
      return hay.includes(fullName) && (!sigungu || hay.includes(sigungu));
    }
    if (hay.includes(fullName)) return true;
    return tokens.filter((t) => hay.includes(t)).length >= required;
  });
}

/**
 * 사우나 1곳의 블로그 후기 검색.
 * @param query 보통 `${상호} ${시군구}` (동음이의 최소화)
 */
export async function searchBlogReviews(
  query: string,
  creds: NaverCreds,
  display = 5,
): Promise<NaverBlogPost[]> {
  const url =
    `${ENDPOINT}?query=${encodeURIComponent(query)}` +
    `&display=${display}&sort=sim`;

  const r = await fetch(url, {
    headers: {
      "X-Naver-Client-Id": creds.clientId,
      "X-Naver-Client-Secret": creds.clientSecret,
    },
  });
  if (!r.ok) {
    throw new Error(`네이버 블로그 검색 실패: HTTP ${r.status} ${await r.text()}`);
  }
  const json = (await r.json()) as { items?: NaverBlogItem[] };
  return (json.items ?? [])
    .filter((it) => it.link)
    .map((it) => ({
      title: stripHtml(it.title ?? ""),
      snippet: stripHtml(it.description ?? ""),
      blogUrl: it.link as string,
      bloggerName: stripHtml(it.bloggername ?? "") || null,
      postedAt: parsePostDate(it.postdate),
    }));
}
