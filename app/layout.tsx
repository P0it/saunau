import type { Metadata, Viewport } from "next";
import "./globals.css";
import { pretendard } from "./fonts";
import { AppFrame } from "@/components/layout/AppFrame";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { SITE_URL, SITE_NAME, SITE_DESCRIPTION } from "@/lib/site";

// maximumScale 1 — 입력창(16px 미만 폰트) 포커스 시 iOS 사파리가 페이지를 강제 확대해
// 폭이 틀어지고 가로 스크롤이 생기는 것을 방지. iOS는 사용자 핀치줌을 여전히 허용한다.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export const metadata: Metadata = {
  title: {
    default: `${SITE_NAME} - 전국 사우나 지도`,
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  metadataBase: new URL(SITE_URL),
  // 카톡·페북 등 공유 카드. og:image 는 app/opengraph-image.tsx (파일 컨벤션)가 붙인다.
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: "ko_KR",
    url: "/",
    title: `${SITE_NAME} - 전국 사우나 지도`,
    description: SITE_DESCRIPTION,
  },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={pretendard.variable}>
      <body>
        <AppFrame>{children}</AppFrame>
        {/* 출시 후 무슨 일이 일어나는지 볼 최소 계측 — 방문 집계와 Core Web Vitals.
            둘 다 쿠키를 쓰지 않고 개인 식별자를 보내지 않는다(개인정보처리방침 9항 유지). */}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
