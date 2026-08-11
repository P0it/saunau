/**
 * 매장 AI 소개 백필 (수동/일회성).  블로그 후기가 있는 매장에 한해,
 * 공공데이터 사실 + 블로그 발췌의 "사실"만 뽑아 오리지널 소개를 생성·적재한다.
 *
 *   pnpm describe -- --limit 20            # 실제 적재
 *   pnpm describe -- --limit 3 --dry       # 생성만(콘솔 출력, DB 미적재) — 품질 점검
 *   pnpm describe -- --limit 50 --force    # 이미 ai_description 있는 매장도 재생성
 *
 * 사전 준비:
 *   1) supabase/migrations/0003_ai_description.sql 적용
 *   2) `claude` CLI 로그인(플랜) — API 키 불필요. (DESCRIBE_MODEL 로 모델 변경 가능)
 *
 * 재개 가능: ai_description 이 이미 있으면 건너뛴다(--force 로 무시).
 * LLM 원문 복제 금지·1인칭 금지는 prompt.ts 에서 강제한다.
 */
import { config } from "dotenv";
import { getAdminClient } from "../lib/supabase/admin";
import { buildPrompt } from "../lib/ingest/describe/prompt";
import { generateDescription } from "../lib/ingest/describe/generate";
import type {
  DescribeReview,
  DescribeSaunaFacts,
} from "../lib/ingest/describe/types";

// 후보 매장 = 프롬프트에 넣는 사실(DescribeSaunaFacts) + 적재 판단에 쓰는 컬럼 몇 개.
// 아래 select 목록과 1:1로 맞춰둔다.
type Candidate = DescribeSaunaFacts & {
  id: string;
  has_parking: boolean | null;
  water_note: string | null;
  ai_description_at: string | null;
};

config({ path: ".env.local" });
config();

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? (process.argv[i + 1] ?? "") : undefined;
}
const flag = (name: string) => process.argv.includes(`--${name}`);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const limit = Number(arg("limit") ?? "20");
  const dry = flag("dry");
  const force = flag("force");
  const supabase = getAdminClient();

  // 소개 대상 = 영업중 + 검수통과 + 블로그 후기 보유. (발췌가 있어야 사실 추출 가능)
  // 블로그 후기 있는 sauna_id 전체를 페이지네이션으로 모은다(Supabase 1000행 제한 회피).
  const idSet = new Set<string>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("sauna_blog_reviews")
      .select("sauna_id")
      .eq("is_active", true)
      .range(from, from + 999);
    if (error) throw new Error(`후기 조회 실패: ${error.message}`);
    if (!data?.length) break;
    data.forEach((r) => idSet.add(r.sauna_id as string));
    if (data.length < 1000) break;
  }
  const withReviews = [...idSet];

  const summary = { targeted: 0, withDesc: 0, emptyDesc: 0, skipped: 0, failed: 0 };

  // 후보 사우나를 청크로 조회(블로그 보유 + 영업/검수통과 + (force아니면) 소개 없음)
  let candidates: Candidate[] = [];
  for (let i = 0; i < withReviews.length && candidates.length < limit; i += 200) {
    const ids = withReviews.slice(i, i + 200);
    let q = supabase
      .from("saunas")
      .select(
        "id, name, sido, sigungu, dong, is_jjimjilbang, is_hot_spring, is_enzyme, is_24h, has_outdoor, has_sesin, price, hours, has_parking, water_note, sauna_room_temp, cold_bath_temp, ai_description_at",
      )
      .in("id", ids)
      .eq("status", "영업/정상")
      .eq("needs_review", false);
    // 처리 완료 표시는 ai_description_at(빈 설명도 기록). 내용 없는 매장 재처리 방지.
    if (!force) q = q.is("ai_description_at", null);
    const { data, error } = await q;
    if (error) throw new Error(`대상 조회 실패: ${error.message}`);
    candidates.push(...((data ?? []) as Candidate[]));
  }
  candidates = candidates.slice(0, limit);
  summary.targeted = candidates.length;

  for (const s of candidates) {
    const { data: reviews } = await supabase
      .from("sauna_blog_reviews")
      .select("title, snippet")
      .eq("sauna_id", s.id)
      .eq("is_active", true)
      .limit(6);

    const prompt = buildPrompt({
      sauna: s,
      reviews: (reviews ?? []) as DescribeReview[],
    });

    try {
      const result = await generateDescription(prompt);
      if (!result) {
        summary.failed++;
        console.warn(`  생성 실패(파싱) [${s.name}]`);
        continue;
      }

      // 품질 게이트: 위치 빼고 쓸 내용이 없으면 모델이 ""를 준다 → 소개는 비워둔다(폴백).
      const desc = (result.description ?? "").trim();
      const f = result.facts ?? {};
      const update: Record<string, unknown> = {
        ai_description: desc.length >= 15 ? desc : null,
        ai_description_at: new Date().toISOString(),
      };
      // ⚠ hours·price 는 **권위 컬럼에 쓰지 않는다**(types.ts DescribeResult 주석대로 facts 는 참고용).
      //   LLM 이 블로그에 시간/요금 언급이 없으면 호텔 기본값("체크인 15:00/체크아웃 11:00") 등을
      //   지어내 하드 팩트를 오염시킨다. 영업시간/요금은 네이버 등 권위 출처(crawl:naver-info)·에디터로만.
      //   parking/water 는 서술형 노트라 유지하되 역시 "비어있을 때만".
      if (s.has_parking == null && f.parking) {
        update.has_parking = true;
        update.parking_note = String(f.parking).slice(0, 200);
      }
      if (s.water_note == null && f.water) {
        update.water_note = String(f.water).slice(0, 200);
      }

      if (dry) {
        console.log(`\n── ${s.name} (${s.sigungu ?? ""})`);
        console.log(update.ai_description ?? "(소개 비움 — 위치 외 내용 없음)");
        const filled = Object.keys(update).filter(
          (k) => !["ai_description", "ai_description_at"].includes(k),
        );
        if (filled.length) console.log("  필드채움:", JSON.stringify(
          Object.fromEntries(filled.map((k) => [k, update[k]])),
        ));
      } else {
        const { error: upErr } = await supabase
          .from("saunas")
          .update(update)
          .eq("id", s.id);
        if (upErr) {
          summary.failed++;
          console.warn(`  적재 실패 [${s.name}]: ${upErr.message}`);
          continue;
        }
        console.log(`· ${s.name} 완료`);
      }
      if (update.ai_description) summary.withDesc++;
      else summary.emptyDesc++;
    } catch (e) {
      summary.failed++;
      console.warn(`  실패 [${s.name}]: ${String(e)}`);
    }
    await sleep(500); // 플랜 레이트리밋 여유
  }

  console.log(`\n=== 소개 ${dry ? "생성(dry)" : "적재"} 완료 ===`);
  console.table(summary);
}

main().catch((e) => {
  console.error("describe 실패:", e);
  process.exit(1);
});
