import { SkeletonHeader, SaunaListSkeleton } from "@/components/ui/Skeleton";

/**
 * 전역 전환 스켈레톤 — 전용 loading 이 없는 라우트(홈·검색·찜·마이 등)에 cascade.
 * 헤더 + 카드형 목록 뼈대. 서버 렌더/데이터 대기 동안 즉시 표시돼 "멈춘 느낌"을 없앤다.
 */
export default function Loading() {
  return (
    <div className="flex flex-col">
      <SkeletonHeader />
      <div className="px-[16px] pb-[20px] pt-[6px]">
        <SaunaListSkeleton count={4} />
      </div>
    </div>
  );
}
