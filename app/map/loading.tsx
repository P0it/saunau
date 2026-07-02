import { Skeleton } from "@/components/ui/Skeleton";

/**
 * 지도 전환 스켈레톤 — 풀블리드. 지도 캔버스 자리(연회색) + 상단 필터 칩 + 하단 시트 뼈대.
 * 네이버 지도 SDK 로드 전에 즉시 표시돼 흰 화면 대기를 없앤다.
 */
export default function MapLoading() {
  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-[#EAECEF]">
      {/* 상단 빠른필터 칩 자리 */}
      <div className="flex flex-none gap-[8px] px-[14px] pb-[10px] pt-[14px]">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[34px] w-[68px] rounded-full" />
        ))}
      </div>
      <div className="flex-1" />
      {/* 하단 시트 자리 */}
      <div className="flex-none rounded-t-[20px] bg-card px-[16px] pb-[20px] pt-[14px] shadow-[0_-2px_16px_rgba(0,0,0,0.06)]">
        <Skeleton className="mx-auto mb-[14px] h-[4px] w-[40px] rounded-full" />
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="mb-[14px] flex gap-[12px]">
            <Skeleton className="h-[64px] w-[64px] rounded-[14px]" />
            <div className="flex flex-1 flex-col justify-center gap-[8px]">
              <Skeleton className="h-[15px] w-[55%] rounded-[6px]" />
              <Skeleton className="h-[12px] w-[35%] rounded-[6px]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
