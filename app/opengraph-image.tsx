import { ImageResponse } from "next/og";
import { MARK, OG, OG_SIZE, ogFonts } from "@/lib/og";

/**
 * 사이트 기본 공유 카드 — 카톡/페북/트위터에서 링크 공유 시 노출.
 * 아이보리 바탕에 플레이트 마크 + 워드마크(네 글자 모두 브랜드 레드).
 * 하위 라우트는 자체 opengraph-image 나 openGraph.images 가 없으면 이걸 상속한다.
 */

export const alt = "사우나우 - 전국 사우나 지도";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image() {
  const box = 168;
  const radius = box / 2;

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
          gap: 34,
          background: "linear-gradient(150deg, #FFFFFF 0%, #F0EBE4 100%)",
        }}
      >
        <div style={{ display: "flex", position: "relative", width: box + 11, height: box + 22 }}>
          {/* 측면(두께) */}
          <div
            style={{
              position: "absolute",
              left: 11,
              top: 22,
              width: box,
              height: box,
              borderRadius: `0 ${radius}px ${radius}px ${radius}px`,
              background: `linear-gradient(160deg, ${MARK.side1} 0%, ${MARK.side2} 100%)`,
            }}
          />
          {/* 정면 */}
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: box,
              height: box,
              borderRadius: `0 ${radius}px ${radius}px ${radius}px`,
              background: `linear-gradient(163deg, ${MARK.top} 0%, ${MARK.mid} 46%, ${MARK.bot} 100%)`,
            }}
          />
        </div>
        <div
          style={{
            fontSize: 132,
            fontWeight: 800,
            color: OG.brand,
            letterSpacing: "-0.055em",
          }}
        >
          사우나우
        </div>
        <div style={{ fontSize: 38, fontWeight: 700, color: OG.muted }}>
          전국 사우나 지도
        </div>
      </div>
    ),
    { ...size, fonts: await ogFonts() },
  );
}
