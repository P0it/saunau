import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { getNewOpenings, getArticles } from "@/lib/data/queries";
import { HomeHeader } from "@/components/home/HomeHeader";
import { ScrollRow } from "@/components/layout/ScrollRow";
import { NearbyMapLink } from "@/components/home/NearbyMapLink";
import { RecentPeek } from "@/components/home/RecentPeek";
import { TempHeadline } from "@/components/sauna/TempHeadline";
import { saunaHref } from "@/components/sauna/SaunaCard";
import { SaunaImage } from "@/components/sauna/SaunaImage";
import { ArticleThumb } from "@/components/magazine/ArticleThumb";
import {
  TrendingTubIllust,
  HotSaunaRoomIllust,
  BathhouseIllust,
  JjimjilbangIllust,
  HotSpringIllust,
  Night24Scene,
  SesinScene,
  SandBathScene,
} from "@/components/illustrations";

export const revalidate = 60; // ISR: 60초마다 백그라운드 갱신(방문자는 캐시된 즉시 응답)

export default async function HomePage() {
  const [newOpenings, articles] = await Promise.all([
    getNewOpenings(6),
    getArticles(8),
  ]);

  return (
    <div className="flex flex-col">
      <HomeHeader />

      <div className="flex flex-col gap-[12px] px-[16px] pb-[18px] pt-[4px]">
        {/* featured — 내 주변 사우나 (클릭 시 위치 동의 → 내 위치에서 지도 열기) */}
        <NearbyMapLink />

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
            <div className="absolute bottom-[1px] right-[2px]">
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
        <ScrollRow className="no-scrollbar -mx-[16px] flex gap-[12px] overflow-x-auto px-[16px] pb-[4px] pt-[2px]">
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
            href="/list?type=enzyme"
            bg="#F6E7C8"
            title="효소찜질방"
            titleColor="#5B4426"
            sub="모래에 파묻는 발효 온열"
            subColor="#A98A57"
          >
            <SandBathScene />
          </ThemeCard>
          {/* 노천 명소 테마 — has_outdoor 데이터 소스가 없어(인제스트 미기록)
              항상 빈 목록 → 데이터 채워지기 전까지 숨김. 되살릴 땐 OutdoorScene 재사용. */}
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
        </ScrollRow>

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
            <ScrollRow className="no-scrollbar flex gap-[14px] overflow-x-auto px-[2px] pb-[30px]">
              {newOpenings.map((s) => (
                <Link key={s.id} href={saunaHref(s)} className="w-[172px] flex-none">
                  <div className="relative h-[118px] overflow-hidden rounded-[16px] bg-[#EEF0F2]">
                    <SaunaImage
                      src={s.thumbnail_url}
                      alt={s.name}
                      sizes="172px"
                      iconSize={24}
                    />
                  </div>
                  <div className="mt-[10px] line-clamp-2 h-[40px] text-[15px] font-semibold leading-[1.32] text-ink">
                    {s.name}
                  </div>
                  {s.open_date && (
                    <div className="mt-[4px] text-[12px] font-medium text-[#B0AAA1]">
                      {s.open_date.slice(0, 10).replace(/-/g, ".")} 오픈
                    </div>
                  )}
                  <div className="mt-[6px]">
                    <TempHeadline
                      saunaTemp={s.sauna_room_temp}
                      coldTemp={s.cold_bath_temp}
                    />
                  </div>
                </Link>
              ))}
            </ScrollRow>
          </>
        )}

        {/* 읽을거리 */}
        {articles.length > 0 && (
          <>
            <div className="flex items-center justify-between px-[2px] pb-[14px]">
              <span className="text-[18px] font-extrabold tracking-[-0.02em] text-ink">
                읽을거리
              </span>
              <Link href="/feed" aria-label="읽을거리 더보기">
                <ChevronRight size={20} className="text-[#B0AAA1]" />
              </Link>
            </div>
            <ScrollRow className="no-scrollbar flex gap-[14px] overflow-x-auto px-[2px] pb-[24px]">
              {articles.map((a) => (
                <Link
                  key={a.id}
                  href={`/feed/${a.slug}`}
                  className="w-[200px] flex-none"
                >
                  <ArticleThumb
                    slug={a.slug}
                    thumbnailUrl={a.thumbnail_url}
                    alt={a.title}
                    sizes="200px"
                    className="h-[120px] rounded-[16px]"
                  />
                  <div className="mt-[10px] line-clamp-2 h-[42px] text-[15px] font-semibold leading-[1.35] text-ink text-pretty">
                    {a.title}
                  </div>
                  {a.published_at && (
                    <div className="mt-[4px] text-[11px] font-medium text-[#B0AAA1]">
                      {a.published_at.slice(0, 10).replace(/-/g, ".")}
                    </div>
                  )}
                </Link>
              ))}
            </ScrollRow>
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
