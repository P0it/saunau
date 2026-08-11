"use client";

import {
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";

/**
 * 모바일 전용 바텀시트(네이버지도식). 상단 그랩 핸들을 끌면 멈춘 위치에 그대로 정착한다(자유 신축, 스냅 없음).
 * - 휴식 범위: 위 TOP_GAP(거의 전체) ~ 아래 peek(최소 노출). 그 사이 어디서 멈춰도 그 높이 유지.
 * - 다 내리면 핸들 띠(SHEET_HANDLE_PX)만 남고, 그 띠 전체가 드래그·탭(토글) 판이 된다.
 * - 상세 모드(withClose): 충분히 아래로 끌면 onClose 로 닫힘.
 * 데스크톱(lg+)에서는 호출 측에서 이 컴포넌트 대신 좌측 패널을 쓴다.
 *
 * 높이는 부모(지도 루트, 픽셀 높이 지정됨)의 100%(h-full)를 그대로 따른다.
 */
const TOP_GAP = 56; // full 스냅에서 위로 남겨두는 지도 영역(px)
const TAP_SLOP = 8; // 이만큼 못 움직였으면 드래그가 아니라 탭(= 토글)으로 본다
const NEAR_PEEK = 12; // peek 에서 이 안쪽이면 '접힘'으로 본다(탭 토글·전면 드래그 판정)

/** 핸들 띠의 실제 높이(px). 다 내렸을 때 이만큼만 남기려면 peekPx 에 이 값을 준다. */
export const SHEET_HANDLE_PX = 30;

/** 바깥에서 시트를 움직이는 명령 창구(목록 → 상세 전환 등). */
export type BottomSheetHandle = {
  /** 시트 상단을 높이의 ratio 위치로 끌어올린다. 이미 그보다 위면 그대로 둔다. */
  raiseTo: (ratio: number) => void;
};

export function BottomSheet({
  children,
  peekPx = 150,
  restRatio = 0.58,
  withClose = false,
  onClose,
  onCoverChange,
  handleRef,
  zClassName = "z-[8]",
}: {
  children: ReactNode;
  peekPx?: number;
  /** 진입 시 정착 위치(시트 상단이 화면 높이의 몇 %). 클수록 지도가 더 넓게 남는다. */
  restRatio?: number;
  withClose?: boolean;
  onClose?: () => void;
  /** 시트가 실제로 가리는 높이(px). 지도 중심 보정·플로팅 버튼 위치에 쓴다. 드래그가 끝났을 때만 알린다. */
  onCoverChange?: (px: number) => void;
  /** 바깥에서 시트를 움직일 때 쓰는 핸들(raiseTo). */
  handleRef?: RefObject<BottomSheetHandle | null>;
  zClassName?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [h, setH] = useState(0);
  const [y, setY] = useState<number | null>(null); // translateY(px). null=진입 전(아래 숨김)
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ startPointer: number; startY: number; moved: boolean } | null>(
    null,
  );
  // 접힘 판(오버레이)에서 드래그를 시작했는지 — 드래그 중 판이 사라지지 않게 붙잡아 둔다.
  const [overlayHeld, setOverlayHeld] = useState(false);

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
      setY((prev) => (prev === null && nh ? Math.round(nh * restRatio) : prev));
    });
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 바깥 명령으로 위치 이동(목록→상세 전환처럼 시트를 올려야 할 때).
  // 이미 그보다 위로 올려 둔 상태면 내리지 않는다 — 사용자가 잡아둔 높이를 뺏지 않게.
  useImperativeHandle(handleRef, () => ({
    raiseTo(ratio: number) {
      if (!h) return;
      const target = Math.max(TOP_GAP, Math.min(Math.round(h * ratio), peek));
      setY((prev) => (prev === null ? target : Math.min(prev, target)));
    },
  }));

  // 가리는 높이를 부모에 알린다 — 드래그 중엔 매 프레임 리렌더가 되므로 정착했을 때만.
  useEffect(() => {
    if (dragging || y === null || !h) return;
    onCoverChange?.(Math.max(0, h - y));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [h, y, dragging]);

  // 접힘 = 가장 내려간 휴식 위치 근처. 이땐 보이는 띠에 핸들밖에 없으므로
  // 띠 전체를 드래그·탭 영역으로 쓴다(좁은 핸들을 정확히 겨냥하지 않아도 되게).
  const collapsed = y !== null && !!h && y >= peek - NEAR_PEEK;
  const restY = h ? Math.max(TOP_GAP, Math.min(Math.round(h * restRatio), peek)) : 0;

  function onPointerDown(e: React.PointerEvent) {
    setDragging(true);
    drag.current = { startPointer: e.clientY, startY: y ?? 0, moved: false };
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current) return;
    const dy = e.clientY - drag.current.startPointer;
    if (Math.abs(dy) > TAP_SLOP) drag.current.moved = true;
    // 끄는 동안엔 손가락 그대로 따라간다(자유 신축). 위 TOP_GAP ~ 아래 dragMax.
    setY(Math.max(TOP_GAP, Math.min(drag.current.startY + dy, dragMax)));
  }
  function onPointerUp() {
    if (!drag.current) return;
    const { moved, startY } = drag.current;
    drag.current = null;
    setDragging(false);
    // 거의 안 움직였으면 탭 — 접혀 있으면 펴고, 펴져 있으면 접는다.
    // (다 내리면 핸들만 남으므로 '다시 여는 법'이 이 탭 하나로 분명해진다.)
    if (!moved) {
      setY(startY >= peek - NEAR_PEEK ? restY : peek);
      return;
    }
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
      {/* 그랩 핸들 — 바(5px)는 그대로 두고 터치 타깃만 넉넉히 확장.
          레이아웃 패딩(9+5+16=30px = SHEET_HANDLE_PX) + 투명 오버레이(위 20px·아래 14px)로
          ≈64px 히트 영역. 위쪽은 시트 밖(지도)이라 뭐와도 겹치지 않고,
          아래 14px 는 콘텐츠 상단 패딩 위라 버튼·입력의 본체와 겹치지 않는다. */}
      <div
        className="relative flex-none cursor-grab touch-none select-none pb-[16px] pt-[9px] active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div className="mx-auto h-[5px] w-[44px] rounded-full bg-[#D8D5D1]" />
        <div className="absolute inset-x-0 -bottom-[14px] -top-[20px]" />
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">{children}</div>

      {/* 접힘 상태 — 보이는 건 핸들 띠뿐이므로 시트 전체를 드래그·탭 판으로 덮는다.
          좁은 핸들을 겨냥하지 않아도 아무 데나 끌거나 톡 치면 다시 펴진다. */}
      {(collapsed || overlayHeld) && (
        <div
          role="button"
          tabIndex={0}
          aria-label="목록 펼치기"
          className="absolute inset-0 cursor-grab touch-none select-none"
          onPointerDown={(e) => {
            // 끌어올리는 도중 collapsed 가 풀려 이 판이 사라지면 포인터 캡처까지 끊긴다 —
            // 자기 드래그가 끝날 때까지는 남아 있도록 표시해 둔다.
            setOverlayHeld(true);
            onPointerDown(e);
          }}
          onPointerMove={onPointerMove}
          onPointerUp={() => {
            setOverlayHeld(false);
            onPointerUp();
          }}
          onPointerCancel={() => {
            setOverlayHeld(false);
            onPointerUp();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setY(restY);
            }
          }}
        />
      )}
    </div>
  );
}
