/**
 * 하단 탭용 플랫 컬러 일러스트 아이콘.
 * ScrubberIcon(때수건)·홈 일러스트 톤과 같은 플랫 채움 스타일로 통일.
 * 활성/비활성(회색조)은 BottomTabBar 쪽에서 래퍼로 처리한다.
 */

type TabIconProps = { size?: number; className?: string };

/** 홈 — 사우나/온천 심볼(♨), 테마색 단색. */
export function HomeTabIcon({ size = 26, className }: TabIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <g
        stroke="#F5402C"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        transform="translate(0 2)"
      >
        {/* 김 세 가닥 — 가운데가 가장 길게 모락모락 */}
        <path d="M8 13.2c-1.5-1.5 1.5-2.9 0-4.3s-1.5-2.9 0-4.3" />
        <path d="M12 13.5c-1.6-1.7 1.6-3.4 0-5.5s-1.6-3.8 0-5.5" />
        <path d="M16 13.2c-1.5-1.5 1.5-2.9 0-4.3s-1.5-2.9 0-4.3" />
        {/* 탕그릇 — 배는 넓고 입구는 살짝 오므린 단지꼴(가운데 틈 유지) */}
        <path d="M4 12.3C2.8 13.8 3 18.7 12 18.7C21 18.7 21.2 13.8 20 12.3" />
      </g>
    </svg>
  );
}

/** 내 주변 — 빨강 지도 핀 + 흰 중심. */
export function NearbyTabIcon({ size = 26, className }: TabIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      {/* 그림자 */}
      <ellipse cx="12" cy="21" rx="3.6" ry="1.2" fill="#1A2B49" opacity="0.12" />
      {/* 핀 */}
      <path
        d="M12 2.4c-4 0-7.1 3-7.1 7 0 5 7.1 11.4 7.1 11.4s7.1-6.4 7.1-11.4c0-4-3.1-7-7.1-7Z"
        fill="#F5402C"
      />
      {/* 중심 */}
      <circle cx="12" cy="9.4" r="2.7" fill="#fff" />
    </svg>
  );
}

/** 찾기 — 돋보기 + 렌즈 안 '텍스트' 두 줄(lucide text-search 톤). 테마색 단색. */
export function FindTabIcon({ size = 26, className }: TabIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <g
        stroke="#F5402C"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      >
        {/* 렌즈 + 손잡이 */}
        <circle cx="10.5" cy="10.5" r="6.3" strokeWidth="2.6" />
        <path d="M15.1 15.1 20.6 20.6" strokeWidth="2.6" />
        {/* 렌즈 안 텍스트 두 줄(검색 대상 = 목록) */}
        <path d="M7.8 9.1h5.4" strokeWidth="1.8" />
        <path d="M7.8 12h3.4" strokeWidth="1.8" />
      </g>
    </svg>
  );
}

/** 마이 — 단순한 인물 실루엣(머리 + 어깨). 테마색(brand vermilion). */
export function MyTabIcon({ size = 26, className }: TabIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <g fill="#F5402C">
        <circle cx="12" cy="8" r="4.4" />
        <path d="M3.8 21a8.2 7 0 0 1 16.4 0Z" />
      </g>
    </svg>
  );
}
