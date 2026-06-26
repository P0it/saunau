/**
 * 초기 적재 스크립트 (1회 실행).
 *   pnpm load:initial
 * 사전 준비:
 *   1) Supabase SQL Editor 에 supabase/migrations/0001_init.sql 붙여넣기(테이블 생성)
 *   2) .env.local 에 NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / PUBLIC_DATA_API_KEY
 * 목욕장업 + 온천표준데이터 적재 후 교차링크까지 수행.
 */
import { config } from "dotenv";
import { getAdminClient } from "../lib/supabase/admin";
import { runSync } from "../lib/ingest/runSync";

// .env.local → .env 순으로 로드
config({ path: ".env.local" });
config();

async function main() {
  const apiKey = process.env.PUBLIC_DATA_API_KEY;
  if (!apiKey) throw new Error("PUBLIC_DATA_API_KEY 환경변수가 필요합니다.");

  const supabase = getAdminClient();
  const t0 = Date.now();

  const summary = await runSync(supabase, {
    apiKey,
    geocodeMissing: Boolean(process.env.KAKAO_REST_API_KEY),
    onLog: (m) => console.log(`· ${m}`),
    onFetchProgress: ({ page, pages, fetched, total }) => {
      if (page === 1 || page === pages || page % 20 === 0) {
        console.log(`  목욕장업 ${page}/${pages}p (${fetched}/${total})`);
      }
    },
  });

  console.log("\n=== 적재 완료 ===");
  console.table(summary);
  console.log(`소요 ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}

main().catch((e) => {
  console.error("적재 실패:", e);
  process.exit(1);
});
