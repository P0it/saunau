import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getArticleBySlug } from "@/lib/data/queries";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { ArticleBody } from "@/components/magazine/ArticleBody";
import { ArticleThumb } from "@/components/magazine/ArticleThumb";

type Params = { slug: string };

export const revalidate = 60; // ISR: 60초마다 백그라운드 갱신(방문자는 캐시된 즉시 응답)

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const a = await getArticleBySlug(decodeURIComponent(slug));
  if (!a) return { title: "읽을거리를 찾을 수 없어요" };
  return {
    title: a.title,
    description: a.summary || undefined,
    alternates: { canonical: `/feed/${a.slug}` },
    openGraph: a.thumbnail_url ? { images: [a.thumbnail_url] } : undefined,
  };
}

export default async function ArticleDetailPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const a = await getArticleBySlug(decodeURIComponent(slug));
  if (!a) notFound();

  return (
    <div className="flex min-h-full shrink-0 flex-col bg-white">
      <ScreenHeader title="읽을거리" className="bg-white/90" />

      <ArticleThumb
        slug={a.slug}
        thumbnailUrl={a.thumbnail_url}
        alt={a.title}
        sizes="430px"
        className="h-[200px] w-full"
      />

      <article className="px-[20px] pb-[40px] pt-[18px]">
        <h1 className="text-[24px] font-extrabold leading-[1.3] tracking-[-0.02em] text-ink text-pretty">
          {a.title}
        </h1>
        {a.published_at && (
          <div className="mt-[8px] text-[12px] font-medium text-[#B0AAA1]">
            {a.published_at.slice(0, 10).replace(/-/g, ".")}
          </div>
        )}
        {a.summary && (
          <p className="mt-[12px] text-[15px] leading-[1.6] text-muted text-pretty">
            {a.summary}
          </p>
        )}

        <div className="mt-[18px] border-t border-line-soft pt-[6px]">
          <ArticleBody body={a.body} />
        </div>
      </article>
    </div>
  );
}
