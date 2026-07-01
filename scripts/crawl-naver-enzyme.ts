/**
 * 효소(발효) 찜질방 네이버 수집.  수동/일회성.
 *
 *   pnpm crawl:naver-enzyme -- --dry                 # 무엇이 매칭/신규인지 표만 출력(쓰기 X) ← 먼저 이걸로 눈검수
 *   pnpm crawl:naver-enzyme                          # 실제 적재(신규 INSERT / 기존 매칭 UPDATE)
 *   pnpm crawl:naver-enzyme -- --region 서울,경기      # 특정 지역만
 *   pnpm crawl:naver-enzyme -- --detail              # 상세(영업시간/전화) 보강까지(요청 2배)
 *
 * 왜 별도 스크립트인가: 효소찜질은 목욕장업이 아니라 미용업/자유업 등으로 등록돼 공공데이터엔
 * 대부분 없다. 그래서 네이버 "효소찜질" 검색으로만 잡힌다(따숨·테르엔 등 상호에 '효소' 없는
 * 브랜드 포함). crawl:naver-info 가 "기존 행 보강"이라면 이건 "없는 행을 새로 만드는" 수집이다.
 *
 * 정밀도: 구체 문구 검색 → isEnzymeCandidate(category/제외 필터) → --dry 프리뷰(검수 UI 대체).
 * 커버리지: list 는 쿼리당 상위 결과만 주므로 시도별로 쪼개 검색(enzymeQueries).
 * 중복: 같은 placeId 는 license_no="naver:{id}" 로 재실행 멱등. 다른 출처(목욕장업)와의 중복은
 *      좌표 근접(saunas_nearby_v2) + 이름 유사도(pickBestMatch)로 기존 행에 병합(is_enzyme=true).
 *
 * 사전: .env.local 에 NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.
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
import {
  enzymeQueries,
  isEnzymeCandidate,
  parseAddressRegion,
  slugifyName,
} from "../lib/ingest/naver/enzyme";

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
    placeId: row.id, // 여기선 우리 DB id 를 담아 매칭 후 식별에 쓴다
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
  const regionArg = arg("region"); // 쉼표구분 시도 부분집합
  const regions = regionArg
    ? regionArg.split(",").map((s) => s.trim()).filter(Boolean)
    : undefined;
  const queries = enzymeQueries(regions);

  const supabase = getAdminClient();
  const now = new Date().toISOString();

  const summary = {
    queries: queries.length,
    candidatesSeen: 0,
    rejected: 0, // isEnzymeCandidate 탈락(노이즈)
    matchedExisting: 0, // 기존 행에 is_enzyme 병합
    alreadyIngested: 0, // license_no=naver:{id} 이미 있음(재실행)
    inserted: 0,
    blocked: 0,
    failed: 0,
    aborted: false,
  };

  const seenPlaceIds = new Set<string>();

  // 네이버 429 대응: 연속 차단 시 지수 백오프, 임계 초과 시 중단(crawl:naver-info 와 동일 정책).
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

      // 2차 필터: category/제외 키워드로 노이즈(발효식품·건강원 등) 컷.
      if (!isEnzymeCandidate(c)) {
        summary.rejected++;
        continue;
      }

      try {
        const licenseNo = `naver:${c.placeId}`;
        // 지역 분해는 시도/시군구가 포함된 fullAddress(지번) 우선. roadAddress(list)는
        // "마곡동로10길 46" 처럼 시도 접두가 없어 파싱이 깨진다. 표시용 address 는 도로명 우선.
        const address = c.roadAddress ?? c.fullAddress;
        const { sido, sigungu, dong } = parseAddressRegion(c.fullAddress ?? address);
        const ours: OurSauna = {
          name: c.name,
          sigungu,
          dong,
          address,
          lat: c.lat,
          lng: c.lng,
        };

        // (a) 같은 placeId 로 이미 적재됨? → 재실행 멱등(스킵).
        const { data: existing } = await supabase
          .from("saunas")
          .select("id, is_enzyme")
          .eq("license_no", licenseNo)
          .maybeSingle();
        if (existing) {
          summary.alreadyIngested++;
          if (!dry && !existing.is_enzyme) {
            await supabase.from("saunas").update({ is_enzyme: true }).eq("id", existing.id);
          }
          continue;
        }

        // (b) 다른 출처(목욕장업 등)에 이미 있는 곳? → 좌표 근접 + 이름 유사도로 병합.
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
          // 확신 병합만: 아주 가깝거나(≤150m) 이름이 거의 동일(≥0.9)할 때만 기존 행에 병합.
          // 그 외(예: 446m·0.85 = 동네명만 겹침)는 다른 매장일 수 있어 신규로 넣는다(오병합 방지).
          const confidentMerge =
            !!match &&
            ((match.distanceM != null && match.distanceM <= 150) || match.nameSim >= 0.9);
          if (match && confidentMerge) {
            summary.matchedExisting++;
            if (dry) {
              console.log(`~ 병합  ${c.name} → 기존 "${match.candidate.name}" [${match.reason}]`);
            } else {
              await supabase
                .from("saunas")
                .update({ is_enzyme: true, naver_place_id: c.placeId, naver_synced_at: now })
                .eq("id", match.candidate.placeId); // placeId 에 DB id 를 담아둠
            }
            await sleep(200);
            continue;
          }
        }

        // (c) 신규 매장 → INSERT.
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
          is_enzyme: true,
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
            `+ 신규  ${c.name}  (${[sido, sigungu].filter(Boolean).join(" ")})  ${c.category ?? ""}${hours ? `  · ${hours}` : ""}`,
          );
          await sleep(200);
          continue;
        }

        // slug 전역 유일화 — 충돌(23505) 시 -2,-3… 재시도.
        const base = slugifyName([sigungu, c.name].filter(Boolean).join("-")) || "enzyme";
        let insertedOk = false;
        for (let n = 1; n <= 6 && !insertedOk; n++) {
          const slug = n === 1 ? base : `${base}-${n}`;
          const { error } = await supabase.from("saunas").insert({ ...baseRow, slug });
          if (!error) {
            insertedOk = true;
            break;
          }
          // slug 유니크 충돌만 재시도. 그 외 오류는 던진다.
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

  console.log(`\n=== 효소찜질 네이버 수집 ${dry ? "탐색(dry)" : "적재"} 완료 ===`);
  console.table(summary);
  if (summary.blocked) {
    console.log(`⚠ 차단 ${summary.blocked}건: --sleep 늘려 재실행하면 이어집니다.`);
  }
  if (dry) {
    console.log("→ 결과가 괜찮으면 --dry 빼고 다시 실행하세요(실제 적재).");
  }
}

main().catch((e) => {
  console.error("crawl:naver-enzyme 실패:", e);
  process.exit(1);
});
