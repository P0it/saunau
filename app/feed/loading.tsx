import { Skeleton } from "@/components/ui/Skeleton";

/** 읽을거리(피드) 전환 스켈레톤 — 흰 배경 + 대형 히어로 + 아티클 카드 뼈대. */
export default function FeedLoading() {
  return (
    <div className="flex min-h-full flex-col bg-white">
      <div className="flex flex-none items-center px-[18px] pb-[10px] pt-[14px]">
        <Skeleton className="h-[22px] w-[96px] rounded-[6px]" />
      </div>
      <div className="flex flex-col gap-[20px] px-[18px] pb-[28px] pt-[6px]">
        <Skeleton className="h-[200px] w-full rounded-[18px]" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-[10px]">
            <Skeleton className="h-[150px] w-full rounded-[16px]" />
            <Skeleton className="h-[16px] w-[80%] rounded-[6px]" />
            <Skeleton className="h-[12px] w-[40%] rounded-[6px]" />
          </div>
        ))}
      </div>
    </div>
  );
}
