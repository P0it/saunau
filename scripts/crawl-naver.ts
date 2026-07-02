/**
 * 네이버 수집 백필 (수동/일회성).  공공데이터 동기화 Cron 과 분리된 위험 격리 작업.
 *
 *   pnpm crawl:naver -- --limit 20              # 블로그 후기만(합법, 기본: 미수집 최신 20곳)
 *   pnpm crawl:naver -- --limit 30 --dry        # 쿼리·필터 결과만 출력(쓰기 X) — 정밀도 확인
 *   pnpm crawl:naver -- --all                   # 미수집 전체 백필 (업소당 검색 1콜, 일 25k 쿼터 내)
 *   pnpm crawl:naver -- --all --region 서울     # 지역(sido prefix) 분할 백필
 *   pnpm crawl:naver -- --refresh --days 45 --limit 2000   # 오래된 순 갱신(월 1회 권장)
 *   pnpm crawl:naver -- --limit 20 --photos     # 사진까지(비공식 플레이스 — 라이브 검증 필요)
 *
 * 기타 플래그: --no-thumbs(og:image 생략, 대규모 고속), --sleep 300, --max-calls 20000(쿼터 가드),
 *             --force(수집 여부 무시 재수집)
 *
 * 사전 준비:
 *   1) supabase/migrations/0002_photos_reviews.sql 적용 + sauna-photos 버킷
 *   2) .env.local: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY
 *                  NAVER_CLIENT_ID / NAVER_CLIENT_SECRET (네이버 검색 Open API)
 *
 * 재개 가능: 이미 블로그 후기가 있는 사우나는 건너뛴다(--force 로 무시).
 * 크론 편입 금지: 전체 패스는 수 시간짜리(썸네일 재호스팅) — Vercel maxDuration 못 버틴다.
 */
import { config } from "dotenv";
import { getAdminClient } from "../lib/supabase/admin";
import {
  getNaverCreds,
  searchBlogReviews,
  filterRelevantPosts,
  cleanNameForQuery,
} from "../lib/ingest/naver/blogSearch";
import { fetchOgImage } from "../lib/ingest/naver/blogThumb";
import { searchPlaceMatch, fetchPlacePhotos } from "../lib/ingest/naver/place";
import {
  downloadToStorage,
  saveCrawledPhotos,
  saveBlogReviews,
  setRepresentativeThumb,
} from "../lib/ingest/naver/store";

config({ path: ".env.local" });
config();

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? (process.argv[i + 1] ?? "") : undefined;
}
function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface SaunaRow {
  id: string;
  name: string;
  sigungu: string | null;
  address: string | null;
}

/** 후기 보유 맵: sauna_id → 최신 created_at. (업소별 count 쿼리 대신 한 번에 로드) */
async function loadReviewStateMap(
  supabase: ReturnType<typeof getAdminClient>,
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const PAGE = 1000;
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from("sauna_blog_reviews")
      .select("sauna_id, created_at")
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`후기 현황 조회 실패: ${error.message}`);
    if (!data?.length) break;
    for (const r of data) {
      const prev = map.get(r.sauna_id);
      if (!prev || r.created_at > prev) map.set(r.sauna_id, r.created_at);
    }
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return map;
}

/** 대상 사우나 조회. all/refresh 는 id 순 페이지 순회(안정·재개 가능), 기본은 개업일 최신순 limit. */
async function fetchEligibleSaunas(
  supabase: ReturnType<typeof getAdminClient>,
  opts: { paged: boolean; limit: number; region?: string },
): Promise<SaunaRow[]> {
  const base = () => {
    let q = supabase
      .from("saunas")
      .select("id, name, sigungu, address")
      .eq("status", "영업/정상")
      .eq("needs_review", false);
    if (opts.region) q = q.like("sido", `${opts.region}%`);
    return q;
  };

  if (!opts.paged) {
    const { data, error } = await base()
      .order("open_date", { ascending: false, nullsFirst: false })
      .limit(opts.limit);
    if (error) throw new Error(`대상 조회 실패: ${error.message}`);
    return (data ?? []) as SaunaRow[];
  }

  const rows: SaunaRow[] = [];
  const PAGE = 1000;
  let from = 0;
  for (;;) {
    const { data, error } = await base()
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`대상 조회 실패: ${error.message}`);
    if (!data?.length) break;
    rows.push(...(data as SaunaRow[]));
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return rows;
}

async function main() {
  const limit = Number(arg("limit") ?? "20");
  const all = flag("all");
  const refresh = flag("refresh");
  const days = Number(arg("days") ?? "30");
  const region = arg("region"); // sido prefix 필터(선택)
  const dry = flag("dry");
  const noThumbs = flag("no-thumbs");
  const sleepMs = Number(arg("sleep") ?? "300");
  const maxCalls = Number(arg("max-calls") ?? "20000"); // 일 쿼터(25k) 아래 안전선
  const withPhotos = flag("photos");
  const force = flag("force");

  const supabase = getAdminClient();
  const creds = getNaverCreds();

  // 1) 후기 보유 현황 → 2) 대상 조회 → 3) 메모리에서 선별
  const reviewState = await loadReviewStateMap(supabase);
  const saunas = await fetchEligibleSaunas(supabase, {
    paged: all || refresh,
    limit,
    region,
  });

  let targets: SaunaRow[];
  let skipped = 0;
  if (refresh) {
    // 갱신: 후기 0건이거나 최신 수집이 기준일보다 오래된 업소, 오래된 순.
    const cutoffMs = Date.now() - days * 86_400_000;
    const crawledAt = (s: SaunaRow) => {
      const iso = reviewState.get(s.id);
      return iso ? new Date(iso).getTime() : 0; // 0건 = 가장 오래된 취급
    };
    targets = saunas
      .filter((s) => force || crawledAt(s) < cutoffMs)
      .sort((a, b) => crawledAt(a) - crawledAt(b))
      .slice(0, limit);
    skipped = saunas.length - targets.length;
  } else {
    // 백필: 아직 후기 없는 업소만(--force 는 전부).
    targets = saunas.filter((s) => force || !reviewState.has(s.id));
    skipped = saunas.length - targets.length;
  }

  console.log(
    `대상 ${targets.length}곳 (전체 ${saunas.length}, 스킵 ${skipped})` +
      `${region ? ` · 지역=${region}` : ""}${dry ? " · DRY" : ""}`,
  );

  const summary = {
    targeted: targets.length,
    skipped,
    apiCalls: 0,
    reviewsUpserted: 0,
    filtered: 0, // 관련성 필터로 제외된 글 수
    noResults: 0, // 검색 0건(필터 후 포함) 업소 수
    reviewThumbs: 0,
    photosStored: 0,
    photoSkipped: 0,
    failed: 0,
    aborted: false,
  };

  // 429(레이트리밋) 대응: 연속 차단 시 지수 백오프, 임계 초과 시 배치 중단.
  const maxBlocks = Number(arg("max-blocks") ?? "8");
  const MAX_BACKOFF_MS = 60_000;
  let consecBlocks = 0;

  for (let idx = 0; idx < targets.length; idx++) {
    const s = targets[idx];
    const tag = `[${idx + 1}/${targets.length}]`;

    if (summary.apiCalls >= maxCalls) {
      summary.aborted = true;
      console.warn(
        `\n⛔ --max-calls ${maxCalls} 도달 → 배치 중단(내일 재실행하면 이어집니다).`,
      );
      break;
    }

    const query = [cleanNameForQuery(s.name), s.sigungu]
      .filter(Boolean)
      .join(" ");

    // 1) 블로그 후기 — 공식 API(합법) + 관련성 필터 + 썸네일(og:image 재호스팅)
    try {
      summary.apiCalls++;
      const raw = await searchBlogReviews(query, creds, 5);
      consecBlocks = 0; // 정상 응답 → 연속 차단 카운터 리셋

      const posts = filterRelevantPosts(raw, s);
      summary.filtered += raw.length - posts.length;
      if (!posts.length) summary.noResults++;

      if (dry) {
        console.log(
          `${tag} ${s.name} ("${query}") → 유지 ${posts.length} / 제외 ${raw.length - posts.length}`,
        );
        for (const p of raw) {
          console.log(`    ${posts.includes(p) ? "·" : "×"} ${p.title}`);
        }
        await sleep(Math.min(sleepMs, 100)); // dry 는 검색 1콜뿐 — 짧게
        continue;
      }

      if (!noThumbs) {
        // 각 글의 대표 이미지(og:image)를 추출 → 우리 Storage 로 재호스팅 → thumb_url 세팅.
        for (let i = 0; i < posts.length; i++) {
          const og = await fetchOgImage(posts[i].blogUrl);
          if (!og) continue;
          const sp = await downloadToStorage(supabase, s.id, `blog-${i}`, {
            sourceUrl: og,
          });
          if (sp) {
            posts[i].thumbUrl = sp.url;
            summary.reviewThumbs++;
          }
        }
      }
      if (posts.length) {
        summary.reviewsUpserted += await saveBlogReviews(supabase, s.id, posts);
      }
      console.log(
        `${tag} ${s.name} 완료 (후기 ${posts.length}${raw.length !== posts.length ? `, 필터 제외 ${raw.length - posts.length}` : ""})`,
      );
    } catch (e) {
      const msg = String(e);
      if (msg.includes("HTTP 429")) {
        consecBlocks++;
        const backoff = Math.min(
          MAX_BACKOFF_MS,
          sleepMs * 2 ** Math.min(consecBlocks, 5),
        );
        console.warn(
          `${tag} 차단(429) [${s.name}] — ${consecBlocks}연속, ${Math.round(backoff / 1000)}s 백오프`,
        );
        if (consecBlocks >= maxBlocks) {
          summary.aborted = true;
          console.warn(
            `\n⛔ 연속 차단 ${consecBlocks}회 → 배치 중단(쿨다운 필요). 재실행하면 이어집니다.`,
          );
          break;
        }
        await sleep(backoff);
        continue;
      }
      summary.failed++;
      console.warn(`${tag} 후기 실패 [${s.name}]: ${msg}`);
    }
    await sleep(sleepMs); // 레이트리밋

    // 2) 사진 — 비공식 플레이스(옵션). placeId 해석은 라이브 검증 필요.
    if (withPhotos) {
      try {
        const match = await searchPlaceMatch(s.name, s.address, creds);
        if (!match?.placeId) {
          // placeId 미해석 → 사진 스킵(정직하게 로깅). 라이브에서 resolver 검증 후 활성화.
          summary.photoSkipped++;
        } else {
          const photos = await fetchPlacePhotos(match.placeId, 8);
          const stored = [];
          for (let i = 0; i < photos.length; i++) {
            const sp = await downloadToStorage(supabase, s.id, i, photos[i]);
            if (sp) stored.push(sp);
          }
          if (stored.length) {
            await saveCrawledPhotos(supabase, s.id, stored);
            await setRepresentativeThumb(supabase, s.id, stored[0].url);
            summary.photosStored += stored.length;
          }
        }
      } catch (e) {
        console.warn(`  사진 실패 [${s.name}]: ${String(e)}`);
      }
      await sleep(500);
    }
  }

  console.log(`\n=== 크롤 ${dry ? "탐색(dry)" : "완료"} ===`);
  console.table(summary);
  if (withPhotos && summary.photoSkipped) {
    console.log(
      `⚠ 사진 ${summary.photoSkipped}건 스킵: placeId 해석기(place.ts)는 라이브 검증 후 활성화 필요.`,
    );
  }
}

main().catch((e) => {
  console.error("크롤 실패:", e);
  process.exit(1);
});
