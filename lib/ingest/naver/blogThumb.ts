/**
 * 블로그 글 대표 이미지(og:image) 추출 — 후기 카드 썸네일용.
 *
 * 공식 블로그 검색 API엔 썸네일이 없어, 각 글 페이지에서 og:image 메타를 긁는다.
 * (= 사진 크롤과 같은 리스크 구간. 추출 URL은 store.ts 가 우리 Storage 로 재호스팅하므로
 *  클라이언트엔 외부 URL 노출 0.) 실패하면 null → 썸네일 없는 카드로 폴백.
 */

/**
 * 네이버 블로그 데스크톱 URL 은 프레임셋 껍데기(og:image 없음)라 **모바일을 우선**한다.
 * blog.naver.com / m.blog.naver.com 둘 다 {id}/{logNo} 를 뽑아 모바일 URL 재구성.
 */
function candidates(pageUrl: string): string[] {
  const m = /blog\.naver\.com\/([^/?#]+)\/(\d+)/.exec(pageUrl);
  if (m) return [`https://m.blog.naver.com/${m[1]}/${m[2]}`, pageUrl];
  return [pageUrl];
}

const OG_PATTERNS = [
  /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
  /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
  /<meta[^>]+name=["']og:image["'][^>]+content=["']([^"']+)["']/i,
];

export async function fetchOgImage(pageUrl: string): Promise<string | null> {
  for (const url of candidates(pageUrl)) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0", Accept: "text/html" },
      });
      if (!res.ok) continue;
      const html = await res.text();
      for (const re of OG_PATTERNS) {
        const m = re.exec(html);
        if (m && /^https?:\/\//i.test(m[1])) return m[1];
      }
    } catch {
      // 다음 후보 시도
    }
  }
  return null;
}
