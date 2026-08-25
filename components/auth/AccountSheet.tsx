"use client";

import { useState } from "react";
import Link from "next/link";
import { X, LogOut, Check, ChevronRight } from "lucide-react";
import { useAuth } from "@/lib/auth";

/**
 * 계정 시트 — 로그인 상태에서 설정(톱니) 진입.
 * 닉네임 변경 · 로그인 수단 표시 · 마케팅 수신 동의 · 약관 열람 · 로그아웃 · 탈퇴.
 *
 * 이메일은 있을 수도 없을 수도 있다 — 카카오는 이메일이 선택 동의라
 * 계정 식별은 이메일이 아니라 로그인 수단 표시로 대신한다.
 */
const PROVIDER_LABEL: Record<string, string> = {
  kakao: "카카오 계정으로 로그인됨",
  google: "구글 계정으로 로그인됨",
  email: "이메일로 로그인됨",
};

export function AccountSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const {
    user,
    nickname,
    marketingAgreed,
    signOut,
    updateNickname,
    setMarketingAgreed,
  } = useAuth();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  if (!open || !user) return null;

  const startEdit = () => {
    setDraft(nickname ?? "");
    setEditing(true);
  };

  const save = async () => {
    const next = draft.trim();
    // 온보딩과 같은 규칙(2~12자). DB CHECK 제약과도 일치.
    if (next.length >= 2 && next.length <= 12) await updateNickname(next);
    setEditing(false);
  };

  const deleteAccount = async () => {
    if (deleting) return;
    setDeleting(true);
    setDeleteError("");
    try {
      const res = await fetch("/api/account/delete", { method: "POST" });
      if (!res.ok) throw new Error();
      // 서버에서 계정이 사라졌으므로 로컬 세션도 정리하고 홈으로.
      await signOut();
      window.location.replace("/");
    } catch {
      setDeleteError("탈퇴에 실패했어요. 잠시 후 다시 시도해주세요.");
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] mx-auto flex max-w-[430px] flex-col justify-end bg-[rgba(20,18,16,.42)]">
      <div className="absolute inset-0" onClick={onClose} aria-hidden />
      <div className="relative flex max-h-[86%] flex-col overflow-hidden rounded-t-[22px] bg-card">
        <div className="flex justify-center pb-[4px] pt-[10px]">
          <div className="h-[4px] w-[38px] rounded-full bg-[#E2DFD9]" />
        </div>
        <div className="flex items-center justify-between px-[20px] pb-[8px] pt-[10px]">
          <span className="text-[17px] font-bold text-ink">내 계정</span>
          <button type="button" aria-label="닫기" onClick={onClose}>
            <X size={24} className="text-ink" />
          </button>
        </div>

        <div className="no-scrollbar overflow-y-auto px-[20px] pb-[28px] pt-[8px]">
          <div className="rounded-[14px] bg-[#F7F6F4] p-[16px]">
            {/* 아바타는 닉네임 이니셜. 카카오·구글이 준 사진 URL(profiles.avatar_url)은
                보관만 하고 렌더하지 않는다 — next.config.ts 가 제3자 이미지 호스트
                등록을 금지하고 있어(핫링크 유출 차단) 외부 CDN을 띄울 수 없다. */}
            <div className="flex items-center gap-[12px]">
              <div className="flex h-[48px] w-[48px] flex-none items-center justify-center rounded-full bg-brand text-[19px] font-bold text-white">
                {(nickname ?? "?").trim().charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="truncate text-[16px] font-semibold text-ink">
                  {nickname ?? "사우나우님"}
                </div>
                <div className="mt-[2px] truncate text-[12px] text-muted">
                  {user.email ??
                    PROVIDER_LABEL[user.provider ?? ""] ??
                    "로그인됨"}
                </div>
              </div>
            </div>

            <div className="mt-[16px] border-t border-line-soft pt-[14px]">
              <div className="text-[12px] font-semibold text-[#9A938A]">닉네임</div>
              {editing ? (
                <div className="mt-[8px] flex items-center gap-[8px]">
                  <input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value.slice(0, 12))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") save();
                    }}
                    autoFocus
                    maxLength={12}
                    placeholder="닉네임 (2~12자)"
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
            </div>
          </div>

          {/* 마케팅 수신 — 선택 동의라 언제든 철회할 수 있어야 한다. */}
          <div className="mt-[14px] flex items-center justify-between rounded-[14px] bg-[#F7F6F4] px-[16px] py-[14px]">
            <div className="min-w-0 pr-[12px]">
              <div className="text-[14px] font-semibold text-ink">
                마케팅 정보 수신
              </div>
              <div className="mt-[2px] text-[12px] text-muted">
                새 소식·이벤트 안내를 받아요
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={marketingAgreed}
              aria-label="마케팅 정보 수신 동의"
              onClick={() => setMarketingAgreed(!marketingAgreed)}
              className={`relative h-[28px] w-[48px] flex-none rounded-full transition-colors ${
                marketingAgreed ? "bg-brand" : "bg-[#DDD9D3]"
              }`}
            >
              <span
                className={`absolute top-[3px] h-[22px] w-[22px] rounded-full bg-white transition-all ${
                  marketingAgreed ? "left-[23px]" : "left-[3px]"
                }`}
              />
            </button>
          </div>

          {/* 약관 열람 */}
          <div className="mt-[14px] overflow-hidden rounded-[14px] bg-[#F7F6F4]">
            <LegalLink href="/terms" label="이용약관" />
            <div className="mx-[16px] h-px bg-line-soft" />
            <LegalLink href="/privacy" label="개인정보처리방침" />
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

          {/* 탈퇴 — 되돌릴 수 없으므로 한 번 더 확인받는다. */}
          {confirmDelete ? (
            <div className="mt-[16px] rounded-[14px] bg-[#FDEEEB] p-[16px]">
              <p className="text-[14px] font-semibold text-ink">
                정말 탈퇴하시겠어요?
              </p>
              <p className="mt-[6px] text-[13px] leading-[1.6] text-muted">
                찜·후기·기록·메모가 모두 삭제되고 되돌릴 수 없어요.
              </p>
              {deleteError && (
                <p className="mt-[8px] text-[12px] text-brand">{deleteError}</p>
              )}
              <div className="mt-[14px] flex gap-[8px]">
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="h-[44px] flex-1 rounded-[12px] border border-line bg-white text-[14px] font-semibold text-ink"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={deleteAccount}
                  disabled={deleting}
                  className="h-[44px] flex-1 rounded-[12px] bg-brand text-[14px] font-semibold text-white disabled:opacity-40"
                >
                  {deleting ? "처리 중…" : "탈퇴하기"}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="mt-[16px] w-full py-[10px] text-center text-[13px] text-[#A39D94] underline"
            >
              회원 탈퇴
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function LegalLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between px-[16px] py-[14px]"
    >
      <span className="text-[14px] text-ink">{label}</span>
      <ChevronRight size={18} className="text-[#A39D94]" />
    </Link>
  );
}
