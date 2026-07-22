/**
 * Storage 사용량 감사 — 무엇이 용량을 먹고 있는지 실측한다(읽기 전용).
 *
 *   pnpm audit:storage
 *
 * 고아 판정 로직은 lib/ingest/storageAudit.ts 에 있고 정리 스크립트와 공유한다.
 * 정리(삭제·축소)는 pnpm cleanup:storage 참고.
 */
import { config } from "dotenv";
import { getAdminClient } from "../lib/supabase/admin";
import {
  walkBucket,
  collectRefs,
  classify,
  selectAll,
  mb,
} from "../lib/ingest/storageAudit";

config({ path: ".env.local" });
config();

async function main() {
  const supabase = getAdminClient();

  console.log("1) Storage 객체 스캔…");
  const objects = await walkBucket(supabase, (scanned, pending, found) => {
    process.stdout.write(
      `\r  폴더 ${scanned} / 대기 ${pending} / 객체 ${found}   `,
    );
  });
  process.stdout.write("\n");
  const totalBytes = objects.reduce((a, o) => a + o.size, 0);

  console.log("2) DB 참조 수집…");
  const refs = await collectRefs(supabase);

  console.log(`\n${"=".repeat(58)}`);
  console.log(`총 용량   ${mb(totalBytes)} MB  /  객체 ${objects.length}개`);
  console.log(
    `평균 크기 ${objects.length ? Math.round(totalBytes / objects.length / 1024) : 0} KB`,
  );
  console.log("=".repeat(58));

  // 출처별 점유
  const byKind = new Map<string, { n: number; bytes: number }>();
  for (const o of objects) {
    const k = classify(o.path);
    const cur = byKind.get(k) ?? { n: 0, bytes: 0 };
    cur.n++;
    cur.bytes += o.size;
    byKind.set(k, cur);
  }
  console.log("\n[출처별 점유]");
  for (const [k, v] of [...byKind].sort((a, b) => b[1].bytes - a[1].bytes)) {
    const pct = totalBytes ? ((v.bytes / totalBytes) * 100).toFixed(1) : "0.0";
    const avgKb = Math.round(v.bytes / v.n / 1024);
    console.log(
      `  ${k.padEnd(26)} ${mb(v.bytes).padStart(8)} MB  ${String(v.n).padStart(6)}개  ${pct.padStart(5)}%  평균 ${avgKb}KB`,
    );
  }

  // 정리 가능 후보
  let orphanN = 0,
    orphanBytes = 0,
    inactiveN = 0,
    inactiveBytes = 0;
  for (const o of objects) {
    if (!refs.all.has(o.path)) {
      orphanN++;
      orphanBytes += o.size;
    } else if (!refs.active.has(o.path)) {
      inactiveN++;
      inactiveBytes += o.size;
    }
  }
  console.log("\n[정리 가능 후보]");
  console.log(
    `  참조 없음(고아)      ${mb(orphanBytes).padStart(8)} MB  ${String(orphanN).padStart(6)}개`,
  );
  console.log(
    `  비활성 행만 참조     ${mb(inactiveBytes).padStart(8)} MB  ${String(inactiveN).padStart(6)}개`,
  );

  // 깨진 이미지
  const objSet = new Set(objects.map((o) => o.path));
  const missing = [...refs.active].filter((p) => !objSet.has(p));
  console.log(
    `  객체 없는 활성 참조  ${String(missing.length).padStart(6)}개 (깨진 이미지)`,
  );

  // 매장당 활성 갤러리 사진 수
  const photos = await selectAll<{ sauna_id: string; is_active: boolean }>(
    supabase,
    "sauna_photos",
    "sauna_id, is_active",
  );
  const perSauna = new Map<string, number>();
  for (const p of photos) {
    if (!p.is_active) continue;
    perSauna.set(p.sauna_id, (perSauna.get(p.sauna_id) ?? 0) + 1);
  }
  const counts = [...perSauna.values()].sort((a, b) => a - b);
  const pick = (q: number) => counts[Math.floor((counts.length - 1) * q)] ?? 0;
  console.log("\n[매장당 활성 갤러리 사진]");
  console.log(
    `  매장 ${perSauna.size}곳 / 활성 행 ${counts.reduce((a, b) => a + b, 0)}개`,
  );
  console.log(
    `  중앙값 ${pick(0.5)}  p90 ${pick(0.9)}  p99 ${pick(0.99)}  최대 ${counts.at(-1) ?? 0}`,
  );

  console.log(`\n  (블로그 썸네일 참조 ${refs.blogThumbCount}개 포함해 대조함)`);
  console.log(
    `\n무료 한도 1GB 대비: ${((totalBytes / (1024 * 1024 * 1024)) * 100).toFixed(1)}%\n`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
