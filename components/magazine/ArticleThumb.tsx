import type { ReactElement } from "react";
import { SaunaImage } from "@/components/sauna/SaunaImage";
import {
  ArticleEfficacyThumb,
  ArticleContrastBathThumb,
  ArticleKnowledgeThumb,
  ArticleEtiquetteThumb,
  ArticleTotonouThumb,
} from "@/components/illustrations";

/**
 * 읽을거리 커버 렌더의 단일 소스.
 * - thumbnail_url(실사진)이 있으면 **사진 우선**(next/image via SaunaImage).
 *   사진은 우리 Storage(*.supabase.co) 또는 로컬 /public 경로만 렌더된다(next.config remotePatterns).
 * - 사진이 없으면 slug별 **전용 일러스트 폴백**.
 *
 * 새 글에 사진을 붙이려면: 무료 상업 스톡(Unsplash/Pexels 등) 다운로드 →
 *   public/feed/<slug>.jpg 에 두고 frontmatter thumbnail_url: /feed/<slug>.jpg,
 *   또는 Supabase Storage 업로드 후 그 공개 URL. (import:articles 로 반영)
 *
 * 일러스트를 새로 만들 때: components/illustrations 에 Article*Thumb(120x82) 추가 +
 *   아래 맵에 slug 한 줄. 매핑 없으면 FALLBACK.
 * (일러스트는 상태 없는 정적 SVG 함수라, 렌더 시 함수로 호출해 엘리먼트를 얻는다.)
 */
type ThumbIllust = () => ReactElement;

const ARTICLE_ILLUST: Record<string, ThumbIllust> = {
  "sauna-efficacy-basics": ArticleEfficacyThumb,
  "contrast-bath-guide": ArticleContrastBathThumb,
  "sauna-types-101": ArticleKnowledgeThumb,
  "bath-etiquette": ArticleEtiquetteThumb,
  "japan-sauna-culture": ArticleTotonouThumb,
};

const FALLBACK: ThumbIllust = ArticleTotonouThumb;

export function articleIllust(slug: string): ThumbIllust {
  return ARTICLE_ILLUST[slug] ?? FALLBACK;
}

/** 글 커버 썸네일 — 사진 우선, 없으면 전용 일러스트. 부모가 크기를 잡아 준다. */
export function ArticleThumb({
  slug,
  thumbnailUrl = null,
  alt = "",
  sizes = "430px",
  className = "",
}: {
  slug: string;
  thumbnailUrl?: string | null;
  alt?: string;
  sizes?: string;
  className?: string;
}) {
  return (
    <div className={`relative overflow-hidden bg-[#EEF0F2] ${className}`}>
      {thumbnailUrl ? (
        <SaunaImage src={thumbnailUrl} alt={alt} sizes={sizes} />
      ) : (
        articleIllust(slug)()
      )}
    </div>
  );
}
