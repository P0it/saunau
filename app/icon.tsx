import { ImageResponse } from "next/og";
import { MarkTile, ogFonts } from "@/lib/og";

/**
 * 파비콘(모던 브라우저용) — 아이보리 타일 위 플레이트 마크(MarkTile).
 * 16px 로 줄면 디테일은 사라지고 빨간 실루엣만 남는데, 그 상태가 곧 플랫 폴백이라
 * 따로 그리지 않는다. 레거시 폴백 app/favicon.ico 는 이 그림을 받아서 만든다 — `npm run favicon`.
 */

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default async function Icon() {
  return new ImageResponse(<MarkTile size={size.width} />, {
    ...size,
    fonts: await ogFonts(),
  });
}
