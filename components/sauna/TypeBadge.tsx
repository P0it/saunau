import type { Sauna } from "@/lib/data/types";
import { CATEGORY_LABEL, primaryCategory } from "@/lib/data/types";

/** 시설 타입 라벨(온천/사우나/찜질방). 카드는 담백한 텍스트, 상세는 pill. */
export function TypeBadge({
  sauna,
  variant = "text",
}: {
  sauna: Sauna;
  variant?: "text" | "pill";
}) {
  const label = CATEGORY_LABEL[primaryCategory(sauna)];
  if (variant === "pill") {
    return (
      <span className="inline-flex items-center rounded-full bg-[#F6F5F4] px-[10px] py-[3px] text-[12px] font-semibold text-ink">
        {label}
      </span>
    );
  }
  return <span className="text-[12px] font-medium text-muted">{label}</span>;
}
