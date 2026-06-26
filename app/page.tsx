import Link from "next/link";
import { MapPin, ChevronRight } from "lucide-react";
import { getOpenCount, getNewOpenings, getArticles } from "@/lib/data/queries";
import type { ArticleCategory } from "@/lib/data/types";
import { HomeHeader } from "@/components/home/HomeHeader";
import { RecentPeek } from "@/components/home/RecentPeek";
import { TempHeadline } from "@/components/sauna/TempHeadline";
import { saunaHref } from "@/components/sauna/SaunaCard";
import {
  FeaturedMapScene,
  TrendingTubIllust,
  HotSaunaRoomIllust,
  BathhouseIllust,
  JjimjilbangIllust,
  HotSpringIllust,
  Night24Scene,
  OutdoorScene,
  SesinScene,
  ArticleEfficacyThumb,
  ArticleNewsThumb,
  ArticleGuideThumb,
} from "@/components/illustrations";

const ARTICLE_THUMB: Record<ArticleCategory, () => React.ReactNode> = {
  효능: ArticleEfficacyThumb,
  소식: ArticleNewsThumb,
  가이드: ArticleGuideThumb,
};

export const dynamic = "force-dynamic"; // 동기화된 DB를 항상 최신으로

export default async function HomePage() {
  const [openCount, newOpenings, articles] = await Promise.all([
    getOpenCount(),
    getNewOpenings(6),
    getArticles(3),
  ]);

  return (
    <div className="flex flex-col">
      <HomeHeader />

      <div className="flex flex-col gap-[12px] px-[16px] pb-[18px] pt-[4px]">
        {/* featured — 내 주변 사우나 */}
        <Link
          href="/map"
          className="relative h-[160px] overflow-hidden rounded-[22px] bg-card shadow-[0_2px_12px_rgba(0,0,0,0.05)]"
        >
          <div className="absolute inset-y-0 right-0 z-0 w-[190px]">
            <FeaturedMapScene />
            <div className="absolute inset-y-0 left-0 w-[48px] bg-gradient-to-r from-white to-transparent" />
          </div>
          <div className="relative z-[2] p-[20px]">
            <span className="inline-flex items-center gap-[4px] rounded-full bg-brand px-[11px] py-[5px] text-[11px] font-bold tabular-nums text-white">
              <MapPin size={12} />내 주변 {openCount}곳 영업중
            </span>
            <div className="mt-[13px] text-[20px] font-extrabold tracking-[-0.025em] text-ink">
              내 주변 사우나
            </div>
            <div className="mt-[5px] text-[13px] font-medium text-muted">
              지도로 한눈에 보기
            </div>
          </div>
        </Link>

        {/* two-card row */}
        <div className="flex gap-[12px]">
          <Link
            href="/list?sort=popular"
            className="relative h-[152px] flex-1 overflow-hidden rounded-[20px] bg-card shadow-[0_2px_12px_rgba(0,0,0,0.05)]"
          >
            <div className="relative z-[2] p-[16px]">
              <div className="text-[16px] font-bold tracking-[-0.01em] text-ink">
                요즘 뜨는
              </div>
              <div className="mt-[4px] text-[12px] font-medium text-muted">
                지금 인기 많은 곳
              </div>
            </div>
            <div className="absolute bottom-[8px] right-[6px] z-[1]">
              <TrendingTubIllust />
            </div>
          </Link>
          <Link
            href="/list?filter=hot"
            className="relative h-[152px] flex-1 overflow-hidden rounded-[20px] bg-card shadow-[0_2px_12px_rgba(0,0,0,0.05)]"
          >
            <div className="relative z-[2] p-[16px]">
              <div className="text-[16px] font-bold tracking-[-0.01em] text-ink">
                고온 사우나
              </div>
              <div className="mt-[4px] text-[12px] font-medium text-muted">
                90° 이상 뜨끈한 곳
              </div>
            </div>
            <div className="absolute bottom-[6px] right-[2px] z-[1] h-[81px] w-[116px]">
              <HotSaunaRoomIllust />
            </div>
          </Link>
        </div>

        {/* three category cards */}
        <div className="flex gap-[10px]">
          <CategoryCard href="/list?type=bathhouse" label="목욕탕">
            <div className="absolute bottom-[4px] right-[2px]">
              <BathhouseIllust />
            </div>
          </CategoryCard>
          <CategoryCard href="/list?type=jjimjilbang" label="찜질방">
            <div className="absolute bottom-[6px] right-[2px]">
              <JjimjilbangIllust />
            </div>
          </CategoryCard>
          <CategoryCard href="/list?type=hot_spring" label="온천">
            <div className="absolute bottom-[2px] right-[2px]">
              <HotSpringIllust />
            </div>
          </CategoryCard>
        </div>

        {/* 테마별 사우나 */}
        <div className="mx-[2px] mb-[8px] mt-[10px] text-[18px] font-extrabold tracking-[-0.02em] text-ink">
          테마별 사우나
        </div>
        <div className="no-scrollbar -mx-[16px] flex gap-[12px] overflow-x-auto px-[16px] pb-[4px] pt-[2px]">
          <ThemeCard
            href="/list?filter=24h"
            bg="#1A1B33"
            title="24시 영업"
            titleColor="#FFFFFF"
            sub="밤에도 문 여는 곳"
            subColor="#AEB0CE"
          >
            <Night24Scene />
          </ThemeCard>
          <ThemeCard
            href="/list?filter=outdoor"
            bg="#CDE7EC"
            title="노천 명소"
            titleColor="#1F3A2A"
            sub="탁 트인 풍경의 노천탕"
            subColor="#56715F"
          >
            <OutdoorScene />
          </ThemeCard>
          <ThemeCard
            href="/list?filter=sesin"
            bg="#E3F4F4"
            title="세신 명가"
            titleColor="#1C3B43"
            sub="세신 잘하는 곳"
            subColor="#6C8E96"
          >
            <SesinScene />
          </ThemeCard>
        </div>

        {/* 새로 오픈 */}
        {newOpenings.length > 0 && (
          <>
            <div className="flex items-center justify-between px-[2px] pb-[14px]">
              <span className="text-[18px] font-extrabold tracking-[-0.02em] text-ink">
                새로 오픈
              </span>
              <Link href="/list?sort=new" aria-label="새로 오픈 더보기">
                <ChevronRight size={20} className="text-[#B0AAA1]" />
              </Link>
            </div>
            <div className="no-scrollbar flex gap-[14px] overflow-x-auto px-[2px] pb-[30px]">
              {newOpenings.map((s) => (
                <Link key={s.id} href={saunaHref(s)} className="w-[172px] flex-none">
                  <div className="h-[118px] overflow-hidden rounded-[16px] bg-[#EEF0F2]" />
                  <div className="mt-[10px] text-[15px] font-semibold text-ink">
                    {s.name}
                  </div>
                  <div className="mt-[6px]">
                    <TempHeadline
                      saunaTemp={s.sauna_room_temp}
                      coldTemp={s.cold_bath_temp}
                    />
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}

        {/* 읽을거리 */}
        {articles.length > 0 && (
          <>
            <div className="px-[2px] pb-[14px]">
              <span className="text-[18px] font-extrabold tracking-[-0.02em] text-ink">
                읽을거리
              </span>
            </div>
            <div className="flex flex-col gap-[20px] px-[2px] pb-[20px]">
              {articles.map((a) => {
                const Thumb = ARTICLE_THUMB[a.category];
                return (
                  <Link
                    key={a.id}
                    href={`/magazine/${a.slug}`}
                    className="flex gap-[14px]"
                  >
                    <div className="relative h-[78px] w-[104px] flex-none overflow-hidden rounded-[14px]">
                      <Thumb />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] font-semibold text-brand">
                        사우나 {a.category}
                      </div>
                      <div className="mt-[5px] text-[15px] font-semibold leading-[1.35] text-ink text-pretty">
                        {a.title}
                      </div>
                      <div className="mt-[5px] text-[12px] font-normal text-muted">
                        {a.summary}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </>
        )}

        {/* 최근 본 사우나 (없으면 숨김) */}
        <RecentPeek />
      </div>
    </div>
  );
}

function CategoryCard({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="relative h-[130px] flex-1 overflow-hidden rounded-[18px] bg-card shadow-[0_2px_12px_rgba(0,0,0,0.05)]"
    >
      <div className="pl-[16px] pt-[14px] text-[16px] font-bold text-ink">
        {label}
      </div>
      {children}
    </Link>
  );
}

function ThemeCard({
  href,
  bg,
  title,
  titleColor,
  sub,
  subColor,
  children,
}: {
  href: string;
  bg: string;
  title: string;
  titleColor: string;
  sub: string;
  subColor: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="relative h-[140px] w-[140px] flex-none overflow-hidden rounded-[20px] shadow-[0_2px_12px_rgba(0,0,0,0.05)]"
      style={{ background: bg }}
    >
      {children}
      <div className="relative z-[2] pl-[16px] pt-[16px]">
        <div
          className="text-[16px] font-bold tracking-[-0.01em]"
          style={{ color: titleColor }}
        >
          {title}
        </div>
        <div
          className="mt-[4px] text-[12px] font-medium leading-[1.4]"
          style={{ color: subColor }}
        >
          {sub}
        </div>
      </div>
    </Link>
  );
}
