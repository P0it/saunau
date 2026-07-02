import { Skeleton, PanelRowSkeleton } from "@/components/ui/Skeleton";

/**
 * 지도 전환 스켈레톤 — 실제 레이아웃과 동형(반응형).
 *  · 데스크톱(lg+): 왼쪽 사이드패널(검색+칩+목록) + 나머지 지도 영역.
 *  · 모바일(<lg): 하단 바텀시트(peek).
 * 지도 캔버스는 연회색(#ECEAE5, NaverMapView 루트와 동일)으로 채워 흰 화면 대기를 없앤다.
 */
export default function MapLoading() {
  return (
    <div className="relative h-full w-full overflow-hidden bg-[#ECEAE5]">
      {/* ── 데스크톱(lg+): 왼쪽 사이드패널 ── */}
      <div className="absolute inset-y-0 left-0 z-10 hidden w-full max-w-[400px] flex-col bg-card shadow-[6px_0_24px_rgba(0,0,0,0.12)] lg:flex">
        <div className="flex flex-col gap-[14px] px-[18px] pb-[10px] pt-[16px]">
          <Skeleton className="h-[22px] w-[96px] rounded-[6px]" />
          {/* 검색 바 */}
          <Skeleton className="h-[42px] w-full rounded-full" />
          {/* 카테고리 칩 */}
          <div className="flex gap-[8px]">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-[32px] w-[64px] rounded-full" />
            ))}
          </div>
        </div>
        {/* 목록 */}
        <div className="flex flex-1 flex-col gap-[16px] px-[18px] pb-[20px] pt-[6px]">
          {Array.from({ length: 6 }).map((_, i) => (
            <PanelRowSkeleton key={i} />
          ))}
        </div>
      </div>

      {/* 우측 기능 레일(줌/현재위치) 자리 — 데스크톱 */}
      <div className="absolute bottom-[24px] right-[16px] z-10 hidden flex-col gap-[18px] lg:flex">
        <Skeleton className="h-[90px] w-[44px] rounded-[12px]" />
        <Skeleton className="h-[44px] w-[44px] rounded-[12px]" />
      </div>

      {/* ── 모바일(<lg): 하단 바텀시트(peek) ── */}
      <div className="absolute inset-x-0 bottom-0 z-10 rounded-t-[20px] bg-card px-[16px] pb-[20px] pt-[14px] shadow-[0_-2px_16px_rgba(0,0,0,0.06)] lg:hidden">
        <Skeleton className="mx-auto mb-[14px] h-[4px] w-[40px] rounded-full" />
        <div className="flex flex-col gap-[16px]">
          {Array.from({ length: 2 }).map((_, i) => (
            <PanelRowSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
