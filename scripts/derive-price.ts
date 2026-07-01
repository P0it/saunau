/**
 * 대표 입장료(price) 재계산 — 저장된 요금표(price_list)에서 파생.  네트워크 없음(빠름).
 *
 *   pnpm derive:price            # price_list 있는 모든 행의 price 재산출
 *   pnpm derive:price -- --dry   # 무엇이 바뀌는지만 출력
 *
 * crawl:naver-hours 는 price_list(원본)만 저장한다. 대표가 선택 로직(representativePrice)은
 * 패키지/회차권/쿠폰/부가서비스를 걸러 "1회 입욕 최저가"를 고른다. 로직이 바뀌면 재크롤 없이
 * 이 스크립트만 다시 돌리면 된다. price_list 있는 행만 건드린다(네이버 출처 = 안전하게 덮어씀).
 */
import { config } from "dotenv";
import { getAdminClient } from "../lib/supabase/admin";
import { representativePrice, type PriceItem } from "../lib/ingest/naver/placeInfo";

config({ path: ".env.local" });
config();

const dry = process.argv.includes("--dry");

async function main() {
  const supabase = getAdminClient();

  let from = 0;
  const PAGE = 500;
  const summary = { scanned: 0, set: 0, cleared: 0, unchanged: 0 };

  for (;;) {
    const { data, error } = await supabase
      .from("saunas")
      .select("id, name, price, price_list")
      .not("price_list", "is", null)
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`조회 실패: ${error.message}`);
    if (!data?.length) break;

    for (const row of data) {
      summary.scanned++;
      const list = (row.price_list ?? []) as PriceItem[];
      const next = Array.isArray(list) ? representativePrice(list) : null;
      const cur = (row.price as number | null) ?? null;
      if (next === cur) {
        summary.unchanged++;
        continue;
      }
      if (next == null) summary.cleared++;
      else summary.set++;
      if (dry) {
        console.log(`· ${row.name}: ${cur ?? "—"} → ${next ?? "—"}`);
      } else {
        const { error: upErr } = await supabase
          .from("saunas")
          .update({ price: next })
          .eq("id", row.id);
        if (upErr) throw new Error(`업데이트 실패(${row.name}): ${upErr.message}`);
      }
    }

    if (data.length < PAGE) break;
    from += PAGE;
  }

  console.log(`\n=== 대표 입장료 ${dry ? "탐색(dry)" : "재산출"} 완료 ===`);
  console.table(summary);
}

main().catch((e) => {
  console.error("derive:price 실패:", e);
  process.exit(1);
});
