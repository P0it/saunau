/**
 * 행정구역 통합으로 생긴 중복 매장 병합.  수동/일회성.
 *
 *   pnpm merge:dupes                    # 드라이런(기본) — 계획만 출력
 *   pnpm merge:dupes -- --limit 20 --apply
 *   pnpm merge:dupes -- --apply
 *
 * 왜 필요한가:
 *   전남·광주 행정통합으로 같은 매장이 `전남광주통합특별시` 와 구 시도명(`전라남도`·
 *   `광주광역시`) 두 벌로 들어와 있다(540쌍). 목록·지도에 같은 가게가 두 번 나온다.
 *   양쪽에 데이터가 나뉘어 쌓여서(placeId 333 vs 338, 썸네일 164 vs 190) 한쪽을
 *   통째로 지우면 반대쪽에만 있는 값이 날아간다 — 그래서 **병합**한다.
 *
 * 병합 규칙:
 *   남길 쪽(keep) = `전남광주통합특별시` 레코드(현행 행정구역명).
 *   1) keep 의 빈 컬럼을 drop 값으로 채운다(비어있을 때만 — keep 값을 덮지 않는다).
 *   2) 자식 행(사진·후기·찜·메모·방문…)을 keep 으로 옮긴다. 유니크 충돌분은 버린다.
 *   3) 사진은 source_url 이 겹치면 버린다(양쪽이 같은 네이버 플레이스를 긁은 경우).
 *   4) drop 레코드 삭제(자식은 cascade).
 *
 * ⚠ 썸네일 주의: cleanup:storage 의 GC 는 `sauna_photos.storage_path` 와 블로그
 *   썸네일만 참조로 센다 — `saunas.thumbnail_url` 은 안 본다(lib/ingest/storageAudit.ts).
 *   그래서 썸네일을 그냥 복사해 두면, 그 객체를 받치던 사진 행이 중복으로 지워졌을 때
 *   다음 GC 에서 객체가 삭제돼 이미지가 깨진다. **살아남은 사진 행에서 다시 고른다.**
 *
 * 삭제는 되돌릴 수 없다. --apply 없이 먼저 계획을 확인할 것.
 */
import { config } from "dotenv";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAdminClient } from "../lib/supabase/admin";

config({ path: ".env.local" });
config();

const flag = (name: string) => process.argv.includes(`--${name}`);
function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? (process.argv[i + 1] ?? "") : undefined;
}

const MERGED_SIDO = "전남광주통합특별시";
const OLD_SIDO_RE = /^(전라남도|광주광역시)$/;

type Row = Record<string, unknown> & { id: string };

/** PostgREST 는 응답을 1,000행에서 자른다 → range 로 끝까지 훑는다. */
async function pageAll<T>(
  // PostgREST 빌더의 응답 타입은 select() 문자열에 따라 매번 달라진다(동적 cols 면
  // GenericStringError). 여기서는 행 모양을 호출자가 <T> 로 단언하므로 data 는 unknown 으로 받는다.
  run: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: unknown; error: { message: string } | null }>,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await run(from, from + 999);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < 1000) break;
  }
  return out;
}

function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

const norm = (s: string) => s.replace(/[\s()（）·・,，.\-_]/g, "").toLowerCase();

/** 시도명을 뗀 주소 — 통합 전/후 표기 차이를 흡수한다. */
const addrKey = (r: Row) =>
  norm(
    String(r.address ?? "").replace(
      /^(전남광주통합특별시|전라남도|광주광역시)\s*/,
      "",
    ),
  );
const groupKey = (r: Row) => `${norm(String(r.name ?? ""))}|${addrKey(r)}`;

/**
 * 채우지 않을 컬럼.
 *  - 주소·시도: keep(통합 행정구역명) 쪽이 정답이다.
 *  - 썸네일: 살아남은 사진 행에서 따로 고른다(위 주석 참고).
 *  - favorite_count: 트리거 집계값이라 손대지 않는다.
 */
const SKIP_FILL = new Set([
  "id",
  "created_at",
  "updated_at",
  "sido",
  "sigungu",
  "address",
  "favorite_count",
  "thumbnail_url",
  "thumbnail_source",
]);

/** keep 의 빈 칸을 drop 값으로 채운다. 값이 있는 칸은 건드리지 않는다. */
function buildFill(keep: Row, drop: Row): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(keep)) {
    if (SKIP_FILL.has(k)) continue;
    const dv = drop[k];
    const keepEmpty = v === null || v === undefined || v === "";
    const dropHas = dv !== null && dv !== undefined && dv !== "";
    if (keepEmpty && dropHas) patch[k] = dv;
  }
  return patch;
}

interface ChildSpec {
  table: string;
  /** 유니크 키(sauna_id 제외). keep 쪽에 같은 키가 이미 있으면 drop 행은 버린다. */
  uniq: string[] | null;
  cols: string;
  /** 행 지정용 키(삭제·업데이트 where 절). */
  pk: string[];
}

const CHILDREN: ChildSpec[] = [
  {
    table: "sauna_photos",
    uniq: ["source_url"],
    cols: "id, sauna_id, source_url",
    pk: ["id"],
  },
  {
    table: "sauna_blog_reviews",
    uniq: ["blog_url"],
    cols: "id, sauna_id, blog_url",
    pk: ["id"],
  },
  {
    table: "sauna_reviews",
    uniq: ["user_id"],
    cols: "id, sauna_id, user_id",
    pk: ["id"],
  },
  {
    table: "sauna_temp_reports",
    uniq: ["user_id"],
    cols: "id, sauna_id, user_id",
    pk: ["id"],
  },
  {
    table: "sauna_favorites",
    uniq: ["user_id"],
    cols: "sauna_id, user_id",
    pk: ["sauna_id", "user_id"],
  },
  {
    table: "sauna_memos",
    uniq: ["user_id"],
    cols: "sauna_id, user_id",
    pk: ["sauna_id", "user_id"],
  },
  {
    table: "collection_saunas",
    uniq: ["collection_id"],
    cols: "sauna_id, collection_id",
    pk: ["sauna_id", "collection_id"],
  },
  { table: "visits", uniq: null, cols: "id, sauna_id", pk: ["id"] },
];

interface Plan {
  spec: ChildSpec;
  move: Row[];
  discard: Row[];
}

async function main() {
  const apply = flag("apply");
  const limit = Number(arg("limit") ?? "0");
  const sb = getAdminClient();

  console.log("1) 매장 스캔…");
  const rows = await pageAll<Row>((from, to) =>
    sb.from("saunas").select("*").order("id").range(from, to),
  );
  console.log(`   전체 ${rows.length}행`);

  const groups = new Map<string, Row[]>();
  for (const r of rows) {
    const k = groupKey(r);
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }

  // 통합시도 ↔ 구시도 쌍만 대상. 그 외 동명 그룹은 건드리지 않는다.
  const pairs: Array<{ keep: Row; drop: Row }> = [];
  for (const g of groups.values()) {
    if (g.length < 2) continue;
    const keep = g.find((r) => r.sido === MERGED_SIDO);
    const drops = g.filter((r) => OLD_SIDO_RE.test(String(r.sido ?? "")));
    if (!keep || !drops.length) continue;
    for (const drop of drops) pairs.push({ keep, drop });
  }
  const targets = limit > 0 ? pairs.slice(0, limit) : pairs;
  console.log(
    `   병합 대상 ${pairs.length}쌍${limit > 0 ? ` (이번 실행 ${targets.length}쌍)` : ""}`,
  );
  if (!targets.length) return;

  const keepByDrop = new Map(targets.map((p) => [p.drop.id, p.keep.id]));
  const dropIds = targets.map((p) => p.drop.id);
  const keepIds = [...new Set(targets.map((p) => p.keep.id))];

  // 2) 컬럼 채움 계획
  const fills = targets
    .map((p) => ({
      id: p.keep.id,
      name: String(p.keep.name),
      patch: buildFill(p.keep, p.drop),
    }))
    .filter((f) => Object.keys(f.patch).length > 0);
  const fillCols = new Map<string, number>();
  for (const f of fills) {
    for (const k of Object.keys(f.patch)) {
      fillCols.set(k, (fillCols.get(k) ?? 0) + 1);
    }
  }
  console.log(`\n2) 빈 칸 채움 — ${fills.length}쌍`);
  for (const [k, n] of [...fillCols.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`     ${k.padEnd(26)} ${n}`);
  }

  // 3) 자식 행 이동/폐기 계획
  const plans: Plan[] = [];
  for (const spec of CHILDREN) {
    const dropRows: Row[] = [];
    for (const ids of chunk(dropIds, 150)) {
      dropRows.push(
        ...(await pageAll<Row>((from, to) =>
          sb
            .from(spec.table)
            .select(spec.cols)
            .in("sauna_id", ids)
            .order("sauna_id")
            .range(from, to),
        )),
      );
    }
    const keepKeys = new Set<string>();
    if (spec.uniq && dropRows.length) {
      const keepRows: Row[] = [];
      for (const ids of chunk(keepIds, 150)) {
        keepRows.push(
          ...(await pageAll<Row>((from, to) =>
            sb
              .from(spec.table)
              .select(spec.cols)
              .in("sauna_id", ids)
              .order("sauna_id")
              .range(from, to),
          )),
        );
      }
      for (const r of keepRows) {
        keepKeys.add(
          [String(r.sauna_id), ...spec.uniq.map((c) => String(r[c] ?? ""))].join("|"),
        );
      }
    }

    const move: Row[] = [];
    const discard: Row[] = [];
    const seen = new Set(keepKeys);
    for (const r of dropRows) {
      if (!spec.uniq) {
        move.push(r);
        continue;
      }
      const target = keepByDrop.get(String(r.sauna_id));
      if (!target) continue;
      // 키 값이 비어 있으면 중복 판정이 불가능하다 → 그냥 옮긴다.
      const hasKey = spec.uniq.every(
        (c) => r[c] !== null && r[c] !== undefined && r[c] !== "",
      );
      const key = [target, ...spec.uniq.map((c) => String(r[c] ?? ""))].join("|");
      if (hasKey && seen.has(key)) {
        discard.push(r);
      } else {
        move.push(r);
        if (hasKey) seen.add(key);
      }
    }
    plans.push({ spec, move, discard });
  }

  console.log(`\n3) 자식 행 이동`);
  for (const p of plans) {
    if (!p.move.length && !p.discard.length) continue;
    console.log(
      `     ${p.spec.table.padEnd(22)} 이동 ${p.move.length}  중복폐기 ${p.discard.length}`,
    );
  }
  console.log(`\n4) drop 레코드 삭제 ${dropIds.length}건`);

  if (!apply) {
    console.log(`\n드라이런입니다. 실제로 반영하려면 --apply 를 붙이세요.`);
    return;
  }

  // ── 실행 ──────────────────────────────────────────────────────────────
  console.log(`\n[적용] 빈 칸 채움…`);
  let filled = 0;
  for (const f of fills) {
    const { error } = await sb.from("saunas").update(f.patch).eq("id", f.id);
    if (error) throw new Error(`채움 실패(${f.name}): ${error.message}`);
    filled++;
    if (filled % 50 === 0) {
      process.stdout.write(`\r   ${filled}/${fills.length}   `);
    }
  }
  console.log(`\r   ${filled}/${fills.length} 완료`);

  console.log(`[적용] 자식 행 이동…`);
  for (const p of plans) {
    for (const r of p.move) {
      const target = keepByDrop.get(String(r.sauna_id));
      if (!target) continue;
      let q = sb.from(p.spec.table).update({ sauna_id: target });
      for (const k of p.spec.pk) q = q.eq(k, r[k] as string);
      const { error } = await q;
      if (error) throw new Error(`${p.spec.table} 이동 실패: ${error.message}`);
    }
    for (const r of p.discard) {
      let q = sb.from(p.spec.table).delete();
      for (const k of p.spec.pk) q = q.eq(k, r[k] as string);
      const { error } = await q;
      if (error) throw new Error(`${p.spec.table} 폐기 실패: ${error.message}`);
    }
    if (p.move.length || p.discard.length) {
      console.log(
        `   ${p.spec.table}  이동 ${p.move.length} · 폐기 ${p.discard.length}`,
      );
    }
  }

  console.log(`[적용] drop 레코드 삭제…`);
  let deleted = 0;
  for (const ids of chunk(dropIds, 100)) {
    const { error } = await sb.from("saunas").delete().in("id", ids);
    if (error) throw new Error(`삭제 실패: ${error.message}`);
    deleted += ids.length;
    process.stdout.write(`\r   ${deleted}/${dropIds.length}   `);
  }
  console.log(`\r   ${deleted}/${dropIds.length} 완료`);

  console.log(`[적용] 썸네일 재지정…`);
  await repointThumbs(sb, keepIds);

  console.log(`\n=== 병합 완료 ===`);
  console.log(`  병합 ${targets.length}쌍 · 빈칸 채움 ${filled} · 삭제 ${deleted}`);
}

/**
 * keep 매장의 썸네일이 비었거나 **사라진 사진 행**을 가리키면 살아있는 사진에서 다시 고른다.
 * (GC 가 thumbnail_url 을 참조로 세지 않아, 방치하면 다음 GC 때 객체가 지워진다.)
 */
async function repointThumbs(sb: SupabaseClient, keepIds: string[]) {
  const PRIORITY = ["naver_crawl", "owner", "editor", "licensed", "google"];
  const rank = (r: Row) => {
    const i = PRIORITY.indexOf(String(r.source));
    return i < 0 ? PRIORITY.length : i;
  };

  let set = 0;
  for (const ids of chunk(keepIds, 150)) {
    const photos = await pageAll<Row>((from, to) =>
      sb
        .from("sauna_photos")
        .select("sauna_id, url, source, sort_order, is_active")
        .in("sauna_id", ids)
        .order("sauna_id")
        .range(from, to),
    );
    const best = new Map<string, Row>();
    for (const p of photos) {
      if (p.is_active === false) continue;
      const sid = String(p.sauna_id);
      const cur = best.get(sid);
      if (
        !cur ||
        rank(p) < rank(cur) ||
        (rank(p) === rank(cur) && Number(p.sort_order) < Number(cur.sort_order))
      ) {
        best.set(sid, p);
      }
    }

    const saunas = await pageAll<Row>((from, to) =>
      sb
        .from("saunas")
        .select("id, thumbnail_url, thumbnail_source")
        .in("id", ids)
        .order("id")
        .range(from, to),
    );
    const liveUrls = new Set(photos.map((p) => String(p.url)));

    for (const s of saunas) {
      const cur = s.thumbnail_url ? String(s.thumbnail_url) : null;
      if (cur && liveUrls.has(cur)) continue; // 살아있는 사진을 가리킨다 — 그대로 둔다
      const b = best.get(s.id);
      if (!b && !cur) continue; // 사진도 썸네일도 없다 — 할 일 없음
      const patch = b
        ? { thumbnail_url: String(b.url), thumbnail_source: String(b.source) }
        : { thumbnail_url: null, thumbnail_source: null };
      const { error } = await sb.from("saunas").update(patch).eq("id", s.id);
      if (error) throw new Error(`썸네일 재지정 실패: ${error.message}`);
      set++;
    }
  }
  console.log(`   재지정 ${set}건`);
}

main().catch((e) => {
  console.error("merge:dupes 실패:", e);
  process.exit(1);
});
