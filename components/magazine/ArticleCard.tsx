import Link from "next/link";
import type { Article } from "@/lib/data/types";
import { ArticleThumb } from "@/components/magazine/ArticleThumb";

/** 피드 리스트 카드 — 전용 일러스트 + 제목 + 요약 + 발행일. */
export function ArticleCard({ article: a }: { article: Article }) {
  return (
    <Link href={`/feed/${a.slug}`} className="flex gap-[14px]">
      <ArticleThumb
        slug={a.slug}
        thumbnailUrl={a.thumbnail_url}
        alt={a.title}
        sizes="104px"
        className="h-[78px] w-[104px] flex-none rounded-[14px]"
      />
      <div className="min-w-0 flex-1">
        <div className="line-clamp-2 text-[15px] font-semibold leading-[1.35] text-ink text-pretty">
          {a.title}
        </div>
        {a.summary && (
          <div className="mt-[5px] line-clamp-2 text-[12px] font-normal text-muted">
            {a.summary}
          </div>
        )}
        {a.published_at && (
          <div className="mt-[6px] text-[11px] font-medium text-[#B0AAA1]">
            {a.published_at.slice(0, 10).replace(/-/g, ".")}
          </div>
        )}
      </div>
    </Link>
  );
}
