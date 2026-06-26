/**
 * 네이버 수집 백필 (수동/일회성).  공공데이터 동기화 Cron 과 분리된 위험 격리 작업.
 *
 *   pnpm crawl:naver -- --limit 20            # 블로그 후기만(합법, 기본)
 *   pnpm crawl:naver -- --limit 20 --photos   # 사진까지(비공식 플레이스 — 라이브 검증 필요)
 *
 * 사전 준비:
 *   1) supabase/migrations/0002_photos_reviews.sql 적용 + sauna-photos 버킷
 *   2) .env.local: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY
 *                  NAVER_CLIENT_ID / NAVER_CLIENT_SECRET (네이버 검색 Open API)
 *
 * 재개 가능: 이미 블로그 후기가 있는 사우나는 건너뛴다(--force 로 무시).
 */
import { config } from "dotenv";
import { getAdminClient } from "../lib/supabase/admin";
import { getNaverCreds, searchBlogReviews } from "../lib/ingest/naver/blogSearch";
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

async function main() {
  const limit = Number(arg("limit") ?? "20");
  const withPhotos = flag("photos");
  const force = flag("force");

  const supabase = getAdminClient();
  const creds = getNaverCreds();

  // 대상 subset: 영업중 + 검수통과. (인기 지표 도입 전엔 개업일 최신순 우선.)
  const { data: saunas, error } = await supabase
    .from("saunas")
    .select("id, name, sigungu, address")
    .eq("status", "영업/정상")
    .eq("needs_review", false)
    .order("open_date", { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) throw new Error(`대상 조회 실패: ${error.message}`);

  const summary = {
    targeted: saunas?.length ?? 0,
    skipped: 0,
    reviewsUpserted: 0,
    reviewThumbs: 0,
    photosStored: 0,
    photoSkipped: 0,
  };

  for (const s of saunas ?? []) {
    // 재개: 이미 후기 있으면 스킵
    if (!force) {
      const { count } = await supabase
        .from("sauna_blog_reviews")
        .select("id", { count: "exact", head: true })
        .eq("sauna_id", s.id);
      if ((count ?? 0) > 0) {
        summary.skipped++;
        continue;
      }
    }

    const query = [s.name, s.sigungu].filter(Boolean).join(" ");

    // 1) 블로그 후기 — 공식 API(합법) + 썸네일(og:image 재호스팅, 무흔적)
    try {
      const posts = await searchBlogReviews(query, creds, 5);
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
      summary.reviewsUpserted += await saveBlogReviews(supabase, s.id, posts);
    } catch (e) {
      console.warn(`  후기 실패 [${s.name}]: ${String(e)}`);
    }
    await sleep(300); // 레이트리밋

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

    console.log(`· ${s.name} 완료`);
  }

  console.log("\n=== 크롤 완료 ===");
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
