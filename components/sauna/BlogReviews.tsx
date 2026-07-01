import { SaunaImage } from "./SaunaImage";
import type { BlogReview } from "@/lib/data/types";

/**
 * 블로그 후기 리스트 — 네이버 검색과 동일한 경험.
 * 각 카드 클릭 = 외부 링크아웃(원문 네이버 블로그로 바로 이동). blog_url 노출은 합법 인용.
 * blog_reviews_enabled OFF면 쿼리가 빈 배열을 주므로 섹션 자체가 숨겨진다.
 */
export function BlogReviews({ reviews }: { reviews: BlogReview[] }) {
  if (!reviews.length) return null;

  return (
    <section>
      <h2 className="mb-[12px] flex items-center gap-[8px] text-[16px] font-bold text-ink">
        <span className="h-[15px] w-[3px] flex-none rounded-full bg-brand" />
        블로그 리뷰
      </h2>
      <ul className="flex flex-col">
        {reviews.map((r) => (
          <li key={r.id}>
            <a
              href={r.blog_url}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="flex items-start gap-[12px] border-b border-line py-[14px] last:border-b-0"
            >
              <div className="min-w-0 flex-1">
                <div className="line-clamp-2 text-[14px] font-semibold leading-[1.4] text-ink">
                  {r.title}
                </div>
                {r.snippet && (
                  <p className="mt-[4px] line-clamp-2 text-[13px] leading-[1.5] text-muted">
                    {r.snippet}
                  </p>
                )}
                <div className="mt-[6px] text-[12px] text-dot tabular-nums">
                  {r.blogger_name && <>{r.blogger_name} · </>}
                  {r.posted_at}
                </div>
              </div>
              {r.thumb_url && (
                <div className="relative h-[64px] w-[64px] shrink-0 overflow-hidden rounded-[10px]">
                  <SaunaImage src={r.thumb_url} alt={r.title} sizes="64px" iconSize={20} />
                </div>
              )}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
