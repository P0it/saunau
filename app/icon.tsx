import { ImageResponse } from "next/og";
import { OG, ogFonts } from "@/lib/og";

/**
 * 파비콘(모던 브라우저용) — 브랜드 레드 둥근 사각 + 흰 워드마크 첫 글자 "사".
 * 파비콘 크기(16~32px)에선 네 글자 워드마크가 안 읽혀 첫 글자만 쓴다.
 * 레거시 폴백은 app/favicon.ico (같은 디자인, scripts 로 생성).
 */

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default async function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: OG.brand,
          borderRadius: 14,
          color: "#FFFFFF",
          fontSize: 42,
          fontWeight: 800,
        }}
      >
        사
      </div>
    ),
    { ...size, fonts: await ogFonts() },
  );
}
