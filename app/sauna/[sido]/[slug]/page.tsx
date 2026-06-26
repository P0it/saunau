import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Clock, Coins, Phone, Navigation } from "lucide-react";
import {
  getSaunaBySlug,
  getSaunaPhotos,
  getBlogReviews,
} from "@/lib/data/queries";
import { CATEGORY_LABEL, primaryCategory } from "@/lib/data/types";
import { TempHeadline } from "@/components/sauna/TempHeadline";
import { FavoriteHeart } from "@/components/sauna/FavoriteHeart";
import { VisitButton } from "@/components/sauna/VisitButton";
import { RecordView } from "@/components/sauna/RecordView";
import { SaunaGallery } from "@/components/sauna/SaunaGallery";
import { BlogReviews } from "@/components/sauna/BlogReviews";
import { FloatingBack } from "@/components/layout/FloatingBack";

type Params = { sido: string; slug: string };

// 5천여 건을 빌드 타임에 전부 프리렌더하지 않고 요청 시 SSR(크롤 가능).
// generateStaticParams 를 두지 않으면 순수 동적 라우트(ƒ)로 동작.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { sido, slug } = await params;
  const s = await getSaunaBySlug(sido, slug);
  if (!s) return { title: "사우나를 찾을 수 없어요" };
  const cat = CATEGORY_LABEL[primaryCategory(s)];
  return {
    title: `${s.name} — ${s.sigungu} ${cat}`,
    description:
      s.editor_note ??
      `${s.address}. 사우나실 ${s.sauna_room_temp ?? "-"}° · 냉탕 ${s.cold_bath_temp ?? "-"}°`,
    alternates: { canonical: `/sauna/${encodeURIComponent(s.sido)}/${s.slug}` },
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

  const [photos, reviews] = await Promise.all([
    getSaunaPhotos(s.id),
    getBlogReviews(s.id),
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
        <div className="absolute right-[12px] top-[12px] flex h-[38px] w-[38px] items-center justify-center rounded-full bg-white/85 shadow-[0_1px_6px_rgba(0,0,0,0.12)] backdrop-blur">
          <FavoriteHeart saunaId={s.id} size={22} onLight />
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
          <div className="mt-[6px] text-[13px] font-medium text-muted tabular-nums">
            {s.distance_km != null && <>{s.distance_km}km · </>}
            {s.address}
          </div>
        </div>

        {/* 온도 헤드라인 히어로 */}
        <div className="rounded-[20px] bg-card p-[20px] shadow-[0_2px_12px_rgba(0,0,0,0.05)]">
          <div className="mb-[10px] text-[13px] font-semibold text-muted">
            온도 헤드라인
          </div>
          <TempHeadline
            saunaTemp={s.sauna_room_temp}
            coldTemp={s.cold_bath_temp}
            size="lg"
          />
          {(s.sauna_room_temp != null || s.cold_bath_temp != null) && (
            <div className="mt-[8px] text-[11px] text-muted">
              에디터 확인 기준 · 방문 제보로 보정 예정
            </div>
          )}
        </div>

        {/* 기본 정보 */}
        <div className="grid grid-cols-2 gap-y-[16px]">
          <InfoItem icon={<Clock size={18} />} label="영업시간" value={s.hours ?? "정보 없음"} />
          <InfoItem
            icon={<Coins size={18} />}
            label="입욕료"
            value={s.price != null ? `${s.price.toLocaleString()}원` : "정보 없음"}
          />
          <InfoItem icon={<Phone size={18} />} label="전화" value={s.phone ?? "정보 없음"} />
          <InfoItem icon={<Navigation size={18} />} label="길찾기" value="네이버 · 카카오" />
        </div>

        {/* 시설 스펙 */}
        <section>
          <h2 className="mb-[10px] text-[16px] font-bold text-ink">시설 정보</h2>
          <div className="flex flex-wrap gap-[8px]">
            {s.sauna_kind.map((k) => (
              <Spec key={k} label={k} />
            ))}
            {s.has_sesin && <Spec label="세신 가능" />}
            {s.has_outdoor && <Spec label="노천탕" />}
            {s.is_24h && <Spec label="24시간" />}
            {s.is_hot_spring && <Spec label="온천" />}
            {s.cold_bath_temp != null && <Spec label={`냉탕 ${s.cold_bath_temp}°`} />}
            {s.sauna_kind.length === 0 &&
              !s.has_sesin &&
              !s.has_outdoor &&
              !s.is_24h && (
                <span className="text-[13px] text-muted">
                  상세 시설 정보가 아직 없어요
                </span>
              )}
          </div>
        </section>

        {/* 에디터 소개 */}
        {s.editor_note && (
          <section>
            <h2 className="mb-[8px] text-[16px] font-bold text-ink">에디터 소개</h2>
            <p className="text-[14px] leading-[1.6] text-ink/90">{s.editor_note}</p>
          </section>
        )}

        {/* 블로그 후기 (네이버 검색식 링크아웃 리스트. 정책 OFF면 자동 숨김) */}
        <BlogReviews reviews={reviews} />

        {/* 미니맵 placeholder + 길찾기 */}
        <section>
          <h2 className="mb-[10px] text-[16px] font-bold text-ink">위치</h2>
          <div className="flex h-[140px] items-center justify-center rounded-[16px] border border-line bg-[#F2F5F9] text-[13px] text-muted">
            지도는 다음 업데이트에서 제공돼요
          </div>
          <div className="mt-[6px] text-[13px] text-muted">{s.address}</div>
        </section>

        {/* 액션 */}
        <div className="flex gap-[10px] pt-[4px]">
          <VisitButton saunaId={s.id} />
        </div>
      </div>
    </article>
  );
}

function InfoItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-[10px]">
      <span className="mt-[1px] text-muted">{icon}</span>
      <div className="min-w-0">
        <div className="text-[12px] text-muted">{label}</div>
        <div className="truncate text-[14px] font-semibold text-ink">{value}</div>
      </div>
    </div>
  );
}

function Spec({ label }: { label: string }) {
  return (
    <span className="rounded-full bg-[#F6F5F4] px-[12px] py-[7px] text-[13px] font-medium text-ink">
      {label}
    </span>
  );
}
