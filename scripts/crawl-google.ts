/**
 * Google Places 사진 백필 (수동/일회성).  합법 유료 API로 매장 사진을 받아
 * 우리 Storage(WebP)로 재호스팅하고 대표 썸네일·갤러리를 채운다.
 *
 *   pnpm crawl:google -- --limit 20            # 매장당 사진 최대 5장
 *   pnpm crawl:google -- --limit 5 --photos 3  # 매장당 3장(과금 절약)
 *   pnpm crawl:google -- --limit 5 --dry        # 매칭/사진수만 출력(다운로드·적재 X)
 *
 * ⚠ 과금: searchText(매장당 1회) + photo media(사진당 1회). 무료 한도(월 SKU별)를
 *    넘으면 유료다. --limit 로 배치 규모를 직접 통제하라.
 *
 * 사전: 1) Places API(New) 사용설정 + 결제 + GOOGLE_MAPS_API_KEY
 *       2) 0002(사진 테이블/버킷) 적용
 * 재개 가능: 이미 google 사진이 있는 매장은 건너뛴다(--force 로 무시).
 */
import { config } from "dotenv";
import { getAdminClient } from "../lib/supabase/admin";
import {
  getGoogleKey,
  searchPlace,
  photoMediaUrl,
} from "../lib/ingest/google/places";
import {
  downloadToStorage,
  saveCrawledPhotos,
  setRepresentativeThumb,
} from "../lib/ingest/naver/store";

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
  const maxPhotos = Number(arg("photos") ?? "5");
  const dry = flag("dry");
  const force = flag("force");
  const withBlogs = flag("with-blogs"); // 블로그 후기 있는(인기) 매장만 타겟
  const enzymeOnly = flag("enzyme"); // 효소찜질만 타겟(네이버 수집분은 open_date 없어 뒤로 밀리므로 직접 지정)
  const sesinOnly = flag("sesin"); // 1인 세신샵만 타겟(효소와 동일 이유)
  // 과금 하드캡(실행당). GCP 할당량과 별개의 코드측 2차 안전장치.
  const searchBudget = Number(arg("maxsearch") ?? "1000");
  const photoBudget = Number(arg("maxphoto") ?? "2000");
  let usedSearch = 0;
  let usedPhoto = 0;

  const supabase = getAdminClient();
  const key = getGoogleKey();

  // 시도 마커: 매칭 실패 매장을 다음 실행에서 재검색하지 않게 한다(과금 방지).
  const markChecked = (id: string) =>
    supabase
      .from("saunas")
      .update({ photo_checked_at: new Date().toISOString() })
      .eq("id", id);

  // 대상 후보 수집. --with-blogs 면 블로그 보유 매장만(인기·매칭률↑), 아니면 새로 오픈 우선.
  let saunas: Array<{ id: string; name: string; address: string | null }> = [];
  if (withBlogs) {
    const blogIds = new Set<string>();
    for (let from = 0; ; from += 1000) {
      const { data } = await supabase
        .from("sauna_blog_reviews")
        .select("sauna_id")
        .range(from, from + 999);
      if (!data?.length) break;
      data.forEach((r) => blogIds.add(r.sauna_id as string));
      if (data.length < 1000) break;
    }
    const ids = [...blogIds];
    for (let i = 0; i < ids.length && saunas.length < limit * 3; i += 200) {
      let q = supabase
        .from("saunas")
        .select("id, name, address")
        .in("id", ids.slice(i, i + 200))
        .eq("status", "영업/정상")
        .eq("needs_review", false);
      if (enzymeOnly) q = q.eq("is_enzyme", true);
      if (sesinOnly) q = q.eq("is_sesin_shop", true);
      if (!force) q = q.is("thumbnail_url", null).is("photo_checked_at", null);
      const { data, error } = await q;
      if (error) throw new Error(`대상 조회 실패: ${error.message}`);
      saunas.push(...(data ?? []));
    }
  } else {
    let q = supabase
      .from("saunas")
      .select("id, name, address")
      .eq("status", "영업/정상")
      .eq("needs_review", false)
      .order("open_date", { ascending: false, nullsFirst: false })
      .limit(limit * 3);
    if (enzymeOnly) q = q.eq("is_enzyme", true);
    if (sesinOnly) q = q.eq("is_sesin_shop", true);
    // thumbnail 없고 + 아직 시도 안 한 매장만(매칭 실패 매장 재검색 방지).
    if (!force) q = q.is("thumbnail_url", null).is("photo_checked_at", null);
    const { data, error } = await q;
    if (error) throw new Error(`대상 조회 실패: ${error.message}`);
    saunas = data ?? [];
  }

  const summary = {
    targeted: 0,
    matched: 0,
    noMatch: 0,
    photosStored: 0,
    skipped: 0,
    failed: 0,
    stoppedByBudget: false,
  };

  let processed = 0;
  for (const s of saunas ?? []) {
    if (processed >= limit) break;
    // 하드캡: 검색·사진 예산 소진 시 즉시 중단(과금 방지 2차 안전장치).
    if (usedSearch >= searchBudget || usedPhoto >= photoBudget) {
      summary.stoppedByBudget = true;
      console.warn(`⚠ 호출 예산 소진(search ${usedSearch}/${searchBudget}, photo ${usedPhoto}/${photoBudget}) — 중단`);
      break;
    }

    // 재개: 이미 google 사진 있으면 스킵
    if (!force) {
      const { count } = await supabase
        .from("sauna_photos")
        .select("id", { count: "exact", head: true })
        .eq("sauna_id", s.id)
        .eq("source", "google");
      if ((count ?? 0) > 0) {
        summary.skipped++;
        continue;
      }
    }
    processed++;
    summary.targeted++;

    try {
      usedSearch++;
      const match = await searchPlace(s.name, s.address, key);
      if (!match || !match.photos.length) {
        summary.noMatch++;
        if (dry) console.log(`· ${s.name} — 매칭/사진 없음`);
        else await markChecked(s.id); // 재검색 방지
        await sleep(200);
        continue;
      }
      summary.matched++;

      // websiteUri 는 같은 검색 응답에 공짜로 온다 → 저장해 사이트 크롤이 재사용(추가 검색 0).
      if (match.websiteUri) {
        await supabase
          .from("saunas")
          .update({ website_url: match.websiteUri })
          .eq("id", s.id);
      }

      if (dry) {
        console.log(`· ${s.name} → ${match.displayName} | 사진 ${Math.min(match.photos.length, maxPhotos)}장`);
        await sleep(200);
        continue;
      }

      // 사진 예산 내에서만 가져온다.
      const room = Math.max(0, photoBudget - usedPhoto);
      const refs = match.photos.slice(0, Math.min(maxPhotos, room));
      const stored = [];
      for (let i = 0; i < refs.length; i++) {
        usedPhoto++;
        const sp = await downloadToStorage(supabase, s.id, `g-${i}`, {
          sourceUrl: refs[i].name, // 키 미포함 리소스 이름(서버 전용)
          fetchUrl: photoMediaUrl(refs[i].name, key, 800),
        });
        if (sp) stored.push(sp);
      }
      if (stored.length) {
        await saveCrawledPhotos(supabase, s.id, stored, "google");
        await setRepresentativeThumb(supabase, s.id, stored[0].url, "google");
        await markChecked(s.id);
        summary.photosStored += stored.length;
        console.log(`· ${s.name} 사진 ${stored.length}장 완료`);
      } else {
        summary.failed++;
      }
    } catch (e) {
      summary.failed++;
      console.warn(`  실패 [${s.name}]: ${String(e)}`);
    }
    await sleep(300); // 레이트리밋 여유
  }

  console.log(`\n=== Google 사진 ${dry ? "매칭(dry)" : "적재"} 완료 ===`);
  console.log(`API 호출: SearchText ${usedSearch} / 예산 ${searchBudget}, PhotoMedia ${usedPhoto} / 예산 ${photoBudget}`);
  console.table(summary);
}

main().catch((e) => {
  console.error("crawl:google 실패:", e);
  process.exit(1);
});
