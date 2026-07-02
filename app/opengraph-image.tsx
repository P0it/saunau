import { ImageResponse } from "next/og";
import { OG, OG_SIZE, ogFonts } from "@/lib/og";

/**
 * 사이트 기본 공유 카드 — 카톡/페북/트위터에서 링크 공유 시 노출.
 * 브랜드 레드 배경 + 흰 워드마크(김 모티프 없음).
 * 하위 라우트는 자체 opengraph-image 나 openGraph.images 가 없으면 이걸 상속한다.
 */

export const alt = "사우나우 - 전국 사우나 지도";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: OG.brand,
        }}
      >
        <div
          style={{
            fontSize: 148,
            fontWeight: 800,
            color: "#FFFFFF",
            letterSpacing: "-0.03em",
          }}
        >
          사우나우
        </div>
        <div
          style={{
            marginTop: 10,
            fontSize: 38,
            fontWeight: 700,
            color: "rgba(255,255,255,0.82)",
          }}
        >
          전국 사우나 지도
        </div>
      </div>
    ),
    { ...size, fonts: await ogFonts() },
  );
}
