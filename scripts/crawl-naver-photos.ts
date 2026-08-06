/**
 * 네이버 **업체제공 매장사진** 수집 + 매칭 검증.  수동/일회성. **무과금**(공식 유료 API 아님).
 *
 *   pnpm crawl:naver-photos -- --dry --limit 200      # 검증·수집예정만 출력(쓰기 X) ← 먼저 이걸로
 *   pnpm crawl:naver-photos -- --limit 200            # 실제 수집
 *   pnpm crawl:naver-photos -- --replace-google       # 구글 썸네일 매장 교체
 *   pnpm crawl:naver-photos -- --fill --limit 500     # 썸네일 없는 매장 채움
 *   pnpm crawl:naver-photos -- --retry-empty --limit 300   # 예전에 사진 0장이던 매장 재확인
 *   pnpm crawl:naver-photos -- --region 서울 --limit 100
 *   pnpm crawl:naver-photos -- --verify-only --limit 500   # 매칭 검증만(사진 수집 안 함)
 *
 * 왜 이 경로인가:
 *   국내 업소는 네이버 쪽 자료가 더 많고 정확하다. 무엇보다 네이버는 mediaSource="business"
 *   로 **업체제공 사진을 구분**해 준다 — 구글 Places 엔 업주 여부를 알 방법이 아예 없다.
 *   그래서 대표 썸네일은 네이버 업체사진을 쓰고, 없는 곳만 기존 구글 사진을 남긴다.
 *   (SOURCE_PRIORITY 에서 naver_crawl(2) > google(1) 이라 자동으로 교체된다.)
 *
 * 매칭 검증이 선결 조건인 이유:
 *   호텔 부속 사우나는 네이버에 독립 등록이 잘 안 돼 있어 같은 좌표·상호의 다른 업소
 *   (바·뷔페·중식당)가 naver_place_id 로 잡혀 있는 경우가 있다. 그대로 사진을 받으면
 *   사우나 자리에 호텔 바 사진이 들어간다. 업종(category)이 목욕 계열이 아니면 **수집을
 *   건너뛰고** 리포트에만 남긴다(자동 재매칭은 하지 않는다 — 사람이 보고 판단할 일).
 *
 * 출처 표기: 저장 시 우하단에 "출처 네이버 플레이스" 워터마크를 합성한다(store.ts).
 *
 * 사전: .env.local 의 SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY + 마이그레이션 0029.
 * 재개 가능: `naver_photo_checked_at` 이 있는 매장은 대상에서 빠진다(사진 0장이어도 마커를
 *   남기므로 빈 매장 재조회가 없다). 다시 보려면 --retry-empty, 전부 무시하려면 --force.
 */
import { config } from "dotenv";
import { getAdminClient } from "../lib/supabase/admin";
import {
  fetchPlaceHome,
  verifyCategory,
  type MatchVerdict,
} from "../lib/ingest/naver/placePhotos";
import {
  downloadToStorage,
  saveCrawledPhotos,
  setRepresentativeThumb,
} from "../lib/ingest/naver/store";

config({ path: ".env.local" });
config();

const WATERMARK = "출처 네이버 플레이스";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? (process.argv[i + 1] ?? "") : undefined;
}
const flag = (name: string) => process.argv.includes(`--${name}`);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * 요청 간격에 ±40% 흔들림을 준다. 2026-08-06 차단은 코드가 아니라 **속도** 때문이었다 —
 * 정확히 같은 간격으로 반복해 때리는 것 자체가 사람이 아니라는 신호다.
 */
const jitter = (ms: number) => Math.round(ms * (0.6 + Math.random() * 0.8));

/**
 * 차단/실패 시 백오프 후 재시도. `blocked` 는 진짜 차단과 일시적 5xx·네트워크 오류를
 * 구분하지 못하므로, 한 번 쉬었다 다시 물어보고 그래도 막히면 차단으로 본다.
 */
async function fetchWithBackoff(placeId: string, tries = 3) {
  let r = await fetchPlaceHome(placeId);
  for (let i = 1; i < tries && r.blocked; i++) {
    await sleep(jitter(4000 * 2 ** (i - 1))); // 4s → 8s
    r = await fetchPlaceHome(placeId);
  }
  return r;
}

interface Row {
  id: string;
  name: string;
  sigungu: string | null;
  naver_place_id: string;
  thumbnail_source: string | null;
}

async function main() {
  const limit = Number(arg("limit") ?? "100");
  const maxPhotos = Number(arg("photos") ?? "5");
  const sleepMs = Number(arg("sleep") ?? "1200");
  const region = arg("region");
  const dry = flag("dry");
  const force = flag("force");
  const verifyOnly = flag("verify-only");
  const replaceGoogle = flag("replace-google"); // 구글 썸네일 매장부터(교체)
  const fill = flag("fill"); // 썸네일 없는 매장만(신규 채움)
  // 업체사진이 0장이던 매장을 다시 확인한다(업체가 나중에 사진을 올렸을 수 있다).
  // 기본은 건너뛴다 — 안 그러면 실행할 때마다 같은 빈 매장을 되풀이해 긁는다.
  const retryEmpty = flag("retry-empty");
  // 연속 차단이 이만큼 이어지면 중단(네이버에 부담 주지 않기 위한 안전장치).
  const maxBlocks = Number(arg("max-blocks") ?? "8");

  const supabase = getAdminClient();

  // ⚠ PostgREST 는 응답을 1,000행에서 자른다 — .limit(N) 을 크게 줘도 소용없다.
  //    range() 로 페이지네이션하지 않으면 대상이 2,000곳이어도 1,000곳만 돌고 끝난다
  //    (실제로 첫 실행에서 이걸로 77곳이 누락됐다).
  const rows: Row[] = [];
  const want = limit * 3;
  for (let from = 0; rows.length < want; from += 1000) {
    let q = supabase
      .from("saunas")
      .select("id, name, sigungu, naver_place_id, thumbnail_source")
      .not("naver_place_id", "is", null)
      .eq("status", "영업/정상")
      .eq("needs_review", false)
      .order("id")
      .range(from, from + 999);
    if (region) q = q.like("sido", `${region}%`);
    if (replaceGoogle) q = q.eq("thumbnail_source", "google");
    if (fill) q = q.is("thumbnail_url", null);
    if (!retryEmpty && !force) q = q.is("naver_photo_checked_at", null);
    const { data, error } = await q;
    if (error) throw new Error(`대상 조회 실패: ${error.message}`);
    rows.push(...((data ?? []) as Row[]));
    if (!data || data.length < 1000) break;
  }

  // 프리플라이트 — 이미 차단 상태면 여기서 끝낸다. 안 그러면 수천 곳을 헛돌며 요청을
  // 쏟아부어 차단을 더 굳힌다(2026-08-06 에 이렇게 2,030곳을 날렸다).
  if (rows.length && !dry) {
    const probe = await fetchWithBackoff(rows[0].naver_place_id);
    if (probe.blocked) {
      console.error("⚠ 프리플라이트 차단 — 네이버가 지금 응답하지 않습니다. 나중에 다시 시도하세요.");
      process.exit(1);
    }
    console.log(`프리플라이트 OK (${rows[0].name}) — 대상 ${rows.length}곳`);
  }

  const summary = {
    targeted: 0,
    verifiedOk: 0,
    wrongCategory: 0,
    parentVenue: 0,
    unknownCategory: 0,
    blocked: 0,
    noBusinessPhoto: 0,
    photosStored: 0,
    thumbsReplaced: 0,
    skipped: 0,
    failed: 0,
  };
  const mismatches: string[] = [];

  let processed = 0;
  let blockStreak = 0;
  for (const s of rows) {
    if (processed >= limit) break;
    if (blockStreak >= maxBlocks) {
      console.warn(`⚠ 연속 차단 ${blockStreak}회 — 중단`);
      break;
    }

    // 재개: 이미 네이버 사진이 있으면 스킵
    if (!force && !verifyOnly) {
      const { count } = await supabase
        .from("sauna_photos")
        .select("id", { count: "exact", head: true })
        .eq("sauna_id", s.id)
        .eq("source", "naver_crawl");
      if ((count ?? 0) > 0) {
        summary.skipped++;
        continue;
      }
    }
    processed++;
    summary.targeted++;

    const { data: home, blocked } = await fetchWithBackoff(s.naver_place_id);
    if (blocked || !home) {
      summary.blocked++;
      blockStreak++;
      await sleep(jitter(sleepMs));
      continue;
    }
    blockStreak = 0;

    // 확인 마커 — **페이지를 열어본 이상 무조건 남긴다**(사진 0장이든 매칭이 틀렸든).
    // 이게 없으면 실행할 때마다 같은 빈 매장을 되풀이해 긁어 진전이 없고, 네이버에
    // 불필요한 요청을 보내다 차단당한다(2026-08-06 에 실제로 이렇게 막혔다).
    // 차단(blocked)은 확인한 게 아니므로 위에서 이미 continue — 마커를 남기지 않는다.
    const markChecked = async () => {
      if (dry || verifyOnly) return;
      await supabase
        .from("saunas")
        .update({ naver_photo_checked_at: new Date().toISOString() })
        .eq("id", s.id);
    };

    const verdict: MatchVerdict = verifyCategory(home.category, {
      ours: s.name,
      theirs: home.placeName,
    });
    if (verdict === "wrong_category") {
      summary.wrongCategory++;
      const line = `  ✗ ${s.sigungu ?? ""} ${s.name}  →  네이버 "${home.placeName ?? "?"}" [${home.category}]`;
      mismatches.push(line);
      console.log(line);
      await markChecked();
      await sleep(jitter(sleepMs));
      continue;
    }
    if (verdict === "parent_venue") {
      // 호텔·회관 본체가 잡힘 — 매칭이 틀린 건 아니라 노출은 유지하되 사진만 보류.
      summary.parentVenue++;
      mismatches.push(`  △ ${s.sigungu ?? ""} ${s.name}  →  모체 시설 "${home.category}" (사진 보류)`);
      await markChecked();
      await sleep(jitter(sleepMs));
      continue;
    }
    if (verdict === "unknown") {
      summary.unknownCategory++;
      mismatches.push(`  ? ${s.sigungu ?? ""} ${s.name}  →  업종 "${home.category ?? "없음"}"`);
      await markChecked();
      await sleep(jitter(sleepMs));
      continue;
    }
    summary.verifiedOk++;

    if (verifyOnly) {
      await sleep(jitter(sleepMs));
      continue;
    }

    const refs = home.businessPhotos.slice(0, maxPhotos);
    if (!refs.length) {
      // 여기가 재조회 낭비의 진원지였다 — 반드시 마커를 남긴다.
      // 나중에 업체가 사진을 올렸을 수 있으니 --retry-empty 로 다시 볼 수 있다.
      summary.noBusinessPhoto++;
      await markChecked();
      await sleep(jitter(sleepMs));
      continue;
    }

    if (dry) {
      console.log(
        `  · ${s.sigungu ?? ""} ${s.name} [${home.category}] — 업체사진 ${refs.length}장` +
          (s.thumbnail_source === "google" ? " (구글 썸네일 교체 예정)" : ""),
      );
      await sleep(jitter(sleepMs));
      continue;
    }

    try {
      const stored = [];
      for (let i = 0; i < refs.length; i++) {
        const sp = await downloadToStorage(
          supabase,
          s.id,
          `n-${i}`,
          { sourceUrl: refs[i].originalUrl },
          "gallery",
          WATERMARK,
        );
        if (sp) stored.push(sp);
      }
      if (!stored.length) {
        summary.failed++;
        await sleep(jitter(sleepMs));
        continue;
      }
      await saveCrawledPhotos(supabase, s.id, stored, "naver_crawl");
      const wasGoogle = s.thumbnail_source === "google";
      await setRepresentativeThumb(supabase, s.id, stored[0].url, "naver_crawl");
      await markChecked();
      summary.photosStored += stored.length;
      if (wasGoogle) summary.thumbsReplaced++;
      console.log(`  · ${s.name} 업체사진 ${stored.length}장${wasGoogle ? " (구글 → 네이버)" : ""}`);
    } catch (e) {
      summary.failed++;
      console.warn(`  실패 [${s.name}]: ${String(e)}`);
    }
    await sleep(jitter(sleepMs));
  }

  if (mismatches.length) {
    console.log(`\n=== 매칭 의심 ${mismatches.length}건 (사진 수집 건너뜀) ===`);
    for (const m of mismatches.slice(0, 60)) console.log(m);
    if (mismatches.length > 60) console.log(`  … 외 ${mismatches.length - 60}건`);
  }
  console.log(`\n=== 네이버 업체사진 ${dry ? "수집예정(dry)" : verifyOnly ? "검증" : "수집"} 완료 ===`);
  console.table(summary);
}

main().catch((e) => {
  console.error("crawl:naver-photos 실패:", e);
  process.exit(1);
});
