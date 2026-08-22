import type { MetadataRoute } from "next";
import { getSitemapSaunas, getSitemapArticles } from "@/lib/data/queries";

/**
 * 검색엔진용 사이트맵. 매장 상세(5천여 건) + 읽을거리 + 정적 화면.
 * 매장은 요청 시 SSR(ISR 60s)이라 사이트맵도 같은 주기로 갱신한다.
 * 로그인이 필요하거나 개인화된 화면(/my, /favorites)과 관리자·API 는 넣지 않는다.
 */
export const revalidate = 3600;

const BASE = "https://saunau.vercel.app";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${BASE}/`, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${BASE}/list`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${BASE}/map`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${BASE}/search`, lastModified: now, changeFrequency: "weekly", priority: 0.5 },
    { url: `${BASE}/feed`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
  ];

  // DB 가 잠깐 불안정해도 사이트맵 자체는 200 으로 나가야 한다(정적 경로만이라도).
  const [saunas, articles] = await Promise.all([
    getSitemapSaunas().catch(() => []),
    getSitemapArticles().catch(() => []),
  ]);

  const saunaRoutes: MetadataRoute.Sitemap = saunas.map((s) => ({
    url: `${BASE}/sauna/${encodeURIComponent(s.sido)}/${encodeURIComponent(s.slug)}`,
    lastModified: s.updated_at ? new Date(s.updated_at) : now,
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  const articleRoutes: MetadataRoute.Sitemap = articles.map((a) => ({
    url: `${BASE}/feed/${encodeURIComponent(a.slug)}`,
    lastModified: a.published_at ? new Date(a.published_at) : now,
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  return [...staticRoutes, ...saunaRoutes, ...articleRoutes];
}
