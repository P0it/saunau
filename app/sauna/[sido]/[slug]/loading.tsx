import { Skeleton } from "@/components/ui/Skeleton";

/** 사우나 상세 전환 스켈레톤 — 상단 히어로 사진 + 제목/스펙 + 본문 블록 뼈대. */
export default function SaunaDetailLoading() {
  return (
    <div className="flex flex-col">
      <Skeleton className="h-[280px] w-full rounded-none" />
      <div className="flex flex-col gap-[14px] px-[18px] pb-[24px] pt-[18px]">
        <Skeleton className="h-[24px] w-[65%] rounded-[6px]" />
        <Skeleton className="h-[14px] w-[45%] rounded-[6px]" />
        <div className="mt-[6px] flex gap-[10px]">
          <Skeleton className="h-[72px] flex-1 rounded-[16px]" />
          <Skeleton className="h-[72px] flex-1 rounded-[16px]" />
        </div>
        <Skeleton className="mt-[8px] h-[16px] w-full rounded-[6px]" />
        <Skeleton className="h-[16px] w-[90%] rounded-[6px]" />
        <Skeleton className="h-[16px] w-[75%] rounded-[6px]" />
      </div>
    </div>
  );
}
