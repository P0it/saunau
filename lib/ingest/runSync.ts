/**
 * 적재/동기화 공용 러너. 초기적재 스크립트와 cron 라우트가 함께 쓴다.
 *  1) 목욕장업 전수 페치 → 필터 → 매핑 → slug 확정 → saunas upsert(license_no)
 *  2) 온천 페치 → 매핑 → hot_springs upsert(name,sigungu)
 *  3) 교차링크 RPC (is_hot_spring/verified_hot_spring 보강)
 * 에디터 시딩 컬럼은 매핑에 없으므로 upsert가 보존한다.
 * 교차링크는 항상 upsert 뒤에 실행 → 키워드 재계산이 인증 플래그를 덮어쓰지 않음.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllBaths, type FetchProgress } from "./fetchBaths";
import { classify } from "./filter";
import { mapBathToSauna, assignSlugs } from "./mapToSauna";
import { geocodeAddress } from "./geocode";
import { toEwkt } from "./projection";
import { fetchAllHotSprings } from "./hotsprings/fetch";
import { mapHotSpring } from "./hotsprings/map";
import { linkVerifiedHotSprings } from "./crossLink";
import type { SaunaUpsertRow } from "./types";

const CHUNK = 500;

export interface SyncSummary {
  fetched: number;
  excludedNotOperating: number;
  excludedNonBath: number;
  reviewFlagged: number; // 적재했지만 needs_review(노출 보류)
  geocoded: number;
  saunasUpserted: number;
  closedMarked: number; // 영업→폐업/휴업 전환 마킹(삭제 안 함, 찜·방문 보존)
  hotSpringsUpserted: number;
  verifiedLinked: number;
}

const OPERATING_CODE = "01";

export interface FreshStatus {
  cd: string;
  nm: string | null;
  closed: string | null;
}
export interface Closure {
  license_no: string;
  status: string | null;
  closed_date: string | null;
}

/** 전체 raw 에서 license_no → 최신 상태 맵. 폐업 전환 감지에 사용. */
function buildFreshStatus(
  raw: { MNG_NO?: string | null; SALS_STTS_CD?: string | null; SALS_STTS_NM?: string | null; CLSBIZ_YMD?: string | null }[],
): Map<string, FreshStatus> {
  const m = new Map<string, FreshStatus>();
  for (const it of raw) {
    const lic = (it.MNG_NO ?? "").trim();
    if (!lic) continue;
    m.set(lic, {
      cd: (it.SALS_STTS_CD ?? "").trim(),
      nm: (it.SALS_STTS_NM ?? "").trim() || null,
      closed: (it.CLSBIZ_YMD ?? "").trim() || null,
    });
  }
  return m;
}

/**
 * 폐업 전환 대상 계산(순수 함수).
 * 규칙: 최신 데이터가 비영업(코드≠01)이고, 저장된 status 가 최신값과 다르면 갱신 대상.
 *  - 최신 데이터에 license 자체가 없으면 건드리지 않음(부분 페치 오탐 방지).
 *  - 영업중(코드=01)은 upsert 가 처리하므로 제외.
 */
export function computeClosures(
  existingStatusByLicense: Map<string, string | null>,
  freshStatus: Map<string, FreshStatus>,
): Closure[] {
  const closures: Closure[] = [];
  for (const [license, dbStatus] of existingStatusByLicense) {
    const fresh = freshStatus.get(license);
    if (!fresh || fresh.cd === OPERATING_CODE) continue;
    if (dbStatus !== fresh.nm) {
      closures.push({ license_no: license, status: fresh.nm, closed_date: fresh.closed });
    }
  }
  return closures;
}

export interface SyncOptions {
  apiKey: string;
  geocodeMissing?: boolean; // 좌표 결측 행 카카오 지오코딩(KAKAO_REST_API_KEY 필요)
  onLog?: (msg: string) => void;
  onFetchProgress?: FetchProgress;
}

async function upsertChunked<T extends object>(
  supabase: SupabaseClient,
  table: string,
  rows: T[],
  onConflict: string,
): Promise<number> {
  let count = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const { error } = await supabase
      .from(table)
      .upsert(chunk, { onConflict, ignoreDuplicates: false });
    if (error) throw new Error(`${table} upsert 실패 [${i}-${i + chunk.length}]: ${error.message}`);
    count += chunk.length;
  }
  return count;
}

export async function runSync(
  supabase: SupabaseClient,
  opts: SyncOptions,
): Promise<SyncSummary> {
  const log = opts.onLog ?? (() => {});
  const summary: SyncSummary = {
    fetched: 0,
    excludedNotOperating: 0,
    excludedNonBath: 0,
    reviewFlagged: 0,
    geocoded: 0,
    saunasUpserted: 0,
    closedMarked: 0,
    hotSpringsUpserted: 0,
    verifiedLinked: 0,
  };

  // ── 1) 목욕장업 ─────────────────────────────
  log("목욕장업 페치 시작…");
  const raw = await fetchAllBaths(opts.apiKey, opts.onFetchProgress);
  summary.fetched = raw.length;
  const freshStatus = buildFreshStatus(raw); // 폐업 전환 감지용(전체 상태)

  const rows: SaunaUpsertRow[] = [];
  for (const item of raw) {
    const { action, reason } = classify(item);
    if (action === "exclude") {
      if (reason === "not_operating") summary.excludedNotOperating++;
      else summary.excludedNonBath++;
      continue;
    }
    const needsReview = action === "review";
    if (needsReview) summary.reviewFlagged++;
    rows.push(mapBathToSauna(item, needsReview));
  }
  log(
    `필터: 적재 ${rows.length}(검수보류 ${summary.reviewFlagged}) / 폐업·비영업 ${summary.excludedNotOperating} / 비목욕 제외 ${summary.excludedNonBath}`,
  );

  // 좌표 결측 폴백(선택)
  if (opts.geocodeMissing) {
    for (const row of rows) {
      if (row.location || !row.address) continue;
      const p = await geocodeAddress(row.address);
      if (p) {
        row.location = toEwkt(p);
        summary.geocoded++;
      }
    }
    if (summary.geocoded) log(`지오코딩 폴백: ${summary.geocoded}건 보강`);
  }

  // 기존 saunas 조회(slug 재사용 + 폐업 전환 감지용 status).
  // PostgREST 기본 1000행 상한 → range 페이지네이션으로 전수 조회.
  const existingSlugByLicense = new Map<string, string>();
  const existingStatusByLicense = new Map<string, string | null>();
  const existingReviewByLicense = new Map<string, boolean>();
  const usedSlugs = new Set<string>();
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("saunas")
      .select("license_no, slug, status, needs_review")
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`기존 saunas 조회 실패: ${error.message}`);
    for (const r of data ?? []) {
      if (r.slug) usedSlugs.add(r.slug);
      if (r.license_no) {
        if (r.slug) existingSlugByLicense.set(r.license_no, r.slug);
        existingStatusByLicense.set(r.license_no, r.status ?? null);
        existingReviewByLicense.set(r.license_no, Boolean(r.needs_review));
      }
    }
    if (!data || data.length < PAGE) break;
  }
  const newRows: SaunaUpsertRow[] = [];
  for (const row of rows) {
    if (existingReviewByLicense.has(row.license_no)) {
      // 기존 행: URL(slug)·검수결정(needs_review)을 보존(동기화가 덮어쓰지 않음).
      const prevSlug = existingSlugByLicense.get(row.license_no);
      if (prevSlug) row.slug = prevSlug;
      row.needs_review = existingReviewByLicense.get(row.license_no)!;
    } else {
      newRows.push(row); // 신규 행
    }
  }
  assignSlugs(newRows, usedSlugs); // 신규만 충돌 회피 부여

  log("saunas upsert…");
  summary.saunasUpserted = await upsertChunked(supabase, "saunas", rows, "license_no");

  // ── 1b) 폐업 전환 마킹 ─────────────────────────
  // 기존 DB행 중 최신 데이터가 비영업(코드≠01)인데 저장된 status가 다르면 폐업/휴업으로 갱신.
  // 삭제하지 않음 → 찜(localStorage id)·방문(FK) 보존, 상세/찜에서 '운영 종료' 표시 가능.
  // 최신 데이터에 license 자체가 없으면(부분 페치 가능성) 건드리지 않는다(오탐 방지).
  const closures = computeClosures(existingStatusByLicense, freshStatus);
  for (const c of closures) {
    const { error } = await supabase
      .from("saunas")
      .update({ status: c.status, closed_date: c.closed_date })
      .eq("license_no", c.license_no);
    if (error) throw new Error(`폐업 마킹 실패(${c.license_no}): ${error.message}`);
    summary.closedMarked++;
  }
  if (summary.closedMarked) log(`폐업/휴업 전환 마킹: ${summary.closedMarked}건(행 유지)`);

  // ── 2) 온천표준데이터 ─────────────────────────
  log("온천표준데이터 페치…");
  const springs = (await fetchAllHotSprings(opts.apiKey))
    .map(mapHotSpring)
    .filter((s) => s.name);
  summary.hotSpringsUpserted = await upsertChunked(
    supabase,
    "hot_springs",
    springs,
    "name,sigungu",
  );
  log(`hot_springs upsert: ${summary.hotSpringsUpserted}`);

  // ── 3) 교차링크 ───────────────────────────────
  summary.verifiedLinked = await linkVerifiedHotSprings(supabase);
  log(`교차링크: 진짜 온천 인증 ${summary.verifiedLinked}건`);

  return summary;
}
