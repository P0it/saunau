/**
 * 블로그 후기 썸네일 백필 — thumb_url 이 비어있는 행만 채운다.
 *
 *   pnpm backfill:thumbs                  # 드라이런(기본) — 앞 10건만 시도, 쓰기 없음
 *   pnpm backfill:thumbs --apply          # 전체 반영
 *   pnpm backfill:thumbs --apply --limit 50
 *
 * 왜 crawl:naver --refresh 대신 이걸 쓰나:
 *   --refresh 는 "수집이 오래된 매장" 기준으로 대상을 고른다(crawl-naver.ts 참고).
 *   비어있는 몇백 행을 채우자고 매장 수천 곳을 다시 긁을 이유가 없다.
 *   여기선 빈 행의 blog_url 만 직접 열어 og:image 를 받으므로 검색 API 쿼터도 안 쓴다.
 *
 * 빈 행이 생긴 원인(saveBlogReviews 가 thumb_url 을 null 로 덮어쓰던 문제)은
 * 이미 store.ts 에서 고쳤다. 이 스크립트는 그 이전에 지워진 값을 복구하는 용도다.
 */
import { config } from "dotenv";
import { getAdminClient } from "../lib/supabase/admin";
import { fetchOgImage } from "../lib/ingest/naver/blogThumb";
import { downloadToStorage, blogThumbKey } from "../lib/ingest/naver/store";

config({ path: ".env.local" });
config();

const SLEEP_MS = 250; // 블로그 페이지 연속 요청 간격(과도한 부하 금지)
const DRY_SAMPLE = 10; // 드라이런에서 시도해볼 건수

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Row {
  id: string;
  sauna_id: string;
  blog_url: string;
  title: string;
}

async function main() {
  const argv = process.argv.slice(2);
  const apply = argv.includes("--apply");
  const li = argv.indexOf("--limit");
  const limit = li !== -1 && argv[li + 1] ? Number(argv[li + 1]) : null;

  const supabase = getAdminClient();

  const { data, error } = await supabase
    .from("sauna_blog_reviews")
    .select("id, sauna_id, blog_url, title")
    .is("thumb_url", null)
    .eq("is_active", true);
  if (error) throw new Error(`조회 실패: ${error.message}`);

  let rows = (data ?? []) as Row[];
  console.log(`썸네일 비어있는 후기 ${rows.length}건`);
  if (limit) rows = rows.slice(0, limit);
  if (!apply) {
    rows = rows.slice(0, DRY_SAMPLE);
    console.log(
      `※ 드라이런 — 앞 ${rows.length}건만 og:image 를 확인하고 저장은 하지 않습니다.`,
    );
    console.log("  실제 반영은 --apply 를 붙이세요.\n");
  } else {
    console.log(`대상 ${rows.length}건 처리\n`);
  }

  let ok = 0,
    noOg = 0,
    failed = 0;

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const label = r.title.slice(0, 32);

    const og = await fetchOgImage(r.blog_url);
    if (!og) {
      noOg++;
      console.log(`  [${i + 1}/${rows.length}] og:image 없음  ${label}`);
      await sleep(SLEEP_MS);
      continue;
    }
    if (!apply) {
      ok++;
      console.log(`  [${i + 1}/${rows.length}] og:image 있음  ${label}`);
      await sleep(SLEEP_MS);
      continue;
    }

    // 글 URL 해시 키 + thumb 규격(160px)으로 저장 — 인덱스 키를 쓰지 않는다.
    const sp = await downloadToStorage(
      supabase,
      r.sauna_id,
      blogThumbKey(r.blog_url),
      { sourceUrl: og },
      "thumb",
    );
    if (!sp) {
      failed++;
      console.log(`  [${i + 1}/${rows.length}] 저장 실패    ${label}`);
      await sleep(SLEEP_MS);
      continue;
    }

    const { error: upErr } = await supabase
      .from("sauna_blog_reviews")
      .update({ thumb_url: sp.url })
      .eq("id", r.id);
    if (upErr) {
      failed++;
      console.log(`  [${i + 1}/${rows.length}] DB 갱신 실패 ${label}`);
    } else {
      ok++;
      console.log(`  [${i + 1}/${rows.length}] ✓ ${label}`);
    }
    await sleep(SLEEP_MS);
  }

  console.log(
    `\n완료 — 성공 ${ok} · og:image 없음 ${noOg} · 실패 ${failed}${apply ? "" : "  (드라이런)"}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
