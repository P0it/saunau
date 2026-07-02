"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * 모바일 전용 바텀시트(네이버지도식). 상단 그랩 핸들을 끌면 멈춘 위치에 그대로 정착한다(자유 신축, 스냅 없음).
 * - 휴식 범위: 위 TOP_GAP(거의 전체) ~ 아래 peek(최소 노출). 그 사이 어디서 멈춰도 그 높이 유지.
 * - 상세 모드(withClose): 충분히 아래로 끌면 onClose 로 닫힘.
 * 데스크톱(lg+)에서는 호출 측에서 이 컴포넌트 대신 좌측 패널을 쓴다.
 *
 * 높이는 부모(지도 루트, 픽셀 높이 지정됨)의 100%(h-full)를 그대로 따른다.
 */
const TOP_GAP = 56; // full 스냅에서 위로 남겨두는 지도 영역(px)

export function BottomSheet({
  children,
  peekPx = 150,
  withClose = false,
  onClose,
  zClassName = "z-[8]",
}: {
  children: ReactNode;
  peekPx?: number;
  withClose?: boolean;
  onClose?: () => void;
  zClassName?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [h, setH] = useState(0);
  const [y, setY] = useState<number | null>(null); // translateY(px). null=진입 전(아래 숨김)
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ startPointer: number; startY: number } | null>(null);

  // 자유 드래그 — 멈춘 위치에 그대로 정착(네이버지도식). 스냅 없음.
  // 위 경계 TOP_GAP(거의 전체) ~ 아래 경계 peek(최소 노출). 상세는 더 내리면 닫힘.
  const peek = h ? Math.max(TOP_GAP, h - peekPx) : 0; // 가장 내려간 휴식 위치
  const dragMax = withClose ? h : peek; // 상세는 화면 밖까지 끌어 닫을 수 있음
  const closeAt = h ? h - Math.round(peekPx * 0.6) : 0; // 상세: 이보다 더 내리면 닫힘

  // 시트 실제 높이 추적(부모 높이가 늦게 잡혀도 ResizeObserver 로 반영).
  // 높이가 처음 잡히는 순간 시작 위치로 슬라이드 진입(콜백 안에서 처리 → 진입 애니메이션).
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const nh = el.offsetHeight;
      setH(nh);
      setY((prev) =>
        prev === null && nh ? Math.round(nh * (withClose ? 0.32 : 0.46)) : prev,
      );
    });
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onPointerDown(e: React.PointerEvent) {
    setDragging(true);
    drag.current = { startPointer: e.clientY, startY: y ?? 0 };
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current) return;
    const dy = e.clientY - drag.current.startPointer;
    // 끄는 동안엔 손가락 그대로 따라간다(자유 신축). 위 TOP_GAP ~ 아래 dragMax.
    setY(Math.max(TOP_GAP, Math.min(drag.current.startY + dy, dragMax)));
  }
  function onPointerUp() {
    if (!drag.current) return;
    drag.current = null;
    setDragging(false);
    const cur = y ?? 0;
    if (withClose && cur > closeAt) {
      onClose?.();
      return;
    }
    // 멈춘 위치 유지 — 휴식 범위(TOP_GAP ~ peek)로만 살짝 보정.
    setY(Math.max(TOP_GAP, Math.min(cur, peek)));
  }

  return (
    <div
      ref={ref}
      className={`absolute inset-x-0 bottom-0 ${zClassName} flex h-full flex-col rounded-t-[18px] bg-card shadow-[0_-6px_24px_rgba(0,0,0,0.16)] ${
        dragging ? "" : "transition-transform duration-300"
      }`}
      style={{ transform: y === null ? "translateY(100%)" : `translateY(${y}px)` }}
    >
      {/* 그랩 핸들 — 바(5px)는 그대로 두고 터치 타깃만 ≈44px 로 확장.
          레이아웃 패딩(12+5+8=25px) + 투명 오버레이(위 8px·아래 12px)로 히트 영역을 넓힌다.
          아래 12px 는 콘텐츠 상단 패딩 위라 버튼·입력과 겹치지 않는다. */}
      <div
        className="relative flex-none cursor-grab touch-none pb-[8px] pt-[12px] active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div className="mx-auto h-[5px] w-[40px] rounded-full bg-[#D8D5D1]" />
        <div className="absolute inset-x-0 -bottom-[12px] -top-[8px]" />
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
    </div>
  );
}
