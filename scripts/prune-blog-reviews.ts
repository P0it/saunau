/**
 * 디렉터리 사이트 후기 숨김 — 후기가 아닌 업소 등록 페이지를 목록에서 내린다.
 *
 *   pnpm prune:reviews            # 드라이런(기본) — 대상만 출력
 *   pnpm prune:reviews --apply    # is_active=false 로 숨김
 *   pnpm prune:reviews --apply --restore   # 되돌리기(is_active=true)
 *
 * 판별은 blogSearch.ts 의 isBlockedBlogHost 를 **그대로 재사용**한다.
 * 크롤 필터와 데이터 정리가 다른 규칙을 쓰면 한쪽만 고쳐도 계속 어긋난다.
 *
 * 삭제가 아니라 is_active 플래그만 내리므로 언제든 --restore 로 되돌릴 수 있다.
 */
import { config } from "dotenv";
import { getAdminClient } from "../lib/supabase/admin";
import { isBlockedBlogHost } from "../lib/ingest/naver/blogSearch";
import { selectAll } from "../lib/ingest/storageAudit";

config({ path: ".env.local" });
config();

interface Row {
  id: string;
  blog_url: string;
  title: string;
  is_active: boolean;
}

async function main() {
  const argv = process.argv.slice(2);
  const apply = argv.includes("--apply");
  const restore = argv.includes("--restore");
  const supabase = getAdminClient();

  const rows = await selectAll<Row>(
    supabase,
    "sauna_blog_reviews",
    "id, blog_url, title, is_active",
  );
  // 숨김 대상 = 디렉터리 도메인 & 아직 활성 / 복구 대상 = 디렉터리 도메인 & 비활성
  const targets = rows.filter(
    (r) => isBlockedBlogHost(r.blog_url) && r.is_active === !restore,
  );

  const host = (u: string) => {
    try {
      return new URL(u).hostname.replace(/^www\./, "");
    } catch {
      return "?";
    }
  };
  const byHost = new Map<string, number>();
  for (const r of targets) byHost.set(host(r.blog_url), (byHost.get(host(r.blog_url)) ?? 0) + 1);

  console.log(
    `\n${restore ? "복구" : "숨김"} 대상 ${targets.length}건${apply ? "" : "  (드라이런 — 반영하려면 --apply)"}`,
  );
  for (const [h, n] of [...byHost].sort((a, b) => b[1] - a[1]))
    console.log(`  ${h.padEnd(24)} ${n}건`);
  for (const r of targets.slice(0, 3))
    console.log(`   예: ${r.title.slice(0, 55)}`);

  if (!apply || !targets.length) return;

  // id 배열을 나눠서 update(URL 길이 제한 회피)
  const CHUNK = 200;
  let done = 0;
  for (let i = 0; i < targets.length; i += CHUNK) {
    const ids = targets.slice(i, i + CHUNK).map((r) => r.id);
    const { error } = await supabase
      .from("sauna_blog_reviews")
      .update({ is_active: restore })
      .in("id", ids);
    if (error) throw new Error(`업데이트 실패: ${error.message}`);
    done += ids.length;
    process.stdout.write(`\r  처리 ${done}/${targets.length}   `);
  }
  process.stdout.write("\n");
  console.log(`완료 — ${done}건 ${restore ? "복구" : "숨김"}\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
