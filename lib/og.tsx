import { readFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * OG(공유 카드) 이미지 공용 헬퍼 — app/**\/opengraph-image.tsx 들이 사용.
 * 카톡·페북 등은 og:image 를 1200×630(≈1.91:1)으로 읽는다.
 *
 * satori 는 woff2(가변 폰트)를 못 읽어서 정적 OTF(assets/fonts/)를 별도로 둔다.
 * 팔레트는 app/globals.css 토큰과 동일(CLAUDE.md 공용 일러스트 규칙).
 */

export const OG_SIZE = { width: 1200, height: 630 };

export const OG = {
  brand: "#F5402C", // 뜨거움/사우나실/김
  cold: "#1C6FFF", // 냉탕/차가움
  ink: "#22201E", // 먹색
  muted: "#8B8680", // 서브텍스트
  chipBg: "#F4F2EF", // 비활성 토큰 배경
} as const;

export async function ogFonts() {
  const [bold, extraBold] = await Promise.all([
    readFile(join(process.cwd(), "assets/fonts/Pretendard-Bold.otf")),
    readFile(join(process.cwd(), "assets/fonts/Pretendard-ExtraBold.otf")),
  ]);
  return [
    { name: "Pretendard", data: bold, weight: 700 as const, style: "normal" as const },
    { name: "Pretendard", data: extraBold, weight: 800 as const, style: "normal" as const },
  ];
}

/** ♨ 김 — 빨강 곡선 3가닥(가운데가 큼). 공용 일러스트의 공통 모티프. */
export function Steam({ height = 110 }: { height?: number }) {
  const strand = (h: number) => (
    <svg
      width={(46 * h) / 120}
      height={h}
      viewBox="0 0 46 120"
      style={{ display: "flex" }}
    >
      <path
        d="M23 112 C4 93 42 75 23 56 C4 37 42 19 23 8"
        fill="none"
        stroke={OG.brand}
        strokeWidth={12}
        strokeLinecap="round"
      />
    </svg>
  );
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        gap: Math.round(height / 9),
      }}
    >
      {strand(height * 0.82)}
      {strand(height)}
      {strand(height * 0.82)}
    </div>
  );
}

/** 온도 칩 — "사우나실 92°" / "냉탕 17°" 같은 알약 토큰. */
export function TempChip({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        background: color,
        color: "#FFFFFF",
        borderRadius: 999,
        padding: "14px 32px",
        fontSize: 32,
        fontWeight: 700,
      }}
    >
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
