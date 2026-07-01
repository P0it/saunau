/**
 * 1인 세신샵 네이버 수집.  수동/일회성.  효소(crawl-naver-enzyme.ts)와 같은 구조.
 *
 *   pnpm crawl:naver-sesin -- --dry                 # 매칭/신규 표만 출력(쓰기 X) ← 먼저 눈검수
 *   pnpm crawl:naver-sesin                          # 실제 적재
 *   pnpm crawl:naver-sesin -- --region 서울,경기      # 특정 지역만
 *   pnpm crawl:naver-sesin -- --detail              # 상세(영업시간/전화) 보강까지
 *
 * 세신샵은 목욕장업이 아니라 미용업/자유업 등으로 등록돼 공공데이터에 대부분 없다 → 네이버로만 잡힌다.
 * 정밀도: 상호에 '세신' 포함(sesin.ts) → --dry 프리뷰. 커버리지: 시도별 분할 검색.
 *
 * ⚠ 병합 규칙: 후보는 isSesinCandidate 로 "상호에 '세신' 포함"만 통과하므로 전부 진짜 세신샵이다.
 *   따라서 기존 행과 **이름 일치(≥0.9)** 로 매칭되면 그건 같은 세신샵(이미 DB에 있던 것) →
 *   is_sesin_shop=true + has_sesin=true 로 지정해 목욕탕 필터에서 뺀다.
 *   거리만 가깝고 이름이 다른 근처 행(다른 목욕탕)은 병합하지 않고 신규 세신샵으로 INSERT 한다.
 *
 * 사전: .env.local 에 NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY, 마이그레이션 0020.
 */
import { config } from "dotenv";
import { getAdminClient } from "../lib/supabase/admin";
import { parseEwkbPoint } from "../lib/ewkb";
import { toEwkt } from "../lib/ingest/projection";
import {
  fetchPlaceCandidates,
  fetchPlaceDetail,
  pickBestMatch,
  stableHoursText,
  type NaverPlaceCandidate,
  type OurSauna,
} from "../lib/ingest/naver/placeInfo";
import { KR_REGIONS, parseAddressRegion, slugifyName } from "../lib/ingest/naver/enzyme";
import { isSesinCandidate, sesinQueries } from "../lib/ingest/naver/sesin";

config({ path: ".env.local" });
config();

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? (process.argv[i + 1] ?? "") : undefined;
}
const flag = (name: string) => process.argv.includes(`--${name}`);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** DB 근접 후보 → pickBestMatch 가 먹는 NaverPlaceCandidate 형태로 매핑(매칭에 필요한 필드만). */
function toDbCandidate(row: {
  id: string;
  name: string;
  address: string | null;
  location: string | null;
}): NaverPlaceCandidate {
  const pt = parseEwkbPoint(row.location);
  return {
    placeId: row.id, // 매칭 후 식별용으로 우리 DB id 를 담는다
    name: row.name,
    category: null,
    phone: null,
    virtualPhone: null,
    roadAddress: null,
    fullAddress: row.address,
    lat: pt?.lat ?? null,
    lng: pt?.lng ?? null,
    is24h: false,
    hoursStatus: null,
    hoursDescription: null,
  };
}

async function main() {
  const dry = flag("dry");
  const detail = flag("detail");
  const sleepMs = Number(arg("sleep") ?? "800");
  const regionArg = arg("region");
  const regions = regionArg
    ? regionArg.split(",").map((s) => s.trim()).filter(Boolean)
    : KR_REGIONS;
  const queries = sesinQueries(regions);

  const supabase = getAdminClient();
  const now = new Date().toISOString();

  const summary = {
    queries: queries.length,
    candidatesSeen: 0,
    rejected: 0,
    matchedExisting: 0, // 기존 행(같은 세신샵)에 is_sesin_shop 지정
    alreadyIngested: 0,
    inserted: 0, // 신규 독립 세신샵
    blocked: 0,
    failed: 0,
    aborted: false,
  };

  const seenPlaceIds = new Set<string>();
  const maxBlocks = Number(arg("max-blocks") ?? "8");
  const MAX_BACKOFF_MS = 60_000;
  let consecBlocks = 0;

  for (const query of queries) {
    const { data: candidates, blocked } = await fetchPlaceCandidates(query);
    if (blocked) {
      summary.blocked++;
      consecBlocks++;
      const backoff = Math.min(MAX_BACKOFF_MS, sleepMs * 2 ** Math.min(consecBlocks, 5));
      console.warn(`  · 차단(429?) [${query}] — ${consecBlocks}연속, ${Math.round(backoff / 1000)}s 백오프`);
      if (consecBlocks >= maxBlocks) {
        summary.aborted = true;
        console.warn(`\n⛔ 연속 차단 ${consecBlocks}회 → 중단. 나중에 재실행하면 이어집니다.`);
        break;
      }
      await sleep(backoff);
      continue;
    }
    consecBlocks = 0;

    for (const c of candidates) {
      if (seenPlaceIds.has(c.placeId)) continue;
      seenPlaceIds.add(c.placeId);
      summary.candidatesSeen++;

      if (!isSesinCandidate(c)) {
        summary.rejected++;
        continue;
      }

      try {
        const licenseNo = `naver:${c.placeId}`;
        const address = c.roadAddress ?? c.fullAddress;
        const { sido, sigungu, dong } = parseAddressRegion(c.fullAddress ?? address);
        const ours: OurSauna = { name: c.name, sigungu, dong, address, lat: c.lat, lng: c.lng };

        // (a) 같은 placeId 로 이미 적재됨? → 멱등(스킵, 세신 플래그만 보정).
        const { data: existing } = await supabase
          .from("saunas")
          .select("id, is_sesin_shop, has_sesin")
          .eq("license_no", licenseNo)
          .maybeSingle();
        if (existing) {
          summary.alreadyIngested++;
          if (!dry && (!existing.is_sesin_shop || !existing.has_sesin)) {
            await supabase
              .from("saunas")
              .update({ is_sesin_shop: true, has_sesin: true })
              .eq("id", existing.id);
          }
          continue;
        }

        // (b) 다른 출처(목욕장업 등)에 이미 있는 곳? → 진짜 목욕탕이므로 has_sesin 만 부여(is_sesin_shop X).
        if (c.lat != null && c.lng != null) {
          const { data: near } = await supabase.rpc("saunas_nearby_v2", {
            lng: c.lng,
            lat: c.lat,
            radius_m: 800,
            max_results: 30,
          });
          const dbCands = (near ?? []).map((r: {
            id: string;
            name: string;
            address: string | null;
            location: string | null;
          }) => toDbCandidate(r));
          const match = pickBestMatch(dbCands, ours);
          // 이름 일치(≥0.9)만 "같은 세신샵"으로 본다. 거리만 가깝고 이름 다른 곳(다른 목욕탕)은
          // 병합하지 않고 신규 INSERT(엉뚱한 목욕탕을 세신샵으로 오지정하는 것 방지).
          if (match && match.nameSim >= 0.9) {
            summary.matchedExisting++;
            if (dry) {
              console.log(`~ 세신샵지정  ${c.name} → 기존 "${match.candidate.name}" [${match.reason}]`);
            } else {
              await supabase
                .from("saunas")
                .update({
                  is_sesin_shop: true,
                  has_sesin: true,
                  naver_place_id: c.placeId,
                  naver_synced_at: now,
                })
                .eq("id", match.candidate.placeId);
            }
            await sleep(200);
            continue;
          }
        }

        // (c) 신규 독립 세신샵 → INSERT (is_sesin_shop + has_sesin).
        let hours: string | null = stableHoursText(c);
        let phone: string | null = c.phone ?? c.virtualPhone;
        if (detail) {
          const det = await fetchPlaceDetail(c.placeId);
          if (det.data) {
            hours = hours ?? det.data.hoursText;
            phone = phone ?? det.data.phone ?? det.data.virtualPhone;
          }
          await sleep(sleepMs);
        }

        const baseRow = {
          license_no: licenseNo,
          name: c.name,
          address,
          sido,
          sigungu,
          dong,
          location: c.lat != null && c.lng != null ? toEwkt({ lng: c.lng, lat: c.lat }) : null,
          status: "영업/정상",
          phone,
          is_sesin_shop: true,
          has_sesin: true,
          is_enzyme: false,
          is_jjimjilbang: false,
          venue_type: "standalone",
          is_24h: c.is24h,
          hours,
          needs_review: false,
          naver_place_id: c.placeId,
          naver_synced_at: now,
        };

        if (dry) {
          summary.inserted++;
          console.log(
            `+ 신규  ${c.name}  (${[sido, sigungu].filter(Boolean).join(" ")})  ${c.category ?? ""}`,
          );
          await sleep(200);
          continue;
        }

        const base = slugifyName([sigungu, c.name].filter(Boolean).join("-")) || "sesin";
        let insertedOk = false;
        for (let n = 1; n <= 6 && !insertedOk; n++) {
          const slug = n === 1 ? base : `${base}-${n}`;
          const { error } = await supabase.from("saunas").insert({ ...baseRow, slug });
          if (!error) {
            insertedOk = true;
            break;
          }
          if (!/duplicate key|23505|slug/i.test(error.message) || /license_no/i.test(error.message)) {
            throw new Error(error.message);
          }
        }
        if (!insertedOk) throw new Error("slug 유일화 실패(6회)");
        summary.inserted++;
        console.log(`+ 신규 적재  ${c.name}  (${[sido, sigungu].filter(Boolean).join(" ")})`);
      } catch (e) {
        summary.failed++;
        console.warn(`  실패 [${c.name}]: ${String(e)}`);
      }
      await sleep(sleepMs);
    }
    await sleep(sleepMs);
  }

  console.log(`\n=== 세신샵 네이버 수집 ${dry ? "탐색(dry)" : "적재"} 완료 ===`);
  console.table(summary);
  if (summary.blocked) console.log(`⚠ 차단 ${summary.blocked}건: --sleep 늘려 재실행하면 이어집니다.`);
  if (dry) console.log("→ 결과가 괜찮으면 --dry 빼고 다시 실행하세요(실제 적재).");
}

main().catch((e) => {
  console.error("crawl:naver-sesin 실패:", e);
  process.exit(1);
});
