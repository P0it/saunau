import Link from "next/link";
import { Flame } from "lucide-react";
import type { Sauna } from "@/lib/data/types";
import { SaunaImage } from "./SaunaImage";
import { TempHeadline } from "./TempHeadline";
import { TypeBadge } from "./TypeBadge";
import { FavoriteScrubber } from "./FavoriteScrubber";

export function saunaHref(s: Sauna) {
  return `/sauna/${encodeURIComponent(s.sido)}/${s.slug}`;
}

/** 영업중이 아닌(폐업·휴업) 상태. closed_date 또는 status 로 판별. */
export function isSaunaClosed(s: Sauna): boolean {
  if (s.closed_date) return true;
  const st = s.status ?? "";
  return st !== "" && st !== "영업/정상" && st !== "영업";
}

function specLine(s: Sauna): string {
  const parts: string[] = [];
  if (s.has_sesin) parts.push("세신");
  if (s.is_24h) parts.push("24시간");
  if (s.has_outdoor) parts.push("노천");
  return parts.join(" · ");
}

/**
 * 사우나 리스트 카드 — 사진 중심 + 요소 최소 + 여백 우선(여기어때식).
 * 온도 헤드라인 재사용. 사진 없으면 단색 연한 톤 + 모노 아이콘 폴백.
 * 리스트·찜·검색결과에서 공통 사용.
 */
export function SaunaCard({ sauna }: { sauna: Sauna }) {
  const spec = specLine(sauna);
  const closed = isSaunaClosed(sauna);
  // 평점은 후기가 없어도 항상 노출(빈 불꽃 + 0.0 + (0)). 괄호 안은 실제 후기 수.
  const rated = sauna.rating_avg != null && (sauna.rating_count ?? 0) > 0;

  return (
    <Link
      href={saunaHref(sauna)}
      aria-disabled={closed}
      className="block overflow-hidden rounded-[20px] bg-card shadow-[0_2px_12px_rgba(0,0,0,0.05)]"
    >
      <div className="relative h-[150px] w-full">
        {/* 사진 정책(킬스위치·출처)은 쿼리 계층에서 적용됨 → src=null 이면 plain 폴백 */}
        <SaunaImage
          src={sauna.thumbnail_url}
          alt={sauna.name}
          sizes="(max-width: 430px) 100vw, 430px"
          grayscale={closed}
        />
        {closed && (
          <div className="absolute inset-0 flex items-center justify-center bg-[rgba(34,32,30,0.42)]">
            <span className="rounded-full bg-card/95 px-[13px] py-[6px] text-[12px] font-semibold text-ink shadow-[0_1px_6px_rgba(0,0,0,0.12)]">
              아쉽지만, 문을 닫았어요
            </span>
          </div>
        )}
        <div className="absolute right-[10px] top-[10px]">
          <FavoriteScrubber saunaId={sauna.id} />
        </div>
      </div>

      <div className={`p-[16px] ${closed ? "opacity-70" : ""}`}>
        {closed ? (
          <>
            <div className="flex items-center gap-[7px]">
              <span className="text-[16px] font-semibold tracking-[-0.01em] text-ink">
                {sauna.name}
              </span>
              <span className="flex-none">
                <TypeBadge sauna={sauna} />
              </span>
            </div>
            <p className="mt-[10px] text-[13px] font-medium leading-[1.5] text-muted">
              아쉽지만 문을 닫았어요…
              <br />
              <span className="text-[12px] text-dot">
                다음에 더 좋은 곳에서 만나요
              </span>
            </p>
          </>
        ) : (
          <div className="flex items-stretch justify-between gap-[12px]">
            {/* 좌측 정보 스택 — 이름 → 평점 → 위치(거리·동·스펙) */}
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="flex min-w-0 items-center gap-[7px]">
                <span className="truncate text-[16px] font-semibold tracking-[-0.01em] text-ink">
                  {sauna.name}
                </span>
                <span className="flex-none">
                  <TypeBadge sauna={sauna} />
                </span>
              </div>

              {/* 평점 — 한 줄 */}
              <div className="mt-[10px] flex items-center gap-[3px] text-[12px] tabular-nums">
                <Flame
                  size={12}
                  className={rated ? "text-hot" : ""}
                  fill={rated ? "currentColor" : "none"}
                  style={rated ? undefined : { color: "#D8D3CC" }}
                  aria-hidden
                />
                <span
                  className={
                    rated ? "font-semibold text-ink" : "font-medium text-dot"
                  }
                >
                  {(sauna.rating_avg ?? 0).toFixed(1)}
                </span>
                <span className="font-medium text-dot">
                  ({sauna.rating_count ?? 0})
                </span>
              </div>

              {/* 위치 — 한 줄 (거리는 위치 권한 있을 때 표시) */}
              <div className="mt-[6px] truncate text-[12px] font-medium text-muted tabular-nums">
                {sauna.distance_km != null && <>{sauna.distance_km}km · </>}
                {sauna.dong}
                {spec && <span className="text-dot"> · </span>}
                {spec}
              </div>
            </div>

            {/* 우측 하단 온도 — 기존 서비스의 '금액' 자리 */}
            <div className="flex flex-none items-end">
              <TempHeadline
                saunaTemp={sauna.sauna_room_temp}
                coldTemp={sauna.cold_bath_temp}
              />
            </div>
          </div>
        )}
      </div>
    </Link>
  );
}
