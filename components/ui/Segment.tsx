"use client";

/** 타입 세그먼트(최상위 분류) — 선택만 강조(연한 빨강), 솔리드 빨강 블록 금지. */
export function Segment<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    // w-max: 좁은 화면에서 부모(overflow-x-auto) 폭에 눌려 라벨이 줄바꿈되지 않도록
    // 항상 내용 폭을 유지 — 넘치면 가로 스크롤로 밀린다.
    <div className="flex w-max gap-[6px]">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className="flex-none whitespace-nowrap rounded-full px-[14px] py-[7px] text-[14px] font-semibold transition-colors"
            style={
              active
                ? { background: "#FDECE9", color: "var(--color-brand)" }
                : { background: "transparent", color: "var(--color-muted)" }
            }
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
