/**
 * 구글 사진 정리 — 네이버 업체제공 사진으로 대체된 매장의 google 사진 행을 걷어낸다.
 *
 *   pnpm prune:google-photos                    # 드라이런(기본) — 계획만 출력
 *   pnpm prune:google-photos --apply
 *   pnpm prune:google-photos --risky            # + 오매칭 위험군까지 대상에 포함(드라이런)
 *   pnpm prune:google-photos --risky --apply
 *
 * 왜 필요한가:
 *   crawl:naver-photos 는 네이버 사진을 **추가**하고 대표 썸네일만 바꾼다. 기존 google 행은
 *   그대로 남아 상세 갤러리에 계속 노출된다 — 대표 이미지는 사우나로 바뀌었는데 갤러리를
 *   열면 카페 사진이 같이 나오는 상태다. 그래서 대체가 끝난 매장은 google 행을 지운다.
 *
 * Storage 객체는 여기서 지우지 않는다(행만 삭제). 고아가 된 객체는 기존 경로로 회수한다:
 *   pnpm cleanup:storage --gc --apply
 *
 * --risky (opt-in):
 *   네이버 업체사진이 없어 대체가 안 된 매장 중, **상호에 목욕 관련 낱말이 전혀 없는** 곳의
 *   google 사진까지 지운다. 구글 텍스트검색이 동명의 카페·식당을 물어온 위험군이다
 *   (실측: "나인"=카페 커피 사진, "마루"·"여유"·"청담"·"해빗"…).
 *   ⚠ 남은 google 사진은 **검증할 방법이 없다** — 검증하려면 유료 API 재호출이 필요한데
 *     2026-08 에 사용 중지했다. 그래서 이건 이름 기반 휴리스틱이고, 멀쩡한 사진도 일부
 *     같이 지워진다. 틀린 사진을 노출하는 것보다 낫다는 판단이 설 때만 쓸 것.
 *
 * 삭제는 되돌릴 수 없다. --apply 없이 먼저 계획을 확인할 것.
 */
import { config } from "dotenv";
import { getAdminClient } from "../lib/supabase/admin";

config({ path: ".env.local" });
config();

const flag = (name: string) => process.argv.includes(`--${name}`);

/** 상호에 목욕 관련 낱말이 있으면 구글 텍스트검색이 엉뚱한 업소를 물 확률이 크게 낮다. */
const BATH_WORD_RE =
  /사우나|목욕|찜질|한증|불가마|숯가마|맥반석|온천|스파|탕|sauna|spa|세신|해수|워터|찜|사우나/i;

interface PhotoRow {
  id: string;
  sauna_id: string;
  source: string;
}

// PostgREST 는 응답을 1,000행에서 자른다 → range() 로 끝까지 훑는다.
// supabase 쿼리빌더는 Promise 가 아니라 thenable 이라 PromiseLike 로 받는다.
async function pageAll<T>(
  run: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await run(from, from + 999);
    if (error) throw error;
    out.push(...((data ?? []) as T[]));
    if (!data || data.length < 1000) break;
  }
  return out;
}

async function main() {
  const apply = flag("apply");
  const risky = flag("risky");
  const supabase = getAdminClient();

  console.log("1) 사진 행 스캔…");
  const photos = await pageAll<PhotoRow>((from, to) =>
    supabase.from("sauna_photos").select("id, sauna_id, source").order("id").range(from, to),
  );
  const googleBySauna = new Map<string, string[]>();
  const naverSaunas = new Set<string>();
  for (const p of photos) {
    if (p.source === "google") {
      const arr = googleBySauna.get(p.sauna_id) ?? [];
      arr.push(p.id);
      googleBySauna.set(p.sauna_id, arr);
    } else if (p.source === "naver_crawl") {
      naverSaunas.add(p.sauna_id);
    }
  }
  console.log(`   google 사진 보유 매장 ${googleBySauna.size} · naver 사진 보유 매장 ${naverSaunas.size}`);

  console.log("2) 매장 조회…");
  const saunas = await pageAll<{
    id: string;
    name: string;
    sigungu: string | null;
    thumbnail_url: string | null;
    thumbnail_source: string | null;
  }>((from, to) =>
    supabase
      .from("saunas")
      .select("id, name, sigungu, thumbnail_url, thumbnail_source")
      .order("id")
      .range(from, to),
  );
  const byId = new Map(saunas.map((s) => [s.id, s]));

  // 대체 완료분: 네이버 사진이 들어온 매장의 google 행.
  const replaced: string[] = [];
  // 위험군: 네이버 대체 없음 + 상호에 목욕 낱말 없음.
  const riskyIds: string[] = [];
  for (const [saunaId] of googleBySauna) {
    const s = byId.get(saunaId);
    if (!s) continue;
    if (naverSaunas.has(saunaId)) replaced.push(saunaId);
    else if (!BATH_WORD_RE.test(s.name)) riskyIds.push(saunaId);
  }

  const targets = risky ? [...replaced, ...riskyIds] : replaced;
  const rowIds = targets.flatMap((id) => googleBySauna.get(id) ?? []);

  console.log(`\n=== 대상 ===`);
  console.log(`  대체 완료(네이버 사진 있음)   매장 ${replaced.length}`);
  console.log(`  오매칭 위험군(--risky)        매장 ${riskyIds.length}${risky ? " ← 포함" : " ← 제외(기본)"}`);
  console.log(`  삭제할 sauna_photos 행        ${rowIds.length}`);

  // 썸네일이 아직 google 을 가리키면 재지정이 필요하다(안 하면 깨진 이미지가 된다).
  const needRepoint = targets
    .map((id) => byId.get(id)!)
    .filter((s) => s && s.thumbnail_source === "google");
  console.log(`  썸네일 재지정 필요            ${needRepoint.length}`);

  if (risky && riskyIds.length) {
    console.log(`\n--- 위험군 샘플(최대 25) ---`);
    for (const id of riskyIds.slice(0, 25)) {
      const s = byId.get(id)!;
      console.log(`  ${s.sigungu ?? ""} ${s.name}`);
    }
  }

  if (!apply) {
    console.log(`\n드라이런입니다. 실제로 지우려면 --apply 를 붙이세요.`);
    console.log(`삭제 후 Storage 회수:  pnpm cleanup:storage --gc --apply`);
    return;
  }

  console.log(`\n3) 썸네일 재지정…`);
  let repointed = 0;
  let cleared = 0;
  for (const s of needRepoint) {
    // 네이버 사진이 있으면 그 첫 장으로, 없으면(위험군) 썸네일을 비운다.
    const { data: nv } = await supabase
      .from("sauna_photos")
      .select("url")
      .eq("sauna_id", s.id)
      .eq("source", "naver_crawl")
      .order("sort_order")
      .limit(1);
    const url = nv?.[0]?.url as string | undefined;
    const { error } = await supabase
      .from("saunas")
      .update(
        url
          ? { thumbnail_url: url, thumbnail_source: "naver_crawl" }
          : { thumbnail_url: null, thumbnail_source: null },
      )
      .eq("id", s.id);
    if (error) throw new Error(`썸네일 재지정 실패(${s.name}): ${error.message}`);
    if (url) repointed++;
    else cleared++;
  }
  console.log(`   네이버 사진으로 재지정 ${repointed} · 썸네일 비움 ${cleared}`);

  console.log(`4) google 사진 행 삭제…`);
  let deleted = 0;
  for (let i = 0; i < rowIds.length; i += 200) {
    const chunk = rowIds.slice(i, i + 200);
    const { error } = await supabase.from("sauna_photos").delete().in("id", chunk);
    if (error) throw new Error(`사진 행 삭제 실패: ${error.message}`);
    deleted += chunk.length;
    process.stdout.write(`\r   ${deleted}/${rowIds.length}   `);
  }
  console.log(`\n\n=== 완료 ===`);
  console.log(`  삭제한 사진 행 ${deleted} · 썸네일 재지정 ${repointed} · 썸네일 비움 ${cleared}`);
  console.log(`  Storage 객체 회수:  pnpm cleanup:storage --gc --apply`);
}

main().catch((e) => {
  console.error("prune:google-photos 실패:", e);
  process.exit(1);
});
