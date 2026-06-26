/**
 * BathApiItem → SaunaUpsertRow (공공 컬럼만).
 * 에디터 시딩 컬럼(온도/세신/노천/가격/썸네일/소개 등)은 생성하지 않는다
 * → upsert 시 건드리지 않아 에디터 입력값이 보존된다.
 */
import type { BathApiItem, SaunaUpsertRow } from "./types";
import { tmToWgs84, toEwkt } from "./projection";

const JJIMJIL_RE = /찜질|불가마|한증|숯가마|맥반석/;
const HOT_SPRING_RE = /온천|해수|유황|약수/;
const H24_RE = /24시|24h|24時/i;

/** 지번/도로명 주소에서 sido·sigungu·dong 분해. */
function parseRegion(item: BathApiItem): {
  address: string | null;
  sido: string | null;
  sigungu: string | null;
  dong: string | null;
} {
  const road = (item.ROAD_NM_ADDR ?? "").trim();
  const lotno = (item.LOTNO_ADDR ?? "").trim();
  const address = road || lotno || null;

  // 동/읍/면이 들어있는 지번주소를 지역 분해에 우선 사용.
  const forParse = (lotno || road).trim();
  const tok = forParse.split(/\s+/).filter(Boolean);

  const sido = tok[0] ?? null;
  let sigungu: string | null = tok[1] ?? null;
  // 특례시 자치구: "고양시 덕양구" 처럼 시 + 구를 함께.
  if (tok[2] && /구$/.test(tok[2]) && /시$/.test(tok[1] ?? "")) {
    sigungu = `${tok[1]} ${tok[2]}`;
  }
  const dong = tok.find((t) => /(동|읍|면|가|리)$/.test(t)) ?? null;

  return { address, sido, sigungu, dong };
}

/** 공백/특수문자 정리해 slug base 생성(한글 유지). */
function slugify(s: string): string {
  return s
    .normalize("NFC")
    .replace(/\(주\)|\(유\)|\(재\)/g, "")
    .toLowerCase()
    .replace(/[^0-9a-z가-힣]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function mapBathToSauna(item: BathApiItem, needsReview = false): SaunaUpsertRow {
  const { address, sido, sigungu, dong } = parseRegion(item);
  const name = (item.BPLC_NM ?? "").trim();
  const sweat = (item.SWEATRM_YN ?? "").trim() === "Y";
  const bzstat = item.BZSTAT_SE_NM ?? "";

  const is_jjimjilbang =
    sweat || /찜질|한증/.test(bzstat) || JJIMJIL_RE.test(name);
  const is_hot_spring = HOT_SPRING_RE.test(name) || HOT_SPRING_RE.test(address ?? "");
  const is_24h = H24_RE.test(name);

  const loc = tmToWgs84(item.CRD_INFO_X, item.CRD_INFO_Y);

  const open_date = (item.LCPMT_YMD ?? "").trim() || null;
  const phone = (item.TELNO ?? "").trim() || null;

  // slug base — 지역+상호. 전역 유일성은 assignSlugs 에서 확정.
  const base = slugify([sigungu, name].filter(Boolean).join("-")) || "sauna";

  return {
    license_no: (item.MNG_NO ?? "").trim(),
    name,
    address,
    sido,
    sigungu,
    dong,
    location: toEwkt(loc),
    status: (item.SALS_STTS_NM ?? "").trim() || null,
    closed_date: null, // 영업중만 매핑되므로 항상 null(재오픈 시 폐업 마킹 해제)
    phone,
    open_date,
    is_jjimjilbang,
    is_hot_spring,
    is_24h,
    needs_review: needsReview,
    slug: base,
  };
}

/**
 * slug 전역 유일화. rows[].slug(=base)를 used 집합과 충돌하지 않게 -2,-3… 부여.
 * @param used 이미 사용 중인 slug(증분 동기화 시 DB 기존값). 초기적재는 빈 집합.
 */
export function assignSlugs(rows: SaunaUpsertRow[], used: Set<string> = new Set()): void {
  for (const row of rows) {
    let slug = row.slug;
    let n = 2;
    while (used.has(slug)) slug = `${row.slug}-${n++}`;
    used.add(slug);
    row.slug = slug;
  }
}
