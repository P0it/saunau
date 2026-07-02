/**
 * 로딩 스켈레톤 프리미티브 — loading.tsx 들이 공용으로 쓴다.
 * 홈/목록 카드의 이미지 플레이스홀더(#EEF0F2)와 같은 톤 + pulse.
 * 화면 전환 즉시(서버 렌더 대기 전에) 뼈대를 보여줘 "멈춘 느낌"을 없앤다.
 */
export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`animate-pulse rounded-[8px] bg-[#EEF0F2] ${className}`}
    />
  );
}

/** 스크린 상단 sticky 헤더 자리(제목 한 줄). */
export function SkeletonHeader() {
  return (
    <div className="flex flex-none items-center px-[18px] pb-[10px] pt-[14px]">
      <Skeleton className="h-[22px] w-[96px] rounded-[6px]" />
    </div>
  );
}

/** SaunaCard 형태(이미지 상단 + 제목/부제) 스켈레톤 — 목록·홈 폴백 공용. */
export function SaunaCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-[20px] bg-card shadow-[0_2px_12px_rgba(0,0,0,0.05)]">
      <Skeleton className="h-[150px] w-full rounded-none" />
      <div className="flex flex-col gap-[10px] p-[16px]">
        <Skeleton className="h-[16px] w-[60%] rounded-[6px]" />
        <Skeleton className="h-[12px] w-[35%] rounded-[6px]" />
      </div>
    </div>
  );
}

/** 카드 스켈레톤 n개 목록. */
export function SaunaListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-[14px]">
      {Array.from({ length: count }).map((_, i) => (
        <SaunaCardSkeleton key={i} />
      ))}
    </div>
  );
}

/** 지도 패널/시트용 가로형(썸네일+2줄) 카드 스켈레톤. */
export function PanelRowSkeleton() {
  return (
    <div className="flex gap-[12px]">
      <Skeleton className="h-[64px] w-[64px] flex-none rounded-[14px]" />
      <div className="flex flex-1 flex-col justify-center gap-[8px]">
        <Skeleton className="h-[15px] w-[55%] rounded-[6px]" />
        <Skeleton className="h-[12px] w-[35%] rounded-[6px]" />
      </div>
    </div>
  );
}
