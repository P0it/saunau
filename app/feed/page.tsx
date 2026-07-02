import type { Metadata } from "next";
import { getArticles } from "@/lib/data/queries";
import { ArticleCard } from "@/components/magazine/ArticleCard";
import { FeaturedArticleCard } from "@/components/magazine/FeaturedArticleCard";

export const revalidate = 60; // ISR: 60초마다 백그라운드 갱신(방문자는 캐시된 즉시 응답)

export const metadata: Metadata = {
  title: "읽을거리",
  description:
    "사우나 효능·냉온욕·사우나 지식·에티켓·해외 사우나 문화 — 사우나우가 큐레이션한 읽을거리.",
};

export default async function FeedPage() {
  const articles = await getArticles();
  const [hero, ...rest] = articles;

  return (
    <div className="flex min-h-full shrink-0 flex-col bg-white">
      <header className="sticky top-0 z-20 flex flex-none items-center bg-white/90 px-[18px] pb-[10px] pt-[14px] backdrop-blur">
        <span className="text-[18px] font-extrabold tracking-[-0.02em] text-ink">
          읽을거리
        </span>
      </header>

      {articles.length === 0 ? (
        <div className="px-[20px] py-[80px] text-center text-[14px] text-muted">
          아직 등록된 읽을거리가 없어요.
        </div>
      ) : (
        <div className="flex flex-col gap-[20px] px-[18px] pb-[28px] pt-[6px]">
          {hero && <FeaturedArticleCard article={hero} />}
          {rest.map((a) => (
            <ArticleCard key={a.id} article={a} />
          ))}
        </div>
      )}
    </div>
  );
}
