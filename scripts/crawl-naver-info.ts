/**
 * 네이버 플레이스 "기본정보" 백필 (영업시간·전화·편의시설·placeId).  수동/일회성.
 *
 *   pnpm crawl:naver-info -- --limit 50            # 미수집분 50건
 *   pnpm crawl:naver-info -- --limit 30 --dry      # 무엇이 매칭/변경되는지 표만 출력(쓰기 X)
 *   pnpm crawl:naver-info -- --region 서울 --limit 100
 *   pnpm crawl:naver-info -- --force --limit 20    # 이미 수집한 것도 재시도
 *   pnpm crawl:naver-info -- --retry-unmatched --dry --limit 40   # 과거 매칭실패분만 재시도(개선쿼리 검증)
 *
 * 사진(저작물)과 다른 경로다. pcmap.place.naver.com SSR 의 사실 데이터(영업시간/전화/주차)만
 * 읽는다(캡차 없음, 라이브 검증). 기존 컬럼은 "비어있을 때만" 채운다(에디터/공공데이터 보존).
 *
 * 사전: supabase/migrations/0009_naver_place_info.sql 적용.
 *       .env.local: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY
 * 재개 가능: naver_synced_at 있는 행은 스킵(--force 로 무시).
 */
import { config } from "dotenv";
import { getAdminClient } from "../lib/supabase/admin";
import { parseEwkbPoint } from "../lib/ewkb";
import {
  fetchPlaceCandidates,
  fetchPlaceDetail,
  pickBestMatch,
  stableHoursText,
  type OurSauna,
} from "../lib/ingest/naver/placeInfo";
import { verifyCategory } from "../lib/ingest/naver/category";

config({ path: ".env.local" });
config();

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? (process.argv[i + 1] ?? "") : undefined;
}
const flag = (name: string) => process.argv.includes(`--${name}`);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * 요청 간격에 ±40% 흔들림. 고정 간격 반복 자체가 봇 신호다 —
 * 2026-08-06 차단이 그렇게 났다(crawl-naver-photos 와 같은 대책).
 * 이 스크립트는 검색+상세로 건당 요청이 2배라 더 조심해야 한다.
 */
const jitter = (ms: number) => Math.round(ms * (0.6 + Math.random() * 0.8));

// 검색어에서 네이버 플레이스가 안 쓰는 법인·행정 껍데기를 제거해 브랜드 코어만 남긴다.
// (인허가 대장은 "유한회사 힐스톤온천리조트"처럼 정식명칭이라, 붙은 채 검색하면 0건.)
function cleanQueryName(raw: string): string {
  const c = raw
    .replace(/\(주\)|\(유\)|\(재\)|\(사\)|㈜|주식회사|유한회사|합자회사|의료법인|사회복지법인/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return c || raw;
}

interface SaunaRow {
  id: string;
  name: string;
  sido: string | null;
  sigungu: string | null;
  dong: string | null;
  address: string | null;
  phone: string | null;
  hours: string | null;
  is_24h: boolean | null;
  has_parking: boolean | null;
  location: string | null; // EWKB hex
}

async function main() {
  const limit = Number(arg("limit") ?? "50");
  const region = arg("region"); // sido prefix 필터(선택)
  const sleepMs = Number(arg("sleep") ?? "1200");
  const dry = flag("dry");
  const force = flag("force");
  const noDetail = flag("no-detail");
  // 이전에 매칭 실패로 기록된 매장만 재시도(naver_synced_at 있는데 place_id 없음).
  // 쿼리 전략 개선(지역토큰 제거) 후 이 실패분을 다시 훑을 때 쓴다.
  const retryUnmatched = flag("retry-unmatched");

  const supabase = getAdminClient();

  let q = supabase
    .from("saunas")
    .select(
      "id, name, sido, sigungu, dong, address, phone, hours, is_24h, has_parking, location",
    )
    .eq("status", "영업/정상")
    .eq("needs_review", false)
    .order("open_date", { ascending: false, nullsFirst: false })
    .limit(limit);
  if (retryUnmatched) {
    q = q.not("naver_synced_at", "is", null).is("naver_place_id", null);
  } else if (!force) {
    q = q.is("naver_synced_at", null);
  }
  if (region) q = q.like("sido", `${region}%`);

  const { data, error } = await q;
  if (error) throw new Error(`대상 조회 실패: ${error.message}`);
  const saunas = (data ?? []) as SaunaRow[];

  const summary = {
    targeted: saunas.length,
    matched: 0,
    noMatch: 0,
    wrongCategory: 0, // 좌표·상호로는 걸렸지만 업종이 카페·식당 등 → 매칭 파기
    blocked: 0,
    hoursSet: 0,
    phoneSet: 0,
    parkingSet: 0,
    is24hSet: 0,
    failed: 0,
    aborted: false,
  };

  // 네이버 429(레이트리밋) 대응: 연속 차단 시 지수 백오프, 임계 초과 시 배치 중단.
  // (계속 두드리면 차단만 길어진다. 중단해도 naver_synced_at 미설정분은 재실행으로 이어짐.)
  const maxBlocks = Number(arg("max-blocks") ?? "8"); // 연속 차단 허용치 → 초과 시 중단
  const MAX_BACKOFF_MS = 60_000;
  let consecBlocks = 0;

  for (const s of saunas) {
    try {
      const pt = parseEwkbPoint(s.location);
      const ours: OurSauna = {
        name: s.name,
        sigungu: s.sigungu,
        dong: s.dong,
        address: s.address,
        lat: pt?.lat ?? null,
        lng: pt?.lng ?? null,
      };
      // 검색 전략(중요):
      //  '상호만'(지역 토큰 없이)으로 찾고, 좌표가 있으면 x,y 힌트로 우리 위치 근처를
      //  상위에 끌어올린다. 네이버 place/list 는 "상호 시군구"처럼 지역명을 붙이면 문자열
      //  전체를 매칭해 0건이 되기 때문(진단으로 확정). 전국 동명업소가 섞여도 pickBestMatch
      //  의 좌표 게이트(≤700m, 이름정확시 ≤1200m)로 정확히 걸러진다.
      const cleaned = cleanQueryName(s.name);
      const coord =
        ours.lat != null && ours.lng != null
          ? { lat: ours.lat, lng: ours.lng }
          : null;

      const first = await fetchPlaceCandidates(cleaned, coord);
      if (first.blocked) {
        // 429/캡차/구조변경 → 스킵마커 찍지 않음(다음 실행에서 재시도).
        summary.blocked++;
        consecBlocks++;
        const backoff = Math.min(
          MAX_BACKOFF_MS,
          sleepMs * 2 ** Math.min(consecBlocks, 5),
        );
        console.warn(
          `  · 차단(429?) [${s.name}] — ${consecBlocks}연속, ${Math.round(backoff / 1000)}s 백오프`,
        );
        if (consecBlocks >= maxBlocks) {
          summary.aborted = true;
          console.warn(
            `\n⛔ 연속 차단 ${consecBlocks}회 → 배치 중단(레이트리밋 쿨다운 필요). 나중에 재실행하면 이어집니다.`,
          );
          break;
        }
        await sleep(backoff);
        continue;
      }
      consecBlocks = 0; // 정상 응답 → 연속 차단 카운터 리셋

      const candidates = first.data;
      const match = pickBestMatch(candidates, ours);
      if (!match) {
        summary.noMatch++;
        if (!dry) {
          await supabase
            .from("saunas")
            .update({ naver_synced_at: new Date().toISOString() })
            .eq("id", s.id);
        }
        console.log(`  · 매칭없음 [${s.name}] (후보 ${candidates.length})`);
        await sleep(jitter(sleepMs));
        continue;
      }

      const c = match.candidate;

      // 업종 검증 — 좌표·상호만 보면 같은 건물의 다른 업소가 잡힌다.
      // 실측: "나인"(강남 목욕장) → 동명 카페가 잡혀 요금표에 아메리카노가 들어왔다.
      // placeId 를 저장하면 crawl:naver-hours·photos 가 그 자리에서 카페 데이터를
      // 계속 긁어오므로, 여기서 끊는 게 유일한 지점이다.
      if (verifyCategory(c.category, { ours: s.name, theirs: c.name }) === "wrong_category") {
        summary.wrongCategory++;
        if (!dry) {
          await supabase
            .from("saunas")
            .update({ naver_synced_at: new Date().toISOString() })
            .eq("id", s.id);
        }
        console.log(`  · 업종불일치 [${s.name}] → "${c.name}" [${c.category}] 매칭 파기`);
        await sleep(jitter(sleepMs));
        continue;
      }

      // 상세(편의시설·보강 전화·구조화 영업시간) — 옵션.
      let conveniences: string[] = [];
      let detailHours: string | null = null;
      let detailPhone: string | null = null;
      if (!noDetail) {
        const det = await fetchPlaceDetail(c.placeId);
        if (det.data) {
          conveniences = det.data.conveniences;
          detailHours = det.data.hoursText;
          detailPhone = det.data.phone ?? det.data.virtualPhone;
        }
        await sleep(jitter(sleepMs));
      }

      // 채울 값 — "비어있을 때만". (에디터/공공데이터 보존)
      const upd: Record<string, unknown> = {
        naver_place_id: c.placeId,
        naver_synced_at: new Date().toISOString(),
      };
      const changes: string[] = [];

      const newPhone = c.phone ?? c.virtualPhone ?? detailPhone;
      if (!s.phone && newPhone) {
        upd.phone = newPhone;
        summary.phoneSet++;
        changes.push(`phone=${newPhone}`);
      }

      const newHours = stableHoursText(c) ?? detailHours;
      if (!s.hours && newHours) {
        upd.hours = newHours;
        summary.hoursSet++;
        changes.push(`hours="${newHours}"`);
      }
      // 24시간은 안정 신호 → is_24h 가 아직 false 면 승격(true→false 강등은 안 함).
      if (c.is24h && !s.is_24h) {
        upd.is_24h = true;
        summary.is24hSet++;
        changes.push("is_24h=true");
      }
      // 주차: 편의시설에 "주차" 있으면 true 만 세팅(없다고 false 단정 안 함).
      if (s.has_parking == null && conveniences.some((x) => x.includes("주차"))) {
        upd.has_parking = true;
        summary.parkingSet++;
        changes.push("has_parking=true");
      }

      summary.matched++;
      if (dry) {
        console.log(
          `· ${s.name} → "${c.name}" [${match.reason}] ${changes.length ? changes.join(", ") : "(변경 없음)"}`,
        );
        await sleep(200);
        continue;
      }

      const { error: upErr } = await supabase
        .from("saunas")
        .update(upd)
        .eq("id", s.id);
      if (upErr) throw new Error(upErr.message);
      console.log(
        `· ${s.name} 완료 [${match.reason}] ${changes.length ? changes.join(", ") : "(placeId만)"}`,
      );
    } catch (e) {
      summary.failed++;
      console.warn(`  실패 [${s.name}]: ${String(e)}`);
    }
    await sleep(jitter(sleepMs));
  }

  console.log(`\n=== 네이버 기본정보 ${dry ? "탐색(dry)" : "백필"} 완료 ===`);
  console.table(summary);
  if (summary.blocked) {
    console.log(
      `⚠ 차단 ${summary.blocked}건: 스킵마커 미설정(다음 실행 재시도). --sleep 늘려 재시도 권장.`,
    );
  }
}

main().catch((e) => {
  console.error("crawl:naver-info 실패:", e);
  process.exit(1);
});
