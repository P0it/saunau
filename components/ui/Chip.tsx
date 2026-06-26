"use client";

/** 속성 필터 칩 — 선택 칩은 연한 빨강 배경 + 빨강 텍스트, 비선택은 흰 배경 + 헤어라인. */
export function Chip({
  label,
  active = false,
  onClick,
}: {
  label: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex-none rounded-full border px-[13px] py-[7px] text-[13px] font-medium transition-colors"
      style={
        active
          ? {
              background: "#FDECE9",
              color: "var(--color-brand)",
              borderColor: "transparent",
            }
          : {
              background: "#fff",
              color: "var(--color-ink)",
              borderColor: "var(--color-line)",
            }
      }
    >
      {label}
    </button>
  );
}
