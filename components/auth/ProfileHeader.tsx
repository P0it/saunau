"use client";

import { User, ChevronRight } from "lucide-react";

/**
 * 마이페이지 상단 계정 헤더.
 * - 비로그인: "로그인하세요" + 로그인 버튼(탭하면 로그인 시트)
 * - 로그인: 닉네임 첫 글자 아바타 + 닉네임 + 이메일(탭하면 계정 시트)
 * 데이터(상태/닉네임)는 페이지의 useAuth에서 props로 받는다(중복 구독 회피).
 */
export function ProfileHeader({
  email,
  nickname,
  loading,
  onOpen,
}: {
  email: string | null;
  nickname: string | null;
  loading: boolean;
  onOpen: () => void;
}) {
  const loggedIn = email != null;

  return (
    <div className="px-[20px] pb-[12px] pt-[16px]">
      <button
        type="button"
        onClick={onOpen}
        disabled={loading}
        className="flex w-full items-center gap-[12px] rounded-[16px] bg-[#F7F6F4] px-[16px] py-[14px] text-left"
      >
        {/* 아바타 */}
        {loading ? (
          <div className="h-[44px] w-[44px] flex-none rounded-full bg-[#ECEAE6]" />
        ) : loggedIn ? (
          <div className="flex h-[44px] w-[44px] flex-none items-center justify-center rounded-full bg-brand text-[18px] font-bold text-white">
            {(nickname ?? email ?? "?").trim().charAt(0).toUpperCase()}
          </div>
        ) : (
          <div className="flex h-[44px] w-[44px] flex-none items-center justify-center rounded-full bg-[#ECEAE6]">
            <User size={22} className="text-muted" />
          </div>
        )}

        {/* 텍스트 */}
        <div className="min-w-0 flex-1">
          {loading ? (
            <div className="h-[13px] w-[120px] rounded-full bg-[#ECEAE6]" />
          ) : loggedIn ? (
            <>
              <div className="truncate text-[16px] font-semibold text-ink">
                {nickname ?? "사우나우님"}
              </div>
              <div className="mt-[1px] truncate text-[12px] text-muted">
                {email}
              </div>
            </>
          ) : (
            <>
              <div className="text-[15px] font-semibold text-ink">
                로그인하세요
              </div>
              <div className="mt-[2px] text-[12px] text-muted">
                찜·후기를 어디서 접속해도 그대로
              </div>
            </>
          )}
        </div>

        {/* 우측 액션 */}
        {!loading &&
          (loggedIn ? (
            <ChevronRight size={20} className="flex-none text-[#C2BCB3]" />
          ) : (
            <span className="flex-none rounded-full bg-brand px-[16px] py-[8px] text-[13px] font-semibold text-white">
              로그인
            </span>
          ))}
      </button>
    </div>
  );
}
