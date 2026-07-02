import localFont from "next/font/local";

/**
 * Pretendard 가변 폰트 자체 호스팅(next/font/local).
 * 기존 jsdelivr CDN <link>(렌더 차단·외부 왕복)를 대체 — 빌드 시 프리로드/서브셋되어
 * 첫 페인트를 막지 않는다. --font-pretendard 를 globals.css 의 --font-sans 가 사용.
 */
export const pretendard = localFont({
  src: "../public/fonts/PretendardVariable.woff2",
  variable: "--font-pretendard",
  display: "swap",
  weight: "100 900",
  preload: true,
});
