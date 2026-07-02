import { Skeleton, SkeletonHeader } from "@/components/ui/Skeleton";

/**
 * 전역 전환 스켈레톤 — 전용 loading 이 없는 라우트(홈·검색·찜·마이 등)에 cascade.
 * 헤더 + 카드형 목록 뼈대. 서버 렌더/데이터 대기 동안 즉시 표시돼 "멈춘 느낌"을 없앤다.
 */
export default function Loading() {
  return (
    <div className="flex flex-col">
      <SkeletonHeader />
      <div className="flex flex-col gap-[14px] px-[16px] pb-[20px] pt-[6px]">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="overflow-hidden rounded-[20px] bg-card shadow-[0_2px_12px_rgba(0,0,0,0.05)]"
          >
            <Skeleton className="h-[150px] w-full rounded-none" />
            <div className="flex flex-col gap-[10px] p-[16px]">
              <Skeleton className="h-[16px] w-[60%] rounded-[6px]" />
              <Skeleton className="h-[12px] w-[35%] rounded-[6px]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
