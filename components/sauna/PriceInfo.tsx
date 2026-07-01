import { Coins } from "lucide-react";
import type { PriceItem } from "@/lib/data/types";

/**
 * 입욕료 — 네이버 요금표(price_list) 전 항목을 그대로 표시(일회비·세트·야간 등 구분 보존).
 * 요금표가 없으면 단일 price(에디터/파생) 또는 "정보 없음".
 */
export function PriceInfo({
  price,
  priceList,
}: {
  price: number | null;
  priceList: PriceItem[] | null;
}) {
  const list = (priceList ?? []).filter((p) => p.name);

  // 요금표 없음 → 한 줄(단일 price 또는 정보 없음).
  if (!list.length) {
    return (
      <Row>
        <span className="flex-1 break-keep text-right text-[14px] font-semibold text-ink">
          {price != null ? `${price.toLocaleString()}원` : "정보 없음"}
        </span>
      </Row>
    );
  }

  // 요금표 있음 → 항목 전체를 나열.
  return (
    <div className="border-b border-line py-[14px] last:border-b-0">
      <div className="flex items-center gap-[12px]">
        <span className="text-muted">
          <Coins size={18} />
        </span>
        <span className="text-[13px] text-muted">입욕료</span>
      </div>
      <ul className="mt-[8px] pl-[30px]">
        {list.map((p, i) => (
          <li
            key={`${p.name}-${i}`}
            className="flex items-baseline justify-between gap-[10px] py-[5px] text-[13px]"
          >
            <span className="break-keep text-muted">{p.name}</span>
            <span className="shrink-0 font-semibold text-ink tabular-nums">
              {p.price != null ? `${p.price.toLocaleString()}원` : (p.priceText ?? "-")}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** 단일 행(요금표 없을 때) — InfoRow 와 동일 외형. */
function Row({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-[12px] border-b border-line py-[14px] last:border-b-0">
      <span className="text-muted">
        <Coins size={18} />
      </span>
      <span className="w-[68px] shrink-0 text-[13px] text-muted">입욕료</span>
      {children}
    </div>
  );
}
