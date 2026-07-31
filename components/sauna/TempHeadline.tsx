import { SaunaRoomIcon, ColdBathIcon } from "./TempIcons";

/**
 * 시그니처 컴포넌트 — "온도 헤드라인".
 * 사우나실(빨강) · 냉탕(파랑), 큰 tabular-nums. 홈·리스트·찜·상세에서 재사용.
 * 값이 없으면 숫자를 지어내지 않고 "온도 확인 중"만 — 추정치가 실측처럼 읽히면 안 된다.
 * 한쪽만 있으면 있는 쪽만 표시한다.
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
  const icon = size === "lg" ? 16 : 13;
  const text = size === "lg" ? "text-[15px]" : "text-[13px]";

  if (saunaTemp == null && coldTemp == null) {
    return (
      <span className="text-[11px] font-medium text-muted">온도 확인 중</span>
    );
  }

  return (
    <div
      className={`flex items-center gap-[6px] font-semibold tabular-nums ${text}`}
    >
      {saunaTemp != null && (
        <span className="inline-flex items-center gap-[3px] text-hot">
          <SaunaRoomIcon size={icon} />
          {saunaTemp}°
        </span>
      )}
      {saunaTemp != null && coldTemp != null && (
        <span className="text-dot">·</span>
      )}
      {coldTemp != null && (
        <span className="inline-flex items-center gap-[3px] text-cold">
          <ColdBathIcon size={icon} />
          {coldTemp}°
        </span>
      )}
    </div>
  );
}
