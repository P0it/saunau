/**
 * 네이버 플레이스 "기본정보" 백필 (영업시간·전화·편의시설·placeId).  수동/일회성.
 *
 *   pnpm crawl:naver-info -- --limit 50            # 미수집분 50건
 *   pnpm crawl:naver-info -- --limit 30 --dry      # 무엇이 매칭/변경되는지 표만 출력(쓰기 X)
 *   pnpm crawl:naver-info -- --region 서울 --limit 100
 *   pnpm crawl:naver-info -- --force --limit 20    # 이미 수집한 것도 재시도
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

config({ path: ".env.local" });
config();

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? (process.argv[i + 1] ?? "") : undefined;
}
const flag = (name: string) => process.argv.includes(`--${name}`);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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
  const sleepMs = Number(arg("sleep") ?? "700");
  const dry = flag("dry");
  const force = flag("force");
  const noDetail = flag("no-detail");

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
  if (!force) q = q.is("naver_synced_at", null);
  if (region) q = q.like("sido", `${region}%`);

  const { data, error } = await q;
  if (error) throw new Error(`대상 조회 실패: ${error.message}`);
  const saunas = (data ?? []) as SaunaRow[];

  const summary = {
    targeted: saunas.length,
    matched: 0,
    noMatch: 0,
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
      const query = [s.name, s.sigungu ?? s.sido].filter(Boolean).join(" ");

      const { data: candidates, blocked } = await fetchPlaceCandidates(query);
      if (blocked) {
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
        await sleep(sleepMs);
        continue;
      }

      const c = match.candidate;

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
        await sleep(sleepMs);
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
    await sleep(sleepMs);
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
