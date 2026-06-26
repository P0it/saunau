import Link from "next/link";
import type { Sauna } from "@/lib/data/types";
import { SaunaImage } from "./SaunaImage";
import { TempHeadline } from "./TempHeadline";
import { TypeBadge } from "./TypeBadge";
import { FavoriteHeart } from "./FavoriteHeart";

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
          <FavoriteHeart saunaId={sauna.id} />
        </div>
      </div>

      <div className={`p-[14px] ${closed ? "opacity-70" : ""}`}>
        <div className="flex items-center gap-[7px]">
          <span className="text-[16px] font-semibold tracking-[-0.01em] text-ink">
            {sauna.name}
          </span>
          <TypeBadge sauna={sauna} />
        </div>

        {closed ? (
          <p className="mt-[8px] text-[13px] font-medium leading-[1.5] text-muted">
            아쉽지만 문을 닫았어요…
            <br />
            <span className="text-[12px] text-dot">
              다음에 더 좋은 곳에서 만나요
            </span>
          </p>
        ) : (
          <div className="mt-[8px]">
            <TempHeadline
              saunaTemp={sauna.sauna_room_temp}
              coldTemp={sauna.cold_bath_temp}
            />
          </div>
        )}

        <div className="mt-[7px] text-[12px] font-medium text-muted tabular-nums">
          {sauna.distance_km != null && <>{sauna.distance_km}km · </>}
          {sauna.dong}
          {spec && !closed && <span className="text-dot"> · </span>}
          {!closed && spec}
        </div>
      </div>
    </Link>
  );
}
