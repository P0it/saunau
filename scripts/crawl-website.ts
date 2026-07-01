/**
 * 업체 공식 사이트 사진 백필 (수동/일회성).  robots.txt 존중하며 사이트 사진을
 * 우리 Storage(WebP)로 재호스팅한다. 출처표기 + takedown(is_active) 전제.
 *
 *   pnpm crawl:website -- --with-blogs --limit 200          # 블로그 있는 매장 우선
 *   pnpm crawl:website -- --limit 50 --photos 4
 *   pnpm crawl:website -- --limit 10 --dry                   # 사이트/이미지 수만 출력
 *
 * 사이트 주소는 saunas.website_url 을 우선 사용(무료). 없으면 Google searchPlace 로
 * 해석(검색 1회 과금 — 예산 하드캡 적용). 해석된 website_url 은 저장해 재사용한다.
 *
 * 사전: 0006(website 출처/website_url) 적용. (해석 쓰려면 GOOGLE_MAPS_API_KEY)
 * 재개 가능: 이미 website 사진 있으면 스킵(--force 무시).
 */
import { config } from "dotenv";
import { getAdminClient } from "../lib/supabase/admin";
import { searchPlace } from "../lib/ingest/google/places";
import { extractSiteImages } from "../lib/ingest/website/scrape";
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

async function blogSaunaIds(supabase: ReturnType<typeof getAdminClient>) {
  const ids = new Set<string>();
  for (let from = 0; ; from += 1000) {
    const { data } = await supabase
      .from("sauna_blog_reviews")
      .select("sauna_id")
      .range(from, from + 999);
    if (!data?.length) break;
    data.forEach((r) => ids.add(r.sauna_id as string));
    if (data.length < 1000) break;
  }
  return [...ids];
}

async function main() {
  const limit = Number(arg("limit") ?? "50");
  const maxPhotos = Number(arg("photos") ?? "4");
  const dry = flag("dry");
  const force = flag("force");
  const withBlogs = flag("with-blogs");
  const gallery = flag("gallery"); // 대표사진 외 콘텐츠 <img>까지(검수 권장)
  const searchBudget = Number(arg("maxsearch") ?? "1000"); // 사이트주소 해석용 Google 검색 하드캡
  let usedSearch = 0;

  const supabase = getAdminClient();
  const key = process.env.GOOGLE_MAPS_API_KEY ?? null;

  // 후보: 영업중 + 검수통과. --with-blogs 면 블로그 보유분만.
  let saunas: Array<{
    id: string;
    name: string;
    address: string | null;
    website_url: string | null;
  }> = [];
  if (withBlogs) {
    const ids = await blogSaunaIds(supabase);
    for (let i = 0; i < ids.length && saunas.length < limit * 3; i += 200) {
      const { data, error } = await supabase
        .from("saunas")
        .select("id, name, address, website_url")
        .in("id", ids.slice(i, i + 200))
        .eq("status", "영업/정상")
        .eq("needs_review", false);
      if (error) throw new Error(`대상 조회 실패: ${error.message}`);
      saunas.push(...(data ?? []));
    }
  } else {
    const { data, error } = await supabase
      .from("saunas")
      .select("id, name, address, website_url")
      .eq("status", "영업/정상")
      .eq("needs_review", false)
      .order("open_date", { ascending: false, nullsFirst: false })
      .limit(limit * 3);
    if (error) throw new Error(`대상 조회 실패: ${error.message}`);
    saunas = data ?? [];
  }

  const summary = {
    targeted: 0,
    hadUrl: 0,
    resolved: 0,
    noSite: 0,
    photosStored: 0,
    skipped: 0,
    failed: 0,
  };

  let processed = 0;
  for (const s of saunas) {
    if (processed >= limit) break;

    if (!force) {
      const { count } = await supabase
        .from("sauna_photos")
        .select("id", { count: "exact", head: true })
        .eq("sauna_id", s.id)
        .eq("source", "website");
      if ((count ?? 0) > 0) {
        summary.skipped++;
        continue;
      }
    }
    processed++;
    summary.targeted++;

    try {
      // 사이트 주소 확보: 저장된 website_url 우선(무료), 없으면 Google 해석(예산 내).
      let site = s.website_url;
      if (site) {
        summary.hadUrl++;
      } else if (key && usedSearch < searchBudget) {
        usedSearch++;
        const match = await searchPlace(s.name, s.address, key);
        site = match?.websiteUri ?? null;
        if (site) {
          summary.resolved++;
          await supabase
            .from("saunas")
            .update({ website_url: site })
            .eq("id", s.id);
        }
      }
      if (!site) {
        summary.noSite++;
        await sleep(150);
        continue;
      }

      const refs = await extractSiteImages(site, maxPhotos, gallery);
      if (dry) {
        console.log(`· ${s.name} → ${site} | 이미지 ${refs.length}장`);
        await sleep(150);
        continue;
      }
      if (!refs.length) {
        summary.noSite++;
        await sleep(150);
        continue;
      }

      const stored = [];
      for (let i = 0; i < refs.length; i++) {
        const sp = await downloadToStorage(supabase, s.id, `w-${i}`, refs[i]);
        if (sp) stored.push(sp);
      }
      if (stored.length) {
        await saveCrawledPhotos(supabase, s.id, stored, "website");
        // website(=google 동순위)이라, 이미 대표썸네일 있으면 보존됨.
        await setRepresentativeThumb(supabase, s.id, stored[0].url, "website");
        summary.photosStored += stored.length;
        console.log(`· ${s.name} 사이트 사진 ${stored.length}장 완료`);
      } else {
        summary.failed++;
      }
    } catch (e) {
      summary.failed++;
      console.warn(`  실패 [${s.name}]: ${String(e)}`);
    }
    await sleep(300);
  }

  console.log(`\n=== 사이트 사진 ${dry ? "탐색(dry)" : "적재"} 완료 ===`);
  console.log(`Google 검색(주소해석): ${usedSearch} / 예산 ${searchBudget}`);
  console.table(summary);
}

main().catch((e) => {
  console.error("crawl:website 실패:", e);
  process.exit(1);
});
