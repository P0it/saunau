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
