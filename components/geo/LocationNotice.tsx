"use client";

import { X, MapPin } from "lucide-react";

/**
 * 위치 이용 고지 시트 — 브라우저 권한 프롬프트 **직전**에 용도를 알린다.
 *
 * 브라우저 프롬프트는 "이 사이트가 위치를 알고 싶어함"까지만 말해주고 왜 필요한지,
 * 좌표를 어떻게 다루는지는 알려주지 않는다. 거부 이유의 대부분이 그 공백이다.
 * 여기서 한 번 설명한 뒤 사용자가 누르면 그때 실제 권한 요청으로 넘어간다.
 *
 * LoginSheet·FilterSheet 와 같은 하단 시트 형태.
 */
export function LocationNotice({
  open,
  onClose,
  onAllow,
}: {
  open: boolean;
  onClose: () => void;
  onAllow: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] mx-auto flex max-w-[430px] flex-col justify-end bg-[rgba(20,18,16,.42)]">
      <div className="absolute inset-0" onClick={onClose} aria-hidden />
      <div className="relative flex flex-col overflow-hidden rounded-t-[22px] bg-card">
        <div className="flex justify-center pb-[4px] pt-[10px]">
          <div className="h-[4px] w-[38px] rounded-full bg-[#E2DFD9]" />
        </div>
        <div className="flex items-center justify-between px-[20px] pb-[8px] pt-[10px]">
          <span className="text-[17px] font-bold text-ink">위치 사용 안내</span>
          <button type="button" aria-label="닫기" onClick={onClose}>
            <X size={24} className="text-ink" />
          </button>
        </div>

        <div className="px-[20px] pb-[28px] pt-[6px]">
          <div className="flex items-start gap-[12px] rounded-[14px] bg-[#F7F6F4] p-[14px]">
            <span className="flex h-[36px] w-[36px] flex-none items-center justify-center rounded-full bg-brand">
              <MapPin size={18} className="text-white" />
            </span>
            <p className="text-[13px] leading-[1.65] text-ink">
              가까운 사우나를 거리순으로 보여주려고 현재 위치를 씁니다.
              <br />
              좌표는 <strong className="font-semibold">저장하지 않고</strong> 그
              자리에서 거리 계산에만 쓰며, 다른 곳에 제공하지 않습니다.
            </p>
          </div>
          <p className="mt-[10px] text-[12px] leading-[1.6] text-muted">
            허용하지 않아도 검색과 지도 탐색은 그대로 쓸 수 있어요. 다음 화면에서
            브라우저가 한 번 더 물어봅니다.
          </p>

          <button
            type="button"
            onClick={onAllow}
            className="mt-[16px] h-[50px] w-full rounded-[14px] bg-brand text-[15px] font-semibold text-white"
          >
            위치 사용하고 내 주변 보기
          </button>
          <button
            type="button"
            onClick={onClose}
            className="mt-[8px] h-[46px] w-full rounded-[14px] text-[14px] font-semibold text-muted"
          >
            나중에
          </button>
        </div>
      </div>
    </div>
  );
}
