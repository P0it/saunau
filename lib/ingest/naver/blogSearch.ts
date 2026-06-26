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
