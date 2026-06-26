/**
 * system_flags 런타임 킬스위치 토글.
 *
 *   pnpm tsx scripts/flag.ts images_enabled off        # 전 앱 사진 OFF (plain card)
 *   pnpm tsx scripts/flag.ts images_enabled on
 *   pnpm tsx scripts/flag.ts blog_reviews_enabled off  # 블로그 후기 섹션 OFF
 *   pnpm tsx scripts/flag.ts list                      # 현재 값 출력
 *
 * (Supabase 대시보드 > Table editor > system_flags 에서 직접 바꿔도 동일.)
 * 변경은 최대 30초(앱 캐시 TTL) 내 반영.
 */
import { config } from "dotenv";
import { getAdminClient } from "../lib/supabase/admin";

config({ path: ".env.local" });
config();

function parseOnOff(v: string): boolean {
  if (/^(on|true|1|yes)$/i.test(v)) return true;
  if (/^(off|false|0|no)$/i.test(v)) return false;
  throw new Error(`값은 on|off 여야 합니다(받음: ${v}).`);
}

async function main() {
  const [key, val] = process.argv.slice(2);
  const supabase = getAdminClient();

  if (key === "list" || !key) {
    const { data, error } = await supabase
      .from("system_flags")
      .select("key, value, updated_at")
      .order("key");
    if (error) throw error;
    console.table(data);
    return;
  }

  if (val == null) throw new Error("사용법: flag.ts <key> <on|off>");
  const bool = parseOnOff(val);

  const { error } = await supabase
    .from("system_flags")
    .upsert({ key, value: bool }, { onConflict: "key" });
  if (error) throw error;
  console.log(`✓ ${key} = ${bool}  (최대 30초 내 반영)`);
}

main().catch((e) => {
  console.error("실패:", e);
  process.exit(1);
});
