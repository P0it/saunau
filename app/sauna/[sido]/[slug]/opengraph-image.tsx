import { ImageResponse } from "next/og";
import { getSaunaBySlug } from "@/lib/data/queries";
import { CATEGORY_LABEL, primaryCategory } from "@/lib/data/types";
import { OG, OG_SIZE, ogFonts, Steam, TempChip } from "@/lib/og";

/** 매장 상세 공유 카드 — 매장명·지역·카테고리·사우나실/냉탕 온도. */

export const alt = "사우나 정보";
export const size = OG_SIZE;
export const contentType = "image/png";
export const revalidate = 3600; // 매장 정보는 자주 안 바뀜 — 카드도 1시간 캐시

type Params = { sido: string; slug: string };

export default async function Image({
  params,
}: {
  params: Promise<Params>;
}) {
  const { sido, slug } = await params;
  const [s, fonts] = await Promise.all([
    getSaunaBySlug(sido, slug),
    ogFonts(),
  ]);

  // 못 찾으면 기본 브랜드 카드와 같은 구성으로 폴백
  if (!s) {
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
            background: "#FFFFFF",
          }}
        >
          <Steam height={110} />
          <div
            style={{
              marginTop: 10,
              fontSize: 120,
              fontWeight: 800,
              color: OG.ink,
              letterSpacing: "-0.03em",
            }}
          >
            사우나우
          </div>
        </div>
      ),
      { ...size, fonts },
    );
  }

  const cat = CATEGORY_LABEL[primaryCategory(s)];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#FFFFFF",
          padding: "64px 72px",
        }}
      >
        {/* 상단 브랜드 행 */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <Steam height={44} />
          <div
            style={{
              fontSize: 40,
              fontWeight: 800,
              color: OG.brand,
              letterSpacing: "-0.02em",
            }}
          >
            사우나우
          </div>
        </div>

        {/* 매장명 · 지역 */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex" }}>
            <div
              style={{
                display: "flex",
                background: OG.chipBg,
                color: OG.ink,
                borderRadius: 999,
                padding: "8px 24px",
                fontSize: 28,
                fontWeight: 700,
              }}
            >
              {`${s.sigungu} · ${cat}`}
            </div>
          </div>
          <div
            style={{
              marginTop: 24,
              fontSize: 84,
              fontWeight: 800,
              color: OG.ink,
              letterSpacing: "-0.03em",
              lineHeight: 1.15,
              lineClamp: 2,
            }}
          >
            {s.name}
          </div>
          <div
            style={{
              marginTop: 18,
              fontSize: 32,
              fontWeight: 700,
              color: OG.muted,
              lineClamp: 1,
            }}
          >
            {s.address}
          </div>
        </div>

        {/* 하단 온도 칩 — 없으면 서비스 태그라인 */}
        <div style={{ display: "flex", gap: 16 }}>
          {s.sauna_room_temp != null && (
            <TempChip
              label="사우나실"
              value={`${s.sauna_room_temp}°`}
              color={OG.brand}
            />
          )}
          {s.cold_bath_temp != null && (
            <TempChip
              label="냉탕"
              value={`${s.cold_bath_temp}°`}
              color={OG.cold}
            />
          )}
          {s.sauna_room_temp == null && s.cold_bath_temp == null && (
            <div
              style={{
                fontSize: 32,
                fontWeight: 700,
                color: OG.muted,
              }}
            >
              내 주변 사우나 디스커버리 — 사우나우
            </div>
          )}
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
