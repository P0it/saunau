import Link from "next/link";
import type { Article } from "@/lib/data/types";
import { ArticleThumb } from "@/components/magazine/ArticleThumb";

/** 피드 히어로 카드 — 큰 전용 일러스트 위 제목/요약. 최신 1편 강조용. */
export function FeaturedArticleCard({ article: a }: { article: Article }) {
  return (
    <Link
      href={`/feed/${a.slug}`}
      className="block overflow-hidden rounded-[22px] bg-card shadow-[0_2px_12px_rgba(0,0,0,0.05)]"
    >
      <ArticleThumb
        slug={a.slug}
        thumbnailUrl={a.thumbnail_url}
        alt={a.title}
        sizes="430px"
        className="h-[170px] w-full"
      />
      <div className="px-[16px] pb-[16px] pt-[13px]">
        <div className="line-clamp-2 text-[18px] font-extrabold leading-[1.32] tracking-[-0.02em] text-ink text-pretty">
          {a.title}
        </div>
        {a.summary && (
          <div className="mt-[6px] line-clamp-2 text-[13px] leading-[1.5] text-muted text-pretty">
            {a.summary}
          </div>
        )}
        {a.published_at && (
          <div className="mt-[8px] text-[11px] font-medium text-[#B0AAA1]">
            {a.published_at.slice(0, 10).replace(/-/g, ".")}
          </div>
        )}
      </div>
    </Link>
  );
}
