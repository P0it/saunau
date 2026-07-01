/**
 * 상세 히어로용 온도 글리프(미니멀 플랫). 예전엔 편백방·타일욕조를 컬러로
 * 세밀하게 그렸지만, 상세 온도 카드는 "심플"하게 정리 —
 * 소프트 면 + 선 두 톤만 쓰고, 옆 숫자 색과 맞춰 사우나=빨강 / 냉탕=파랑.
 *  - SaunaRoomArt : 사우나실 = 캐빈 + 히터 돌 + 솟는 열기(김)
 *  - ColdBathArt  : 냉탕 = 욕조 + 물결 + 한기(눈결정)
 */

type ArtProps = { size?: number; className?: string };

const HOT = "#F5402C"; // brand
const HOT_SOFT = "#FDE3DE"; // 연한 빨강 면
const COLD = "#1C6FFF"; // 냉탕/찬물
const COLD_SOFT = "#DCE9FF"; // 연한 파랑 면

/** 사우나실 — 캐빈 + 히터 + 솟는 열기. 단색 레드 플랫. */
export function SaunaRoomArt({ size = 52, className }: ArtProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      {/* 솟는 열기(김) */}
      <g stroke={HOT} strokeWidth="2.6" strokeLinecap="round">
        <path d="M19 12c-2.4-2.2 2.4-3.8 0-6.8" />
        <path d="M29 12c-2.4-2.2 2.4-3.8 0-6.8" />
      </g>

      {/* 캐빈 */}
      <rect x="7" y="16" width="34" height="26" rx="5" fill={HOT_SOFT} />
      <rect
        x="7"
        y="16"
        width="34"
        height="26"
        rx="5"
        stroke={HOT}
        strokeWidth="2.6"
      />

      {/* 벤치 */}
      <path d="M11 35h26" stroke={HOT} strokeWidth="2.6" strokeLinecap="round" />

      {/* 히터 + 달군 돌 */}
      <path
        d="M19 35v-4.5a5 5 0 0 1 10 0V35"
        stroke={HOT}
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="21.5" cy="30" r="1.6" fill={HOT} />
      <circle cx="26.5" cy="30" r="1.6" fill={HOT} />
    </svg>
  );
}

/** 냉탕 — 욕조 + 물결 + 한기(눈결정). 사우나실과 같은 단색 레드 플랫. */
export function ColdBathArt({ size = 52, className }: ArtProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      {/* 한기 — 눈결정 */}
      <g stroke={COLD} strokeWidth="2.6" strokeLinecap="round">
        <path d="M24 5v9" />
        <path d="M20 7.4 28 12" />
        <path d="M28 7.4 20 12" />
      </g>

      {/* 욕조 */}
      <path
        d="M8 21h32v8a7 7 0 0 1-7 7H15a7 7 0 0 1-7-7z"
        fill={COLD_SOFT}
        stroke={COLD}
        strokeWidth="2.6"
        strokeLinejoin="round"
      />

      {/* 물결 */}
      <path
        d="M13 27q2.75 2.4 5.5 0t5.5 0 5.5 0"
        stroke={COLD}
        strokeWidth="2.4"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}
