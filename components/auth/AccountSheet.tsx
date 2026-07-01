"use client";

import { useState } from "react";
import { X, LogOut, Check } from "lucide-react";
import { useAuth } from "@/lib/auth";

/**
 * 계정 시트 — 로그인 상태에서 설정(톱니) 진입. 닉네임 표시·변경 + 로그아웃.
 * 보유 정보는 이메일 + 닉네임뿐(최소 수집).
 */
export function AccountSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { user, nickname, signOut, updateNickname } = useAuth();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  if (!open || !user) return null;

  const startEdit = () => {
    setDraft(nickname ?? "");
    setEditing(true);
  };

  const save = async () => {
    const next = draft.trim();
    if (next) await updateNickname(next);
    setEditing(false);
  };

  return (
    <div className="fixed inset-0 z-[70] mx-auto flex max-w-[430px] flex-col justify-end bg-[rgba(20,18,16,.42)]">
      <div className="absolute inset-0" onClick={onClose} aria-hidden />
      <div className="relative flex flex-col overflow-hidden rounded-t-[22px] bg-card">
        <div className="flex justify-center pb-[4px] pt-[10px]">
          <div className="h-[4px] w-[38px] rounded-full bg-[#E2DFD9]" />
        </div>
        <div className="flex items-center justify-between px-[20px] pb-[8px] pt-[10px]">
          <span className="text-[17px] font-bold text-ink">내 계정</span>
          <button type="button" aria-label="닫기" onClick={onClose}>
            <X size={24} className="text-ink" />
          </button>
        </div>

        <div className="px-[20px] pb-[28px] pt-[8px]">
          <div className="rounded-[14px] bg-[#F7F6F4] p-[16px]">
            <div className="text-[12px] font-semibold text-[#9A938A]">닉네임</div>
            {editing ? (
              <div className="mt-[8px] flex items-center gap-[8px]">
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") save();
                  }}
                  autoFocus
                  maxLength={20}
                  placeholder="닉네임"
                  className="w-full rounded-[10px] border border-line bg-white px-[12px] py-[9px] text-[15px] text-ink outline-none"
                />
                <button
                  type="button"
                  onClick={save}
                  aria-label="저장"
                  className="flex h-[38px] w-[42px] flex-none items-center justify-center rounded-[10px] bg-brand text-white"
                >
                  <Check size={18} />
                </button>
              </div>
            ) : (
              <div className="mt-[6px] flex items-center justify-between">
                <span className="text-[16px] font-semibold text-ink">
                  {nickname ?? "—"}
                </span>
                <button
                  type="button"
                  onClick={startEdit}
                  className="text-[13px] font-semibold text-muted underline"
                >
                  변경
                </button>
              </div>
            )}
            <div className="mt-[12px] text-[12px] font-semibold text-[#9A938A]">
              이메일
            </div>
            <div className="mt-[4px] text-[14px] text-muted">{user.email}</div>
          </div>

          <button
            type="button"
            onClick={async () => {
              await signOut();
              onClose();
            }}
            className="mt-[16px] flex h-[50px] w-full items-center justify-center gap-[8px] rounded-[14px] border border-line bg-white text-[15px] font-semibold text-ink"
          >
            <LogOut size={18} />
            로그아웃
          </button>
        </div>
      </div>
    </div>
  );
}
