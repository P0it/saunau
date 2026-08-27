import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getSaunaBySlug,
  getSaunaPhotos,
  getBlogReviews,
  getSaunaReviews,
  getSaunaTempInfo,
} from "@/lib/data/queries";
import { CATEGORY_LABEL, primaryCategory } from "@/lib/data/types";
import { FavoriteScrubber } from "@/components/sauna/FavoriteScrubber";
import { RecordView } from "@/components/sauna/RecordView";
import { SaunaGallery } from "@/components/sauna/SaunaGallery";
import { AdminPhotoUpload } from "@/components/sauna/AdminPhotoUpload";
import { SaunaDetailBody } from "@/components/sauna/SaunaDetailBody";
import { FloatingBack } from "@/components/layout/FloatingBack";
import { FlameRating } from "@/components/sauna/FlameRating";

type Params = { sido: string; slug: string };

// 5천여 건을 빌드 타임에 전부 프리렌더하지 않고 요청 시 SSR(크롤 가능).
// generateStaticParams 를 두지 않으면 순수 동적 라우트(ƒ)로 동작.
export const revalidate = 60; // ISR: 60초마다 백그라운드 갱신(방문자는 캐시된 즉시 응답)

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { sido, slug } = await params;
  const s = await getSaunaBySlug(sido, slug);
  if (!s) return { title: "사우나를 찾을 수 없어요" };
  const cat = CATEGORY_LABEL[primaryCategory(s)];
  const canonical = `/sauna/${encodeURIComponent(s.sido)}/${s.slug}`;
  const description =
    s.editor_note ??
    `${s.address}. 사우나실 ${s.sauna_room_temp ?? "-"}° · 냉탕 ${s.cold_bath_temp ?? "-"}°`;
  return {
    title: `${s.name} — ${s.sigungu} ${cat}`,
    description,
    alternates: { canonical },
    // 공유 카드 이미지는 같은 폴더의 opengraph-image.tsx 가 붙인다.
    openGraph: {
      type: "website",
      siteName: "사우나우",
      locale: "ko_KR",
      url: canonical,
      title: `${s.name} — ${s.sigungu} ${cat}`,
      description,
    },
  };
}

export default async function SaunaDetailPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { sido, slug } = await params;
  const s = await getSaunaBySlug(sido, slug);
  if (!s) notFound();

  const [photos, reviews, visitorReviews, tempInfo] = await Promise.all([
    getSaunaPhotos(s.id),
    getBlogReviews(s.id),
    getSaunaReviews(s.id),
    getSaunaTempInfo(s.id, s),
  ]);

  const cat = CATEGORY_LABEL[primaryCategory(s)];

  // schema.org LocalBusiness 구조화 데이터(SEO)
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "HealthAndBeautyBusiness",
    name: s.name,
    address: {
      "@type": "PostalAddress",
      streetAddress: s.address,
      addressRegion: s.sido,
      addressLocality: s.sigungu,
      addressCountry: "KR",
    },
    ...(s.location
      ? {
          geo: {
            "@type": "GeoCoordinates",
            latitude: s.location.lat,
            longitude: s.location.lng,
          },
        }
      : {}),
    ...(s.phone ? { telephone: s.phone } : {}),
    ...(s.hours ? { openingHours: s.hours } : {}),
  };

  return (
    <article className="flex flex-col">
      <RecordView saunaId={s.id} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* gallery (사진 없거나 정책 OFF면 SaunaImage 가 Waves 폴백) */}
      <div className="relative h-[260px] w-full bg-[#EEF0F2]">
        <SaunaGallery
          photos={photos}
          fallbackUrl={s.thumbnail_url}
          alt={s.name}
        />
        <div className="absolute left-[12px] top-[12px]">
          <FloatingBack />
        </div>
        <div className="absolute right-[12px] top-[12px] flex h-[40px] w-[40px] items-center justify-center rounded-full bg-white/85 shadow-[0_1px_6px_rgba(0,0,0,0.12)] backdrop-blur">
          <FavoriteScrubber saunaId={s.id} size={30} onLight />
        </div>
        <div className="absolute bottom-[12px] right-[12px]">
          <AdminPhotoUpload saunaId={s.id} />
        </div>
      </div>

      <div className="flex flex-col gap-[20px] px-[20px] pb-[24px] pt-[18px]">
        {/* header */}
        <div>
          <div className="flex items-center gap-[8px]">
            <h1 className="text-[22px] font-bold tracking-[-0.02em] text-ink">
              {s.name}
            </h1>
            <span className="inline-flex items-center rounded-full bg-[#F6F5F4] px-[10px] py-[3px] text-[12px] font-semibold text-ink">
              {cat}
            </span>
          </div>
          <div className="mt-[8px] flex items-center gap-[7px]">
            <FlameRating value={s.rating_avg ?? 0} size={17} gap={2} />
            <span
              className={`text-[15px] font-bold tabular-nums ${
                s.rating_avg != null ? "text-hot" : "text-dot"
              }`}
            >
              {(s.rating_avg ?? 0).toFixed(1)}
            </span>
            <span className="text-[13px] text-muted tabular-nums">
              후기 {s.rating_count ?? 0}
            </span>
          </div>
          <div className="mt-[6px] text-[13px] font-medium text-muted tabular-nums">
            {s.distance_km != null && <>{s.distance_km}km · </>}
            {s.address}
          </div>
        </div>

        {/* 상세 본문(탭: 상세 정보 / 후기, 상세 탭 하단에 대표 후기 미리보기) — 지도 패널과 공유 */}
        <SaunaDetailBody
          sauna={s}
          reviews={reviews}
          visitorReviews={visitorReviews}
          tempInfo={tempInfo}
        />
      </div>
    </article>
  );
}
