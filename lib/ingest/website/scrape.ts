/**
 * 업체 공식 사이트에서 사진 URL 추출 — **robots.txt 존중** + 대표/콘텐츠 이미지 위주.
 *
 * 권리: 업체(권리자)의 자기 사이트 자산. 출처표기 + takedown(is_active) 전제로 쓴다.
 * 추출한 URL 은 store.ts 가 우리 Storage(WebP)로 재호스팅한다(외부 핫링크 0).
 *
 * 보수적 추출: og:image / twitter:image(대표) + 사진형 <img>(로고·아이콘·svg 제외).
 * 실패/차단 시 빈 배열 → 파이프라인을 막지 않는다.
 */
import type { PhotoRef } from "../naver/store";

const UA = "Mozilla/5.0 (compatible; SaunauBot/1.0; +https://saunau.app)";
const FETCH_TIMEOUT = 12_000;

async function fetchText(url: string): Promise<string | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT);
    const r = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "text/html,*/*" },
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (!r.ok) return null;
    return await r.text();
  } catch {
    return null;
  }
}

/** robots.txt 의 User-agent:* 규칙으로 경로 허용 여부 판단(보수적). 못 읽으면 허용. */
export async function isAllowedByRobots(pageUrl: string): Promise<boolean> {
  let origin: string, path: string;
  try {
    const u = new URL(pageUrl);
    origin = u.origin;
    path = u.pathname || "/";
  } catch {
    return false;
  }
  const txt = await fetchText(`${origin}/robots.txt`);
  if (!txt) return true; // robots 없으면 허용(관행)

  // User-agent: * 블록의 Disallow 만 본다.
  const lines = txt.split(/\r?\n/).map((l) => l.trim());
  let inStar = false;
  const disallows: string[] = [];
  for (const line of lines) {
    if (/^user-agent:/i.test(line)) {
      inStar = /^user-agent:\s*\*/i.test(line);
    } else if (inStar && /^disallow:/i.test(line)) {
      const p = line.replace(/^disallow:\s*/i, "").trim();
      if (p) disallows.push(p);
    }
  }
  return !disallows.some((d) => path.startsWith(d));
}

const META_PATTERNS = [
  /<meta[^>]+property=["'](?:og:image|twitter:image)["'][^>]+content=["']([^"']+)["']/gi,
  /<meta[^>]+content=["']([^"']+)["'][^>]+property=["'](?:og:image|twitter:image)["']/gi,
  /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/gi,
];

// 로고/아이콘/버튼 + 레이아웃·메뉴·공통 에셋 경로(실사진 아님)를 배제한다.
const SKIP_RE =
  /logo|icon|favicon|sprite|btn|button|bg[-_.]|background|blank|spacer|loading|pixel|\/(?:layout|assets|common|skin|css|js|inc|include)\/|gnb|lnb|submenu|menu|header|footer|banner|thumb_s|_s\.|arrow|dot[-_.]/i;

function absolutize(src: string, base: string): string | null {
  try {
    return new URL(src, base).href;
  } catch {
    return null;
  }
}

/**
 * 사이트 1곳에서 사진 추출. robots 차단/실패 시 빈 배열.
 *
 * 기본(gallery=false): og:image/twitter:image 만 — 사이트가 고른 대표사진이라 품질 안정.
 * gallery=true: 콘텐츠 <img> 까지 긁는다(커버리지↑ 그러나 광고·외부도메인·잡이미지 섞일 수
 *   있어 **검수 권장**). 외부 도메인 이미지는 약하게 배제(같은 호스트 또는 *.cdn 류 우선).
 */
export async function extractSiteImages(
  websiteUrl: string,
  max = 5,
  gallery = false,
): Promise<PhotoRef[]> {
  if (!(await isAllowedByRobots(websiteUrl))) return [];
  const html = await fetchText(websiteUrl);
  if (!html) return [];

  const urls = new Set<string>();

  // 1) 대표 이미지(og/twitter) — 항상 우선, 가장 깨끗.
  for (const re of META_PATTERNS) {
    for (const m of html.matchAll(re)) {
      const abs = absolutize(m[1], websiteUrl);
      if (abs) urls.add(abs);
    }
  }

  // 2) (옵션) 콘텐츠 사진형 <img>. 외부 광고 도메인 약하게 배제.
  if (gallery) {
    let baseHost = "";
    try {
      baseHost = new URL(websiteUrl).hostname.replace(/^www\./, "");
    } catch {
      /* noop */
    }
    for (const m of html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)) {
      const src = m[1];
      if (!/\.(jpe?g|png|webp)(\?|#|$)/i.test(src)) continue;
      if (SKIP_RE.test(src)) continue;
      const abs = absolutize(src, websiteUrl);
      if (!abs) continue;
      // 외부 도메인은 같은 베이스 도메인(또는 흔한 CDN 키워드)일 때만 허용.
      try {
        const host = new URL(abs).hostname.replace(/^www\./, "");
        const sameish =
          host.endsWith(baseHost) ||
          baseHost.endsWith(host) ||
          /img|cdn|static|cloudfront|cafe24|amazonaws/i.test(host);
        if (!sameish) continue;
      } catch {
        continue;
      }
      urls.add(abs);
      if (urls.size >= max * 3) break;
    }
  }

  return [...urls].slice(0, max).map((u) => ({ sourceUrl: u }));
}
