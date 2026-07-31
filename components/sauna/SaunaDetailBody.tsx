"use client";

import { Phone, Navigation, Store } from "lucide-react";
import type {
  Sauna,
  BlogReview,
  SaunaReview,
  TempInfo,
  TempStat,
} from "@/lib/data/types";
import { BusinessHours } from "./BusinessHours";
import { PriceInfo } from "./PriceInfo";
import { TempHero } from "./TempHero";
import { SaunaTabs } from "./SaunaTabs";
import { SaunaLocationMap } from "./SaunaLocationMap";
import { VisitorReviews } from "./VisitorReviews";
import { BlogReviews } from "./BlogReviews";
import { FlameRating } from "./FlameRating";
import { SaunaMemoCard } from "./SaunaMemoCard";

/** 상세 탭에서 미리 보여줄 대표 후기 수(네이버 지도식 — 나머지는 후기 탭). */
const PREVIEW_REVIEWS = 2;

/**
 * 사우나 상세 본문(탭: 상세 정보 / 후기) — 상세 페이지와 지도 패널이 공유한다.
 * 네이버 지도식: 상세 탭 맨 아래에 대표 후기 몇 건을 미리 보여주고("후기 모두 보기" →
 * 후기 탭 전환), 후기 탭에서 전체 후기를 본다.
 * 부모가 좌우 px-[20px] 컨테이너를 제공해야 한다(탭 바의 -mx-[20px] 블리드 기준).
 * showLocationMap=false 면 위치 미니맵 섹션을 숨긴다(이미 지도 위인 패널 등에서 선택).
 */
/** seed(에디터 시딩)만으로 TempInfo 구성 — 집계 미전달 경로(지도 패널 등)의 폴백. */
function seedTempInfo(s: Sauna): TempInfo {
  const stat = (seed: number | null): TempStat => ({
    crowdValue: null,
    seedValue: seed,
    displayValue: seed,
    source: seed != null ? "editor" : "none",
    reportCount: 0,
    latestReportAt: null,
  });
  return {
    saunaRoom: stat(s.sauna_room_temp ?? null),
    coldBath: stat(s.cold_bath_temp ?? null),
  };
}

export function SaunaDetailBody({
  sauna: s,
  reviews,
  visitorReviews,
  tempInfo,
  showLocationMap = true,
}: {
  sauna: Sauna;
  reviews: BlogReview[];
  visitorReviews: SaunaReview[];
  /** 회원 제보 집계 포함 온도 정보. 미전달 시 seed(에디터 시딩)만으로 폴백. */
  tempInfo?: TempInfo;
  showLocationMap?: boolean;
}) {
  const temp = tempInfo ?? seedTempInfo(s);
  // 편의시설(네이버) — 주차는 기본 정보 행에 이미 있어 칩에서 제외(중복 방지).
  const amenities = (s.amenities ?? []).filter((a) => !a.includes("주차"));
  const hasSpec =
    s.sauna_kind.length > 0 ||
    s.has_sesin ||
    s.has_outdoor ||
    s.is_24h ||
    s.is_hot_spring ||
    !!s.water_note ||
    s.cold_bath_temp != null;

  // "상세 정보" 탭 — 기본/시설/소개/위치 + 맨 아래 대표 후기 미리보기.
  const detailSections = (goTo: (key: string) => void) => (
    <>
      {/* 기본 정보 — 영업/가격/전화/주차 + 편의시설 칩 */}
      <section>
        <SectionTitle>기본 정보</SectionTitle>
        <div className="flex flex-col rounded-[16px] bg-card px-[16px] shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
          <BusinessHours hours={s.hours} hoursJson={s.hours_json ?? null} />
          <PriceInfo price={s.price} priceList={s.price_list ?? null} />
          <InfoRow
            icon={<Phone size={18} />}
            label="전화"
            value={s.phone ?? "정보 없음"}
            href={s.phone ? `tel:${s.phone.replace(/[^0-9+]/g, "")}` : undefined}
          />
          <InfoRow
            icon={<Navigation size={18} />}
            label="주차"
            value={
              s.has_parking == null
                ? "정보 없음"
                : s.has_parking
                  ? (s.parking_note ?? "가능")
                  : "불가"
            }
          />
          {/* 편의시설 — 예약·대기공간·간편결제 등(네이버). 한 줄 콤마 나열. */}
          {amenities.length > 0 && (
            <div className="flex items-start gap-[12px] border-b border-line py-[14px] last:border-b-0">
              <span className="text-muted">
                <Store size={18} />
              </span>
              <span className="w-[68px] shrink-0 pt-[1px] text-[13px] text-muted">
                편의시설
              </span>
              <span className="flex-1 text-[14px] font-medium leading-[1.5] text-ink">
                {amenities.join(", ")}
              </span>
            </div>
          )}
        </div>
      </section>

      {/* 시설 정보 — 온도 + 시설 스펙 */}
      <section>
        <SectionTitle>시설 정보</SectionTitle>
        {/* 온도 히어로 — 사우나실/냉탕(남녀 토글) + 회원 제보 집계 */}
        <div className="mb-[12px]">
          <TempHero tempInfo={temp} saunaId={s.id} />
        </div>
        {hasSpec ? (
          <div className="flex flex-wrap gap-[8px]">
            {s.sauna_kind.map((k) => (
              <Spec key={k} label={k} />
            ))}
            {s.has_sesin && <Spec label="세신 가능" />}
            {s.has_outdoor && <Spec label="노천탕" />}
            {s.is_24h && <Spec label="24시간" />}
            {s.is_hot_spring && <Spec label="온천" />}
            {s.water_note && <Spec label={s.water_note} />}
            {s.cold_bath_temp != null && <Spec label={`냉탕 ${s.cold_bath_temp}°`} />}
          </div>
        ) : (
          <span className="text-[13px] text-muted">
            상세 시설 정보가 아직 없어요
          </span>
        )}
      </section>

      {/* 소개 — 에디터 수기 우선, 없으면 AI 정리(출처 라벨 명시). */}
      {s.editor_note ? (
        <section>
          <SectionTitle>에디터 소개</SectionTitle>
          <p className="text-[14px] leading-[1.6] text-ink/90">{s.editor_note}</p>
        </section>
      ) : (
        s.ai_description && (
          <section>
            <SectionTitle>소개</SectionTitle>
            <p className="text-[14px] leading-[1.6] text-ink/90">
              {s.ai_description}
            </p>
          </section>
        )
      )}

      {/* 후기 미리보기 — 대표 몇 건 + "모두 보기"로 후기 탭 전환(네이버 지도식). 위치보다 앞. */}
      <div className="border-t border-line pt-[28px]">
        <ReviewPreview
          visitorReviews={visitorReviews}
          blogReviews={reviews}
          onSeeAll={() => goTo("reviews")}
        />
      </div>

      {/* 미니맵 + 길찾기 — 후기 뒤. (패널 등에서 showLocationMap=false 면 숨김) */}
      {showLocationMap && (
        <section>
          <SectionTitle>위치</SectionTitle>
          <SaunaLocationMap
            location={s.location}
            name={s.name}
            address={s.address}
          />
        </section>
      )}
    </>
  );

  return (
    <div className="flex flex-col gap-[20px]">
      {/* 내 메모 — 비공개 개인 진입점. 상세/후기 탭 위에 노출. */}
      <SaunaMemoCard saunaId={s.id} />
      <SaunaTabs
        tabs={[
          { key: "detail", label: "상세 정보", content: detailSections },
        {
          key: "reviews",
          label: "후기",
          count: visitorReviews.length + reviews.length,
          content: (
            <div className="flex flex-col gap-[24px]">
              {/* 방문자 후기(회원 작성) — 위 */}
              <VisitorReviews saunaId={s.id} initialReviews={visitorReviews} />
              {/* 블로그 리뷰 — 아래(없으면 자동 숨김) */}
              <BlogReviews reviews={reviews} />
            </div>
          ),
        },
        ]}
      />
    </div>
  );
}

/**
 * 상세 탭 하단 대표 후기 미리보기 — 평점 요약 + 후기 PREVIEW_REVIEWS 건 +
 * "후기 모두 보기" 버튼(후기 탭으로 전환). 방문자 후기 우선, 없으면 블로그 후기로 폴백.
 */
function ReviewPreview({
  visitorReviews,
  blogReviews,
  onSeeAll,
}: {
  visitorReviews: SaunaReview[];
  blogReviews: BlogReview[];
  onSeeAll: () => void;
}) {
  const total = visitorReviews.length + blogReviews.length;
  const avg = visitorReviews.length
    ? visitorReviews.reduce((sum, r) => sum + r.rating, 0) / visitorReviews.length
    : 0;
  // 본문이 있는 후기를 우선 노출(더 정보가 많음).
  const previews = [...visitorReviews]
    .sort((a, b) => (b.body ? 1 : 0) - (a.body ? 1 : 0))
    .slice(0, PREVIEW_REVIEWS);
  const blogPreviews =
    previews.length === 0 ? blogReviews.slice(0, PREVIEW_REVIEWS) : [];

  return (
    <section>
      <div className="mb-[12px] flex items-center gap-[8px]">
        <span className="h-[15px] w-[3px] flex-none rounded-full bg-brand" />
        <h2 className="text-[16px] font-bold text-ink">후기</h2>
        {total > 0 && (
          <span className="text-[13px] font-semibold text-muted tabular-nums">
            {total}
          </span>
        )}
        {visitorReviews.length > 0 && (
          <span className="ml-auto flex items-center gap-[6px]">
            <FlameRating value={avg} size={15} gap={1} />
            <span className="text-[14px] font-bold text-hot tabular-nums">
              {avg.toFixed(1)}
            </span>
          </span>
        )}
      </div>

      {total === 0 ? (
        <p className="mb-[14px] py-[18px] text-center text-[13px] text-muted">
          아직 후기가 없어요 · 첫 후기를 남겨보세요
        </p>
      ) : (
        <ul className="mb-[14px] flex flex-col">
          {previews.map((r) => (
            <li
              key={r.id}
              className="border-b border-line py-[12px] last:border-b-0"
            >
              <div className="flex items-center gap-[8px]">
                <span className="text-[14px] font-semibold text-ink">
                  {r.nickname}
                </span>
                <FlameRating value={r.rating} size={13} gap={1} />
              </div>
              {r.body && (
                <p className="mt-[5px] line-clamp-2 text-[13px] leading-[1.5] text-ink/85">
                  {r.body}
                </p>
              )}
            </li>
          ))}
          {blogPreviews.map((r) => (
            <li
              key={r.id}
              className="border-b border-line py-[12px] last:border-b-0"
            >
              <div className="line-clamp-1 text-[14px] font-semibold text-ink">
                {r.title}
              </div>
              {r.snippet && (
                <p className="mt-[4px] line-clamp-2 text-[13px] leading-[1.5] text-muted">
                  {r.snippet}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={onSeeAll}
        className="flex h-[46px] w-full items-center justify-center rounded-[14px] border border-line bg-card text-[14px] font-semibold text-ink active:bg-black/5"
      >
        {total > 0 ? `후기 ${total}개 모두 보기` : "후기 남기기"}
      </button>
    </section>
  );
}

/**
 * 섹션 제목 — 좌측에 브랜드(vermilion) 액센트 바를 둬 단조로운 회색 화면에 온기를 준다.
 * badge 는 제목 우측 작은 라벨(예: "AI 정리").
 */
function SectionTitle({
  children,
  badge,
}: {
  children: React.ReactNode;
  badge?: React.ReactNode;
}) {
  return (
    <h2 className="mb-[12px] flex items-center gap-[8px] text-[16px] font-bold text-ink">
      <span className="h-[15px] w-[3px] flex-none rounded-full bg-brand" />
      {children}
      {badge}
    </h2>
  );
}

function InfoRow({
  icon,
  label,
  value,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  href?: string;
}) {
  const valueText = (
    <span className="flex-1 break-keep text-right text-[14px] font-semibold text-ink">
      {value}
    </span>
  );
  return (
    <div className="flex items-center gap-[12px] border-b border-line py-[14px] last:border-b-0">
      <span className="text-muted">{icon}</span>
      <span className="w-[68px] shrink-0 text-[13px] text-muted">{label}</span>
      {href ? (
        <a href={href} className="flex flex-1 justify-end">
          {valueText}
        </a>
      ) : (
        valueText
      )}
    </div>
  );
}

function Spec({ label, muted = false }: { label: string; muted?: boolean }) {
  return (
    <span
      className={
        muted
          ? "rounded-full border border-line bg-white px-[12px] py-[7px] text-[13px] font-medium text-muted"
          : "rounded-full bg-[#F6F5F4] px-[12px] py-[7px] text-[13px] font-medium text-ink"
      }
    >
      {label}
    </span>
  );
}
