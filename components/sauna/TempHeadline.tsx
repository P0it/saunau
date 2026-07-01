import { SaunaRoomIcon, ColdBathIcon } from "./TempIcons";

/** 초기 온도 데이터가 없을 때 사용하는 기본값. */
const DEFAULT_SAUNA_TEMP = 90;
const DEFAULT_COLD_TEMP = 20;

/**
 * 시그니처 컴포넌트 — "온도 헤드라인".
 * 사우나실(빨강) · 냉탕(파랑), 큰 tabular-nums. 홈·리스트·찜·상세에서 재사용.
 * 값이 없으면 기본값(90°·20°)을 보여주고 "온도 확인 중"으로 표시(빈 상태 방지).
 */
export function TempHeadline({
  saunaTemp,
  coldTemp,
  size = "sm",
}: {
  saunaTemp: number | null;
  coldTemp: number | null;
  size?: "sm" | "lg";
}) {
  const isEstimate = saunaTemp == null && coldTemp == null;
  const sauna = saunaTemp ?? DEFAULT_SAUNA_TEMP;
  const cold = coldTemp ?? DEFAULT_COLD_TEMP;

  const icon = size === "lg" ? 16 : 13;
  const text = size === "lg" ? "text-[15px]" : "text-[13px]";

  return (
    <div className="flex items-center gap-[6px]">
      <div
        className={`flex items-center gap-[6px] font-semibold tabular-nums ${text}`}
      >
        <span className="inline-flex items-center gap-[3px] text-hot">
          <SaunaRoomIcon size={icon} />
          {sauna}°
        </span>
        <span className="text-dot">·</span>
        <span className="inline-flex items-center gap-[3px] text-cold">
          <ColdBathIcon size={icon} />
          {cold}°
        </span>
      </div>
      {isEstimate && (
        <span className="text-[11px] font-medium text-muted">온도 확인 중</span>
      )}
    </div>
  );
}
