"use client";

import { useRef, useState, useEffect, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * 가로 스크롤 리스트.
 * 터치 기기는 브라우저 기본 스와이프를 그대로 쓰고,
 * 마우스가 있는(hover 가능한) 데스크톱에서만 호버 시 좌·우 화살표가 나타나 클릭으로 스크롤한다.
 * overflow-x-auto 만으로는 데스크톱에서 마우스 드래그가 안 되므로 이 화살표로 보완한다.
 */
export function ScrollRow({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  const update = () => {
    const el = ref.current;
    if (!el) return;
    setAtStart(el.scrollLeft <= 1);
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 1);
  };

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    update();
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  const nudge = (dir: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: "smooth" });
  };

  return (
    <div className="group relative">
      <div ref={ref} className={className}>
        {children}
      </div>

      <Arrow side="left" hidden={atStart} onClick={() => nudge(-1)} />
      <Arrow side="right" hidden={atEnd} onClick={() => nudge(1)} />
    </div>
  );
}

function Arrow({
  side,
  hidden,
  onClick,
}: {
  side: "left" | "right";
  hidden: boolean;
  onClick: () => void;
}) {
  const Icon = side === "left" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      aria-label={side === "left" ? "이전" : "다음"}
      onClick={onClick}
      className={[
        // hover 가능한(=마우스) 기기에서만 노출, 터치는 숨김
        "hidden [@media(hover:hover)]:flex",
        "absolute top-[52px] z-10 h-[34px] w-[34px] -translate-y-1/2 items-center justify-center",
        "rounded-full border border-black/5 bg-white/90 text-ink shadow-[0_2px_10px_rgba(0,0,0,0.14)] backdrop-blur",
        "opacity-0 transition group-hover:opacity-100 hover:bg-white",
        side === "left" ? "left-[6px]" : "right-[6px]",
        hidden ? "!opacity-0 pointer-events-none" : "",
      ].join(" ")}
    >
      <Icon size={20} strokeWidth={2.4} />
    </button>
  );
}
