import type { Metadata } from "next";
import "./globals.css";
import { pretendard } from "./fonts";
import { AppFrame } from "@/components/layout/AppFrame";

export const metadata: Metadata = {
  title: {
    default: "사우나우 — 내 주변 사우나 디스커버리",
    template: "%s · 사우나우",
  },
  description:
    "전국의 사우나·대중탕·온천·찜질방을 사우나실/냉탕 온도까지 한눈에. 내 주변 갈 만한 쾌적한 사우나를 빠르게 찾으세요.",
  metadataBase: new URL("https://saunau.app"),
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
