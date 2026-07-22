/**
 * Storage 정리 — 고아 객체 삭제 + 블로그 썸네일 축소 재인코딩.
 *
 *   pnpm cleanup:storage                # 드라이런(기본) — 아무것도 바꾸지 않고 계획만 출력
 *   pnpm cleanup:storage --apply        # 실제 실행
 *   pnpm cleanup:storage --gc --apply   # 고아 삭제만
 *   pnpm cleanup:storage --shrink --apply --limit 200
 *
 * 왜 필요한가:
 *  1) 고아 — 사진 행이 지워져도 Storage 객체는 남긴다(app/api/photos 주석 참고).
 *     블로그 후기 수가 줄면 blog-N.webp 도 남는다. 아무도 참조하지 않는 이 객체들을 회수한다.
 *  2) 축소 — 블로그 썸네일은 64px 로만 렌더되는데(components/sauna/BlogReviews.tsx)
 *     과거 갤러리와 같은 720px 로 저장됐다. 경로를 그대로 두고 바이트만 바꾸므로
 *     DB(thumb_url)는 건드릴 필요가 없다.
 *
 * 삭제는 되돌릴 수 없다. --apply 없이 먼저 계획을 확인할 것.
 */
import { config } from "dotenv";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAdminClient } from "../lib/supabase/admin";
import { optimizeImage } from "../lib/ingest/naver/store";
import {
  BUCKET,
  walkBucket,
  collectRefs,
  isBlogThumb,
  mb,
  type ObjInfo,
} from "../lib/ingest/storageAudit";

config({ path: ".env.local" });
config();

const REMOVE_BATCH = 500; // storage.remove 한 번에 넘길 경로 수
const SHRINK_CONCURRENCY = 8;
const ALREADY_SMALL = 12 * 1024; // 이보다 작으면 이미 축소된 것으로 보고 건너뛴다(재실행 안전)

interface Args {
  apply: boolean;
  gc: boolean;
  shrink: boolean;
  limit: number | null;
}

function parseArgs(): Args {
  const a = process.argv.slice(2);
  const only = { gc: a.includes("--gc"), shrink: a.includes("--shrink") };
  const li = a.indexOf("--limit");
  return {
    apply: a.includes("--apply"),
    // 아무 것도 지정 안 하면 둘 다 수행
    gc: only.gc || !only.shrink,
    shrink: only.shrink || !only.gc,
    limit: li !== -1 && a[li + 1] ? Number(a[li + 1]) : null,
  };
}

/** 고아 객체 삭제. 반환: 삭제한 바이트 수. */
async function runGc(
  supabase: SupabaseClient,
  orphans: ObjInfo[],
  apply: boolean,
): Promise<number> {
  const bytes = orphans.reduce((a, o) => a + o.size, 0);
  console.log(
    `\n[고아 삭제] ${orphans.length}개 / ${mb(bytes)} MB${apply ? "" : "  (드라이런)"}`,
  );
  for (const o of orphans.slice(0, 5)) console.log(`   예: ${o.path}`);
  if (orphans.length > 5) console.log(`   … 외 ${orphans.length - 5}개`);
  if (!apply || !orphans.length) return 0;

  let done = 0;
  for (let i = 0; i < orphans.length; i += REMOVE_BATCH) {
    const batch = orphans.slice(i, i + REMOVE_BATCH);
    const { error } = await supabase.storage
      .from(BUCKET)
      .remove(batch.map((o) => o.path));
    if (error) throw new Error(`삭제 실패: ${error.message}`);
    done += batch.length;
    process.stdout.write(`\r   삭제 ${done}/${orphans.length}   `);
  }
  process.stdout.write("\n");
  return bytes;
}

/** 블로그 썸네일 축소 재인코딩(같은 경로에 덮어쓰기). 반환: 절감 바이트. */
async function runShrink(
  supabase: SupabaseClient,
  targets: ObjInfo[],
  apply: boolean,
): Promise<number> {
  const before = targets.reduce((a, o) => a + o.size, 0);
  console.log(
    `\n[썸네일 축소] ${targets.length}개 / 현재 ${mb(before)} MB${apply ? "" : "  (드라이런)"}`,
  );
  if (!targets.length) return 0;
  if (!apply) {
    // 표본으로 절감폭만 추정 — 바이트는 건드리지 않는다.
    const sample = targets.slice(0, 12);
    let so = 0,
      sn = 0;
    for (const t of sample) {
      const { data } = await supabase.storage.from(BUCKET).download(t.path);
      if (!data) continue;
      const buf = new Uint8Array(await data.arrayBuffer());
      const opt = await optimizeImage(buf, "thumb");
      if (!opt) continue;
      so += buf.byteLength;
      sn += opt.buf.byteLength;
    }
    const ratio = so ? sn / so : 1;
    console.log(
      `   표본 ${sample.length}장 기준 ${(ratio * 100).toFixed(1)}% 로 축소 → 예상 ${mb(before * (1 - ratio))} MB 절감`,
    );
    return 0;
  }

  let saved = 0,
    done = 0,
    failed = 0;
  for (let i = 0; i < targets.length; i += SHRINK_CONCURRENCY) {
    const batch = targets.slice(i, i + SHRINK_CONCURRENCY);
    const results = await Promise.all(
      batch.map(async (t) => {
        try {
          const { data } = await supabase.storage.from(BUCKET).download(t.path);
          if (!data) return 0;
          const buf = new Uint8Array(await data.arrayBuffer());
          const opt = await optimizeImage(buf, "thumb");
          // 이미 작으면(축소 효과 없음) 굳이 덮어쓰지 않는다.
          if (!opt || opt.buf.byteLength >= t.size) return 0;
          const { error } = await supabase.storage
            .from(BUCKET)
            .upload(t.path, opt.buf, {
              contentType: "image/webp",
              upsert: true, // 같은 경로 → thumb_url 그대로 유효
            });
          if (error) return null;
          return t.size - opt.buf.byteLength;
        } catch {
          return null;
        }
      }),
    );
    for (const r of results) {
      done++;
      if (r === null) failed++;
      else saved += r;
    }
    process.stdout.write(
      `\r   축소 ${done}/${targets.length}  절감 ${mb(saved)} MB  실패 ${failed}   `,
    );
  }
  process.stdout.write("\n");
  return saved;
}

async function main() {
  const args = parseArgs();
  const supabase = getAdminClient();

  if (!args.apply) {
    console.log("※ 드라이런입니다. 실제 반영은 --apply 를 붙이세요.\n");
  }

  console.log("Storage 스캔…");
  const objects = await walkBucket(supabase, (s, p, f) => {
    process.stdout.write(`\r  폴더 ${s} / 대기 ${p} / 객체 ${f}   `);
  });
  process.stdout.write("\n");
  const refs = await collectRefs(supabase);
  const totalBefore = objects.reduce((a, o) => a + o.size, 0);
  console.log(`현재 ${mb(totalBefore)} MB / ${objects.length}개`);

  const orphans = objects.filter((o) => !refs.all.has(o.path));
  // 축소 대상: 살아있는 블로그 썸네일 중 아직 큰 것. 고아는 어차피 지우니 제외.
  let shrinkTargets = objects.filter(
    (o) =>
      refs.all.has(o.path) && isBlogThumb(o.path) && o.size > ALREADY_SMALL,
  );
  if (args.limit) shrinkTargets = shrinkTargets.slice(0, args.limit);

  let freed = 0;
  if (args.gc) freed += await runGc(supabase, orphans, args.apply);
  if (args.shrink) freed += await runShrink(supabase, shrinkTargets, args.apply);

  if (args.apply) {
    const after = totalBefore - freed;
    console.log(
      `\n완료 — ${mb(totalBefore)} MB → 약 ${mb(after)} MB (${mb(freed)} MB 회수)`,
    );
    console.log("실제 반영치는 pnpm audit:storage 로 재확인하세요.\n");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
