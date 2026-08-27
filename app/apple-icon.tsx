import { ImageResponse } from "next/og";
import { MarkTile, ogFonts } from "@/lib/og";

/**
 * iOS 홈 화면 아이콘(apple-touch-icon). 없으면 사파리가 화면을 캡처해 쓰기 때문에
 * "홈 화면에 추가"가 정체불명 썸네일로 남는다. 파비콘과 같은 그림을 180px 로 그린다.
 */

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default async function AppleIcon() {
  return new ImageResponse(<MarkTile size={size.width} />, {
    ...size,
    fonts: await ogFonts(),
  });
}
