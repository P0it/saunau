/**
 * 사우나우 전용 온도 심볼.
 * 일반 불꽃/눈송이 대신, 의미를 살린 커스텀 아이콘을 쓴다.
 *  - SaunaRoomIcon : 사우나실 = 달궈진 돌(히터) 위로 피어오르는 열기 + 화로(室)
 *  - ColdBathIcon  : 냉탕 = 차가운 물이 담긴 욕조 + 한기(눈결정)
 * 색은 currentColor 상속(text-hot / text-cold). stroke 기반이라 13px~28px 모두 선명.
 * 작은 인라인(헤드라인)에서도 뭉개지지 않게 획 수를 최소화했다.
 */

type IconProps = { size?: number; className?: string; strokeWidth?: number };

/** 사우나실 — 화로(돌더미) + 피어오르는 열기 2가닥. */
export function SaunaRoomIcon({
  size = 24,
  className,
  strokeWidth = 2,
}: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {/* 피어오르는 열기 2가닥 */}
      <path d="M9 9.5c-.7-.9.7-1.8 0-2.7" />
      <path d="M15 9.5c-.7-.9.7-1.8 0-2.7" />
      {/* 화로(室) 몸체 */}
      <rect x="4.5" y="12.5" width="15" height="8" rx="1.6" />
      {/* 달궈진 돌더미 */}
      <path d="M7 15.8q2.5-1.7 5 0t5 0" />
    </svg>
  );
}

/** 냉탕 — 욕조 + 물결 + 한기(눈결정). */
export function ColdBathIcon({
  size = 24,
  className,
  strokeWidth = 2,
}: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {/* 한기 — 눈결정(차가움 표식) */}
      <path d="M12 3v4" />
      <path d="M10.3 4 13.7 6" />
      <path d="M13.7 4 10.3 6" />
      {/* 욕조 테두리 */}
      <path d="M4 12h16" />
      {/* 욕조 몸체 */}
      <path d="M5.3 12v2.6A4.4 4.4 0 0 0 9.7 19h4.6a4.4 4.4 0 0 0 4.4-4.4V12" />
      {/* 담긴 물의 물결 */}
      <path d="M8.5 15.4q1.3 1 2.6 0t2.6 0" />
    </svg>
  );
}
