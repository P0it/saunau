import type { Metadata, Viewport } from "next";
import "./globals.css";
import { pretendard } from "./fonts";
import { AppFrame } from "@/components/layout/AppFrame";

// maximumScale 1 — 입력창(16px 미만 폰트) 포커스 시 iOS 사파리가 페이지를 강제 확대해
// 폭이 틀어지고 가로 스크롤이 생기는 것을 방지. iOS는 사용자 핀치줌을 여전히 허용한다.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export const metadata: Metadata = {
  title: {
    default: "사우나우 - 전국 사우나 지도",
    template: "%s · 사우나우",
  },
  description: "내 주변 목욕탕·찜질방·온천 찾기",
  metadataBase: new URL("https://saunau.vercel.app"),
  // 카톡·페북 등 공유 카드. og:image 는 app/opengraph-image.tsx (파일 컨벤션)가 붙인다.
  openGraph: {
    type: "website",
    siteName: "사우나우",
    locale: "ko_KR",
    url: "/",
    title: "사우나우 - 전국 사우나 지도",
    description: "내 주변 목욕탕·찜질방·온천 찾기",
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
      </body>
    </html>
  );
}
