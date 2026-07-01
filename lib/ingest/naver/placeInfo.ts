/**
 * 네이버 플레이스 "기본정보" 수집 (영업시간·전화·편의시설·placeId).  **사진과 다른 경로.**
 *
 * ⚠ 성격: pcmap.place.naver.com 의 SSR 페이지(`window.__APOLLO_STATE__`)에서 사실 데이터만
 *   읽는다. 저작물(사진/리뷰본문)이 아니라 **사실 정보**(영업시간/전화/주차여부/좌표)다.
 *   사진 수집을 막던 map.naver.com 의 ncaptcha 와 달리 이 list/home 엔드포인트는 캡차 없이
 *   응답한다(라이브 검증). 그래도 비공식이라 best-effort: 구조 불일치/차단 시 빈 결과를 반환해
 *   파이프라인을 막지 않는다.
 *
 * 영업시간 한계(정직히):
 *  - 24시간 매장: list 의 newBusinessHours.status="24시간 영업" 으로 **안정적** 판정/저장.
 *  - 그 외: list 값은 "영업 중" / "22:00에 영업 종료" 처럼 **실시간/부분 정보**라 저장 부적합.
 *    상세(home)도 목욕탕 업종은 isBizHourMissing=true(네이버 미보유)가 흔하다.
 *    → 풀 스케줄이 확인될 때만 채우고, 아니면 비워 둔다(부정확 데이터 삽입 금지).
 */

const LIST_ENDPOINT = "https://pcmap.place.naver.com/place/list";
const HOME_ENDPOINT = "https://pcmap.place.naver.com/place";

// 표준 브라우저 헤더(차단 회피용 표준 헤더; 우회/위장 목적 아님).
const BROWSER_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8",
  Referer: "https://pcmap.place.naver.com/",
};

/** list 에서 뽑은 후보 1건(사실 데이터만). */
export interface NaverPlaceCandidate {
  placeId: string;
  name: string;
  category: string | null;
  phone: string | null;
  virtualPhone: string | null;
  roadAddress: string | null;
  fullAddress: string | null;
  lat: number | null;
  lng: number | null;
  /** 24시간 영업 여부(status 기반, 안정적). */
  is24h: boolean;
  /** newBusinessHours.status — 진단/로깅용(실시간 값일 수 있어 저장 금지). */
  hoursStatus: string | null;
  /** newBusinessHours.description — 예: "연중무휴", "22:00에 영업 종료". */
  hoursDescription: string | null;
}

/** 요금표 항목 1개(네이버 Menu 노드). price=숫자 파싱 성공, priceText=비정형("변동" 등). */
export interface PriceItem {
  name: string; // 예: "성인(7세 이상)", "대인 목욕 (주간)"
  price: number | null; // 원 단위 숫자(파싱 가능할 때)
  priceText: string | null; // 숫자 아님(예: "시가","변동")일 때 원문
}

/** home(상세)에서 추가로 얻는 사실 데이터. */
export interface NaverPlaceDetail {
  conveniences: string[]; // 편의시설 예: ["주차","무선 인터넷","남/녀 화장실 구분"]
  phone: string | null;
  virtualPhone: string | null;
  /** 상세 PlaceDetailBase.openingHours 기반(목욕탕은 대개 null). 요일별은 weekHours 사용. */
  hoursText: string | null;
  /** 요일별 영업시간(newBusinessHours 배열 파싱). 시간정보 없으면 null. */
  weekHours: WeekHours | null;
  /** 요금표(Menu 노드). 가격 탭 미작성이면 빈 배열. */
  priceList: PriceItem[];
  /** 대표 입장료(대인/성인). 명확한 성인 입장가 없으면 null. */
  price: number | null;
}

/** list/home 호출 결과. blocked=캡차/차단/구조불일치(스킵마커 찍지 말 것). */
export interface NaverFetchResult<T> {
  data: T;
  blocked: boolean;
}

type ApolloState = Record<string, Record<string, unknown>>;

/**
 * `window.__APOLLO_STATE__ = {...};` 를 문자열-인식 중괄호 매칭으로 안전 추출.
 * (리뷰 본문에 들어간 "</script>" 같은 문자열에 깨지지 않도록 정규식 대신 스캐너 사용.)
 */
function extractApolloState(html: string): ApolloState | null {
  const mi = html.indexOf("window.__APOLLO_STATE__");
  if (mi < 0) return null;
  const eq = html.indexOf("=", mi);
  if (eq < 0) return null;
  const start = html.indexOf("{", eq);
  if (start < 0) return null;

  let depth = 0;
  let inStr = false;
  let esc = false;
  let end = -1;
  for (let i = start; i < html.length; i++) {
    const c = html[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }
  if (end < 0) return null;
  try {
    return JSON.parse(html.slice(start, end)) as ApolloState;
  } catch {
    return null;
  }
}

function num(v: unknown): number | null {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : null;
}
function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/** list 페이지 → 후보 배열. blocked=캡차/구조불일치(후보 0 과 구분). */
export async function fetchPlaceCandidates(
  query: string,
): Promise<NaverFetchResult<NaverPlaceCandidate[]>> {
  let html: string;
  try {
    const url = `${LIST_ENDPOINT}?query=${encodeURIComponent(query)}`;
    const r = await fetch(url, { headers: BROWSER_HEADERS });
    if (!r.ok) return { data: [], blocked: true };
    html = await r.text();
  } catch {
    return { data: [], blocked: true };
  }

  const state = extractApolloState(html);
  if (!state) {
    // 캡차/차단(ncaptcha) 또는 구조 변경 → blocked 로 표시(스킵마커 금지).
    return { data: [], blocked: true };
  }

  const out: NaverPlaceCandidate[] = [];
  for (const [key, node] of Object.entries(state)) {
    if (!key.startsWith("PlaceListBusinessesItem")) continue;
    const id = str(node.id);
    const name = str(node.name);
    if (!id || !name) continue;

    const nb = node.newBusinessHours as
      | { status?: unknown; description?: unknown }
      | null
      | undefined;
    const status = str(nb?.status);

    out.push({
      placeId: id,
      name,
      category: str(node.category),
      phone: str(node.phone),
      virtualPhone: str(node.virtualPhone),
      roadAddress: str(node.roadAddress),
      fullAddress: str(node.fullAddress),
      lng: num(node.x),
      lat: num(node.y),
      is24h: status === "24시간 영업",
      hoursStatus: status,
      hoursDescription: str(nb?.description),
    });
  }
  // apollo state 는 있는데 후보가 0 → 진짜 검색결과 없음(차단 아님).
  return { data: out, blocked: false };
}

// ── 요일별 영업시간(newBusinessHours 배열) ───────────────────────────────────
// 네이버 /home SSR 의 nested "newBusinessHours":[{ businessHours:[{day,start,end}] }] 를
// 정규 apollo 그래프 탐색 없이 문자열-검색 + 괄호매칭으로 안전 추출한다(스키마 변동 견고).

const DAY_ORDER = ["월", "화", "수", "목", "금", "토", "일"] as const;
const DAY_KEY: Record<string, DayKey> = {
  월: "mon", 화: "tue", 수: "wed", 목: "thu", 금: "fri", 토: "sat", 일: "sun",
};

export type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export interface DayHours {
  start: string; // "09:00"
  end: string; // "21:00"
  overnight: boolean; // 종료가 익일(자정 넘김)
  break: string | null; // "13:30~15:00" (브레이크타임)
  note: string | null; // per-day 비고
}

export interface WeekHours {
  is24h: boolean;
  days: Record<DayKey, DayHours | null>; // null = 해당 요일 휴무
  summary: string; // 사람이 읽는 한 줄(요약). hours(text) 컬럼에 그대로 저장.
}

/** '[' 또는 '{' 위치부터 문자열-인식 괄호매칭으로 값 1개를 캡처. */
function captureBracket(html: string, startIdx: number): string | null {
  const open = html[startIdx];
  const close = open === "[" ? "]" : "}";
  let depth = 0, inStr = false, esc = false;
  for (let i = startIdx; i < html.length; i++) {
    const c = html[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === open) depth++;
    else if (c === close) {
      depth--;
      if (depth === 0) return html.slice(startIdx, i + 1);
    }
  }
  return null;
}

interface RawWorkingHours {
  day?: string;
  businessHours?: { start?: string; end?: string } | null;
  breakHours?: Array<{ start?: string; end?: string }> | null;
  description?: string | null;
  showEndsNextDay?: boolean | null;
}
interface RawNewBusinessHour {
  name?: string;
  businessStatusDescription?: { status?: string; description?: string } | null;
  businessHours?: RawWorkingHours[] | null;
}

/**
 * /home HTML → 요일별 영업시간(WeekHours). 시간정보 없으면 null.
 * - 24시간: is24h=true, days 전부 null, summary="24시간 영업…".
 * - 일부 요일만 영업: 누락 요일은 휴무(null).
 * - 전 요일 null & 24h 아님(예약제 등 미보유): **null 반환**(휴무로 오인 금지).
 */
export function parseDayHours(html: string): WeekHours | null {
  const key = '"newBusinessHours":';
  let idx = html.indexOf(key);
  let arr: RawNewBusinessHour[] | null = null;
  while (idx >= 0) {
    const vs = idx + key.length;
    if (html[vs] === "[") {
      // 배열 형태(상세). 리스트 엔드포인트의 객체 형태({status,…})는 건너뜀.
      const raw = captureBracket(html, vs);
      if (raw) {
        try {
          arr = JSON.parse(raw) as RawNewBusinessHour[];
        } catch {
          arr = null;
        }
      }
      break;
    }
    idx = html.indexOf(key, idx + 1);
  }
  if (!Array.isArray(arr) || arr.length === 0) return null;

  // 이름 없는/"기본" 엔트리 우선(성별·시즌 분리 케이스에서 대표 시간).
  const entry = arr.find((e) => !e.name || e.name === "기본") ?? arr[0];
  const status = entry.businessStatusDescription?.status ?? null;
  const is24h = status === "24시간 영업";

  const days: Record<DayKey, DayHours | null> = {
    mon: null, tue: null, wed: null, thu: null, fri: null, sat: null, sun: null,
  };
  let anyDay = false;
  for (const wh of entry.businessHours ?? []) {
    const k = wh.day ? DAY_KEY[wh.day] : undefined;
    if (!k) continue;
    const t = wh.businessHours;
    if (t?.start && t?.end) {
      anyDay = true;
      days[k] = {
        start: t.start,
        end: t.end,
        overnight: !!wh.showEndsNextDay,
        break:
          (wh.breakHours ?? [])
            .filter((b) => b.start && b.end)
            .map((b) => `${b.start}~${b.end}`)
            .join(", ") || null,
        note: wh.description?.trim() || null,
      };
    }
  }

  // 24h 도 아니고 어떤 요일도 시간이 없으면 = 시간정보 미보유 → null(휴무 아님).
  if (!is24h && !anyDay) return null;

  return {
    is24h,
    days,
    summary: buildSummary(is24h, days, entry.businessStatusDescription?.description ?? null),
  };
}

/** WeekHours → 한 줄 요약. 연속 동일시간 요일을 묶는다(예: "수~일 11:30~22:00"). */
function buildSummary(
  is24h: boolean,
  days: Record<DayKey, DayHours | null>,
  desc24h: string | null,
): string {
  if (is24h) return desc24h ? `24시간 영업 (${desc24h})` : "24시간 영업";

  const fmt = (d: DayHours | null) =>
    d
      ? `${d.start}~${d.end}${d.overnight ? "(익일)" : ""}${d.break ? ` (브레이크 ${d.break})` : ""}`
      : "휴무";

  const parts: string[] = [];
  let run: Array<{ ko: string; txt: string }> = [];
  const flush = () => {
    if (!run.length) return;
    const label =
      run.length === 1 ? run[0].ko : `${run[0].ko}~${run[run.length - 1].ko}`;
    parts.push(`${label} ${run[0].txt}`);
    run = [];
  };
  for (const ko of DAY_ORDER) {
    const txt = fmt(days[DAY_KEY[ko]]);
    if (run.length && run[0].txt === txt) run.push({ ko, txt });
    else {
      flush();
      run = [{ ko, txt }];
    }
  }
  flush();
  return parts.join(" · ");
}

// ── 요금표(Menu 노드) ────────────────────────────────────────────────────────
// 상세 SSR 의 top-level apollo 키 "Menu:{placeId}_{n}":{name,price,…} 를 raw 문자열에서 캡처.
// (가격 탭 미작성 매장은 노드 없음 → 빈 배열. 블로그 후기 본문 금액과 혼동되지 않게 Menu 노드만.)

interface RawMenu {
  __typename?: string;
  name?: string;
  price?: string | number;
}

/** /home HTML → 요금표 항목 배열. 가격 미보유면 빈 배열. */
export function parsePriceList(html: string): PriceItem[] {
  const items: PriceItem[] = [];
  const seen = new Set<string>();
  let from = 0;
  for (;;) {
    const k = html.indexOf('"Menu:', from);
    if (k < 0) break;
    const keyEnd = html.indexOf('"', k + 1);
    const braceStart = keyEnd >= 0 ? html.indexOf("{", keyEnd) : -1;
    if (braceStart < 0) break;
    const raw = captureBracket(html, braceStart);
    from = raw ? braceStart + raw.length : k + 6;
    if (!raw) continue;
    let o: RawMenu;
    try {
      o = JSON.parse(raw) as RawMenu;
    } catch {
      continue;
    }
    if (o.__typename !== "Menu") continue;
    const name = (o.name ?? "").toString().trim();
    if (!name) continue;
    const priceRaw = (o.price ?? "").toString().trim();
    const num = /^\d[\d,]*$/.test(priceRaw) ? Number(priceRaw.replace(/,/g, "")) : null;
    const dedupe = `${name}|${priceRaw}`;
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    items.push({ name, price: num, priceText: num == null ? priceRaw || null : null });
  }
  return items;
}

// 대표 입장료 추출용 분류 정규식. (순서: 제외 먼저, 그다음 입장 항목 매칭)
// 패키지/회차권/쿠폰/체험 — 1회 입욕료가 아님(프리마스파 "쿠폰 10+2 SET" 같은 것).
const PRICE_PACKAGE =
  /쿠폰|세트|패키지|회원|정기|개월|이용권|할인|묶음|선불|충전|체험|첫방문|회차|\bset\b|\d+\s*회|\d+회권|\d+\s*\+\s*\d+/i;
// 부가 서비스 — 입욕 본요금이 아님.
const PRICE_ADDON =
  /휘트니스|피트니스|헬스|마사지|세신|때밀이|대여|찜질복|가운|락커|사물함|타올|수건|음료|식혜|계란|간식|식사|추가|네일|이발|머리/;
// 비-성인(별도 요금) — 대표가에서 제외.
const PRICE_NON_ADULT = /소인|경로|학생|유아|아동|어린이|청소년|군경|장애|단체|동반/;
// 1회 입욕/입장 항목.
const PRICE_ENTRY = /대인|성인|어른|일반|입장|입욕|목욕|찜질|사우나|온천|스파/;

/**
 * 요금표에서 **대표 입장료(성인 1회)** 1개. 명확하지 않으면 null.
 * 패키지/회차권/쿠폰/부가서비스/비성인을 걸러낸 "1회 입욕" 항목 중 **최저가**(= 기본 입장료, "~부터").
 */
export function representativePrice(items: PriceItem[]): number | null {
  const priced = items.filter((i) => i.price != null && i.price > 0) as Array<
    PriceItem & { price: number }
  >;
  if (!priced.length) return null;

  const clean = (i: { name: string }) =>
    !PRICE_PACKAGE.test(i.name) &&
    !PRICE_ADDON.test(i.name) &&
    !PRICE_NON_ADULT.test(i.name);

  // 1) 1회 입욕/입장 항목 중 최저가(기본요금).
  const entries = priced.filter((i) => clean(i) && PRICE_ENTRY.test(i.name));
  if (entries.length) return Math.min(...entries.map((i) => i.price));

  // 2) 입장 키워드는 없지만 패키지/부가가 아닌 항목이 딱 하나면 그게 입장료.
  const singles = priced.filter(clean);
  if (singles.length === 1) return singles[0].price;
  return null;
}

/** home(상세) → 편의시설 + 요금표 + 보강 전화/영업시간(best-effort). */
export async function fetchPlaceDetail(
  placeId: string,
): Promise<NaverFetchResult<NaverPlaceDetail | null>> {
  let html: string;
  try {
    const r = await fetch(`${HOME_ENDPOINT}/${encodeURIComponent(placeId)}/home`, {
      headers: BROWSER_HEADERS,
    });
    if (!r.ok) return { data: null, blocked: true };
    html = await r.text();
  } catch {
    return { data: null, blocked: true };
  }

  // 요일별·요금표는 정규 apollo 그래프가 아니라 raw HTML 에서 추출(견고).
  const weekHours = parseDayHours(html);
  const priceList = parsePriceList(html);
  const price = representativePrice(priceList);

  const state = extractApolloState(html);
  if (!state) return { data: null, blocked: true };

  const base = Object.entries(state).find(([k]) =>
    k.startsWith("PlaceDetailBase"),
  )?.[1];
  if (!base)
    return {
      data: {
        conveniences: [],
        phone: null,
        virtualPhone: null,
        hoursText: null,
        weekHours,
        priceList,
        price,
      },
      blocked: false,
    };

  const conveniences = Array.isArray(base.conveniences)
    ? (base.conveniences as unknown[]).map((c) => str(c)).filter((c): c is string => !!c)
    : [];

  return {
    data: {
      conveniences,
      phone: str(base.phone),
      virtualPhone: str(base.virtualPhone),
      hoursText: formatStructuredHours(base.openingHours),
      weekHours,
      priceList,
      price,
    },
    blocked: false,
  };
}

/**
 * 상세의 구조화 영업시간(openingHours)을 텍스트로. 목욕탕 업종은 대개 null 이라
 * best-effort: 인식 가능한 모양일 때만 채우고, 아니면 null(부정확 삽입 금지).
 */
function formatStructuredHours(openingHours: unknown): string | null {
  if (!Array.isArray(openingHours) || openingHours.length === 0) return null;
  const parts: string[] = [];
  for (const h of openingHours as Array<Record<string, unknown>>) {
    const day = str(h.day) ?? str(h.dayOfWeek);
    const start = str(h.startTime) ?? str(h.businessHours);
    const end = str(h.endTime);
    if (day && start && end) parts.push(`${day} ${start}~${end}`);
    else if (day && start) parts.push(`${day} ${start}`);
  }
  return parts.length ? parts.join(", ") : null;
}

/** is_24h 일 때만 안정적 영업시간 텍스트를 만든다. 아니면 null. */
export function stableHoursText(c: NaverPlaceCandidate): string | null {
  if (!c.is24h) return null;
  // description 예: "연중무휴". 군더더기(영업 종료 안내 등)는 24h 엔 안 붙음.
  return c.hoursDescription
    ? `24시간 영업 (${c.hoursDescription})`
    : "24시간 영업";
}

// ── 매칭 ──────────────────────────────────────────────────────────────────

const GENERIC_TOKENS = [
  "24시간",
  "24시",
  "사우나",
  "찜질방",
  "불가마",
  "한증막",
  "스파",
  "온천",
  "목욕탕",
  "목욕",
  "휘트니스",
  "피트니스",
  "헬스",
  "랜드",
  "월드",
  "타워",
  "점",
];

function normalizeName(s: string): string {
  return (s ?? "")
    .toLowerCase()
    .replace(/\(.*?\)/g, "")
    .replace(/[^\p{L}\p{N}]/gu, "");
}
function coreName(s: string): string {
  let n = normalizeName(s);
  for (const g of GENERIC_TOKENS) n = n.split(g).join("");
  return n;
}

/** 2-gram Jaccard 유사도(0~1). */
function bigramSim(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const grams = (s: string) => {
    const set = new Set<string>();
    if (s.length < 2) set.add(s);
    else for (let i = 0; i < s.length - 1; i++) set.add(s.slice(i, i + 2));
    return set;
  };
  const A = grams(a);
  const B = grams(b);
  let inter = 0;
  for (const g of A) if (B.has(g)) inter++;
  return inter / (A.size + B.size - inter);
}

function nameScore(ours: string, theirs: string): number {
  const na = normalizeName(ours);
  const nb = normalizeName(theirs);
  if (na && nb && (na.includes(nb) || nb.includes(na))) return 1;
  const ca = coreName(ours);
  const cb = coreName(theirs);
  if (ca && cb && ca.length >= 2 && (ca.includes(cb) || cb.includes(ca))) return 0.85;
  return bigramSim(na, nb);
}

function haversineM(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export interface OurSauna {
  name: string;
  sigungu: string | null;
  dong: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
}

export interface PlaceMatch {
  candidate: NaverPlaceCandidate;
  nameSim: number;
  distanceM: number | null;
  reason: string;
}

// 매칭 임계값. 좌표가 있으면 거리로 강하게 식별(이름은 느슨해도 됨),
// 없으면 이름+주소(동/시군구) 토큰 일치를 요구한다.
const MAX_DISTANCE_M = 700;
const MIN_NAME_WITH_COORDS = 0.45;
const MIN_NAME_NO_COORDS = 0.7;

/** 후보들 중 우리 사우나에 맞는 1건. 없으면 null. */
export function pickBestMatch(
  candidates: NaverPlaceCandidate[],
  ours: OurSauna,
): PlaceMatch | null {
  const haveCoords = ours.lat != null && ours.lng != null;
  const scored: PlaceMatch[] = [];

  for (const c of candidates) {
    const nameSim = nameScore(ours.name, c.name);
    let distanceM: number | null = null;
    if (haveCoords && c.lat != null && c.lng != null) {
      distanceM = haversineM(
        { lat: ours.lat!, lng: ours.lng! },
        { lat: c.lat, lng: c.lng },
      );
    }

    if (distanceM != null) {
      if (distanceM <= MAX_DISTANCE_M && nameSim >= MIN_NAME_WITH_COORDS) {
        scored.push({
          candidate: c,
          nameSim,
          distanceM,
          reason: `coords ${Math.round(distanceM)}m, name ${nameSim.toFixed(2)}`,
        });
      }
      continue;
    }

    // 좌표 없음 → 이름 강하게 + 주소 토큰(동/시군구) 일치 요구.
    const addr = `${c.fullAddress ?? ""} ${c.roadAddress ?? ""}`;
    const addrHit =
      (ours.dong && addr.includes(ours.dong)) ||
      (ours.sigungu && addr.includes(ours.sigungu));
    if (nameSim >= MIN_NAME_NO_COORDS && addrHit) {
      scored.push({
        candidate: c,
        nameSim,
        distanceM: null,
        reason: `no-coords, name ${nameSim.toFixed(2)}, addr✓`,
      });
    }
  }

  if (!scored.length) return null;
  // 좌표 매칭 우선(가장 가까운 것), 그다음 이름 유사도.
  scored.sort((a, b) => {
    if (a.distanceM != null && b.distanceM != null) return a.distanceM - b.distanceM;
    if (a.distanceM != null) return -1;
    if (b.distanceM != null) return 1;
    return b.nameSim - a.nameSim;
  });
  return scored[0];
}
