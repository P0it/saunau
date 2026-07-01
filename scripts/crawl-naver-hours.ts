/**
 * 네이버 상세 데이터 백필 (영업시간·편의시설·요금표).  수동/일회성.
 *
 *   pnpm crawl:naver-hours -- --limit 1000 --sleep 1500       # placeId 보유분 상세 수집
 *   pnpm crawl:naver-hours -- --limit 30 --dry                # 무엇이 채워지는지만 출력
 *   pnpm crawl:naver-hours -- --force --limit 50              # 이미 수집한 것도 갱신
 *
 * 이미 매칭해 둔 saunas.naver_place_id 로 /home 만 받으면 **한 번에** 요일별 영업시간 +
 * 편의시설(conveniences) + 요금표(Menu 노드)가 다 들어온다(재매칭·추가요청 불필요).
 * 사진(저작물)과 달리 이들은 사실 정보 — pcmap SSR 의 임베드 데이터를 읽는다.
 *
 * 저장:
 *  - hours_json(요일별 구조) + hours(요약 텍스트). is_24h 갱신.
 *  - amenities(편의시설 배열) + has_parking(주차 파생, 비었을 때만).
 *  - price_list(요금표 [{name,price}]) + price(대표 입장료, 비었을 때만).
 * 사전: 0014_hours_json.sql + 0017_naver_detail.sql 적용.
 * 재개 가능: hours_synced_at 있으면 스킵(--force 무시).
 * 레이트리밋(429): 연속 차단 시 지수 백오프, 임계 초과 시 배치 중단(재실행으로 이어짐).
 */
import { config } from "dotenv";
import { getAdminClient } from "../lib/supabase/admin";
import { fetchPlaceDetail } from "../lib/ingest/naver/placeInfo";

config({ path: ".env.local" });
config();

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? (process.argv[i + 1] ?? "") : undefined;
}
const flag = (name: string) => process.argv.includes(`--${name}`);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Row {
  id: string;
  name: string;
  naver_place_id: string;
  hours: string | null;
  is_24h: boolean | null;
  has_parking: boolean | null;
  price: number | null;
}

async function main() {
  const limit = Number(arg("limit") ?? "1000");
  const sleepMs = Number(arg("sleep") ?? "1500");
  const dry = flag("dry");
  const force = flag("force");
  const maxBlocks = Number(arg("max-blocks") ?? "8");
  const MAX_BACKOFF_MS = 60_000;

  const supabase = getAdminClient();

  let q = supabase
    .from("saunas")
    .select("id, name, naver_place_id, hours, is_24h, has_parking, price")
    .not("naver_place_id", "is", null)
    .order("open_date", { ascending: false, nullsFirst: false })
    .limit(limit);
  if (!force) q = q.is("hours_synced_at", null);

  const { data, error } = await q;
  if (error) throw new Error(`대상 조회 실패: ${error.message}`);
  const rows = (data ?? []) as Row[];

  const summary = {
    targeted: rows.length,
    hoursSet: 0,
    perDay: 0, // 요일별(비-24h) 채운 수
    is24h: 0,
    noHours: 0, // 네이버에 시간정보 없음
    amenitiesSet: 0,
    priceListSet: 0,
    parkingSet: 0,
    blocked: 0,
    failed: 0,
    aborted: false,
  };
  let consecBlocks = 0;

  for (const s of rows) {
    try {
      const { data: det, blocked } = await fetchPlaceDetail(s.naver_place_id);
      if (blocked) {
        summary.blocked++;
        consecBlocks++;
        const backoff = Math.min(MAX_BACKOFF_MS, sleepMs * 2 ** Math.min(consecBlocks, 5));
        console.warn(`  · 차단(429?) [${s.name}] — ${consecBlocks}연속, ${Math.round(backoff / 1000)}s 백오프`);
        if (consecBlocks >= maxBlocks) {
          summary.aborted = true;
          console.warn(`\n⛔ 연속 차단 ${consecBlocks}회 → 배치 중단(쿨다운 필요). 재실행하면 이어집니다.`);
          break;
        }
        await sleep(backoff);
        continue;
      }
      consecBlocks = 0;

      const wh = det?.weekHours ?? null;
      const update: Record<string, unknown> = {
        hours_synced_at: new Date().toISOString(),
      };
      const changes: string[] = [];

      if (wh) {
        update.hours_json = wh;
        update.hours = wh.summary; // 권위 요일별 → 요약을 hours(text)에 반영
        summary.hoursSet++;
        if (wh.is24h) {
          summary.is24h++;
          if (!s.is_24h) update.is_24h = true;
        } else {
          summary.perDay++;
        }
        changes.push(`hours="${wh.summary}"`);
      } else {
        summary.noHours++;
      }

      // 편의시설 — 네이버 현재 스냅샷으로 갱신(있으면).
      if (det?.conveniences.length) {
        update.amenities = det.conveniences;
        summary.amenitiesSet++;
        // 주차여부 파생 — 비어있을 때만 true 보강.
        if (s.has_parking == null && det.conveniences.some((x) => x.includes("주차"))) {
          update.has_parking = true;
          summary.parkingSet++;
          changes.push("주차");
        }
        changes.push(`편의시설×${det.conveniences.length}`);
      }

      // 요금표 — Menu 노드 원본만 저장(있으면). 대표 입장료(price)는 derive:price 가
      // price_list 에서 재계산한다(패키지/회차권 오선택 정정·로직 변경 시 재크롤 불요).
      if (det?.priceList.length) {
        update.price_list = det.priceList;
        summary.priceListSet++;
        changes.push(`요금표×${det.priceList.length}`);
      }

      if (dry) {
        console.log(`· ${s.name} → ${changes.length ? changes.join(", ") : "(시간정보 없음)"}`);
        await sleep(Math.min(sleepMs, 400));
        continue;
      }

      const { error: upErr } = await supabase.from("saunas").update(update).eq("id", s.id);
      if (upErr) throw new Error(upErr.message);
      console.log(`· ${s.name} ${changes.length ? changes.join(", ") : "(시간정보 없음)"}`);
    } catch (e) {
      summary.failed++;
      console.warn(`  실패 [${s.name}]: ${String(e)}`);
    }
    await sleep(sleepMs);
  }

  console.log(`\n=== 네이버 상세(영업시간·편의시설·요금) ${dry ? "탐색(dry)" : "백필"} 완료 ===`);
  console.table(summary);
  if (summary.blocked) {
    console.log(`⚠ 차단 ${summary.blocked}건: 스킵마커 미설정(재실행으로 이어짐). --sleep 늘려 재시도.`);
  }
}

main().catch((e) => {
  console.error("crawl:naver-hours 실패:", e);
  process.exit(1);
});
