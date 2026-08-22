import { ImageResponse } from "next/og";
import { MARK, ogFonts } from "@/lib/og";

/**
 * 파비콘(모던 브라우저용) — 아이보리 타일 위 플레이트 마크.
 *
 * satori 는 SVG 그라디언트를 못 받으므로 같은 그림을 div 두 장으로 쌓는다.
 * (좌상단만 각진 사각 = borderRadius "0 half half half")
 * 아래 깔린 판이 측면(두께), 위가 정면. 16px 로 줄면 디테일은 사라지고
 * 빨간 실루엣만 남는데, 그 상태가 곧 플랫 폴백이라 따로 그리지 않는다.
 *
 * 레거시 폴백 app/favicon.ico 는 이 그림을 받아서 만든다 — `npm run favicon`.
 */

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default async function Icon() {
  const box = 44;
  const radius = box / 2;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(150deg, #FFFFFF 0%, #EAE5DE 100%)",
          borderRadius: 14,
        }}
      >
        <div style={{ display: "flex", position: "relative", width: box + 3, height: box + 6 }}>
          {/* 측면(두께) */}
          <div
            style={{
              position: "absolute",
              left: 3,
              top: 6,
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
      </div>
    ),
    { ...size, fonts: await ogFonts() },
  );
}
