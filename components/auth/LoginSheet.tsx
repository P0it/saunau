"use client";

import { useState } from "react";
import Link from "next/link";
import { X, Mail, CheckCircle2 } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

/**
 * 로그인 시트 — 카카오(주) · 구글(보조) OAuth + 이메일 매직링크(폴백). 비밀번호 폼 없음.
 * OAuth: signInWithOAuth → 동의 → /auth/callback(코드교환) → 미가입이면 /welcome.
 * 이메일: signInWithOtp → "메일함 확인" 안내.
 *
 * provider 활성화는 Supabase 대시보드에서 해야 한다 — docs/auth-setup.md 참고.
 * FilterSheet와 동일한 하단 시트 스타일.
 */
type OAuthProvider = "kakao" | "google";

export function LoginSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );
  const [errorMsg, setErrorMsg] = useState("");
  const [busy, setBusy] = useState<OAuthProvider | null>(null);

  if (!open) return null;

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  async function signInWith(provider: OAuthProvider) {
    if (busy) return;
    setBusy(provider);
    setErrorMsg("");
    const supabase = createSupabaseBrowserClient();
    // 성공 시 provider로 리다이렉트되므로 이후 UI는 필요 없음. 실패만 여기서 처리.
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setStatus("error");
      setErrorMsg(error.message);
      setBusy(null);
    }
  }

  async function sendLink() {
    if (!emailValid || status === "sending") return;
    setStatus("sending");
    setErrorMsg("");
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      setStatus("error");
      setErrorMsg(error.message);
    } else {
      setStatus("sent");
    }
  }

  return (
    <div className="fixed inset-0 z-[70] mx-auto flex max-w-[430px] flex-col justify-end bg-[rgba(20,18,16,.42)]">
      <div className="absolute inset-0" onClick={onClose} aria-hidden />
      <div className="relative flex flex-col overflow-hidden rounded-t-[22px] bg-card">
        <div className="flex justify-center pb-[4px] pt-[10px]">
          <div className="h-[4px] w-[38px] rounded-full bg-[#E2DFD9]" />
        </div>
        <div className="flex items-center justify-between px-[20px] pb-[8px] pt-[10px]">
          <span className="text-[17px] font-bold text-ink">로그인</span>
          <button type="button" aria-label="닫기" onClick={onClose}>
            <X size={24} className="text-ink" />
          </button>
        </div>

        <div className="px-[20px] pb-[28px] pt-[6px]">
          {status === "sent" ? (
            <div className="flex flex-col items-center py-[16px] text-center">
              <div className="flex h-[64px] w-[64px] items-center justify-center rounded-full bg-[#E9F6EC]">
                <CheckCircle2 size={34} className="text-[#2FA84F]" />
              </div>
              <p className="mt-[16px] text-[15px] font-semibold text-ink">
                메일함을 확인해주세요
              </p>
              <p className="mt-[6px] text-[13px] leading-[1.6] text-muted">
                <span className="font-semibold text-ink">{email.trim()}</span>
                으로
                <br />
                로그인 링크를 보냈어요. 링크를 누르면 로그인됩니다.
              </p>
              <button
                type="button"
                onClick={() => setStatus("idle")}
                className="mt-[18px] text-[13px] font-semibold text-muted underline"
              >
                다른 이메일로 다시 보내기
              </button>
            </div>
          ) : (
            <>
              {/* 카카오 — 주 로그인. 국내 사용자는 대부분 이미 로그인된 상태라 1~2탭. */}
              <button
                type="button"
                onClick={() => signInWith("kakao")}
                disabled={busy !== null}
                className="flex h-[50px] w-full items-center justify-center gap-[10px] rounded-[14px] bg-[#FEE500] text-[15px] font-semibold text-[#191600] disabled:opacity-40"
              >
                <KakaoGlyph />
                {busy === "kakao" ? "카카오로 이동 중…" : "카카오로 계속하기"}
              </button>

              {/* 구글 — 보조. 카카오 계정이 없는 사용자용. */}
              <button
                type="button"
                onClick={() => signInWith("google")}
                disabled={busy !== null}
                className="mt-[10px] flex h-[50px] w-full items-center justify-center gap-[10px] rounded-[14px] border border-line bg-white text-[15px] font-semibold text-ink disabled:opacity-40"
              >
                <GoogleGlyph />
                {busy === "google" ? "구글로 이동 중…" : "구글로 계속하기"}
              </button>

              {/* 구분선 — 폴백(이메일) 안내 */}
              <div className="my-[16px] flex items-center gap-[10px]">
                <span className="h-px flex-1 bg-line" />
                <span className="text-[12px] text-[#A39D94]">또는 이메일로</span>
                <span className="h-px flex-1 bg-line" />
              </div>

              <p className="text-[13px] leading-[1.6] text-muted">
                이메일만 입력하면 로그인 링크를 보내드려요. 비밀번호는 필요 없어요.
              </p>
              <div className="mt-[14px] flex items-center gap-[10px] rounded-[12px] border border-line bg-white px-[14px] py-[12px]">
                <Mail size={18} className="text-muted" />
                {/* autoFocus 금지 — 모바일에서 시트가 뜨자마자 키보드(+툴바)가 올라와
                    뷰포트가 밀리며 레이아웃이 깨진다. 주 동선도 소셜 버튼이라 불필요. */}
                <input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") sendLink();
                  }}
                  placeholder="you@example.com"
                  className="w-full bg-transparent text-[15px] text-ink outline-none placeholder:text-[#B8B2A9]"
                />
              </div>

              {status === "error" && (
                <p className="mt-[8px] text-[12px] text-brand">
                  로그인에 실패했어요. 잠시 후 다시 시도해주세요.
                  {errorMsg ? ` (${errorMsg})` : ""}
                </p>
              )}

              <button
                type="button"
                disabled={!emailValid || status === "sending"}
                onClick={sendLink}
                className="mt-[16px] h-[50px] w-full rounded-[14px] bg-brand text-[15px] font-semibold text-white disabled:opacity-40"
              >
                {status === "sending" ? "보내는 중…" : "로그인 링크 받기"}
              </button>

              {/* 실제 동의는 로그인 후 /welcome 에서 받는다. 여기선 문서 위치만 안내. */}
              <p className="mt-[12px] text-center text-[11px] leading-[1.6] text-[#A39D94]">
                로그인하면{" "}
                <Link href="/terms" className="font-semibold text-muted underline">
                  이용약관
                </Link>
                {" 및 "}
                <Link
                  href="/privacy"
                  className="font-semibold text-muted underline"
                >
                  개인정보처리방침
                </Link>
                에<br />
                동의 절차가 이어집니다.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** 카카오 브랜드 마크(말풍선). 외부 브랜드 자산이라 서비스 일러스트 폴더와 분리. */
function KakaoGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#191600"
        d="M12 3C6.99 3 2.93 6.2 2.93 10.15c0 2.52 1.66 4.73 4.15 5.99-.18.65-.66 2.37-.75 2.74-.12.46.17.45.35.33.15-.1 2.28-1.55 3.2-2.18.7.1 1.4.16 2.12.16 5.01 0 9.07-3.2 9.07-7.04C21.07 6.2 17.01 3 12 3z"
      />
    </svg>
  );
}

/** 구글 브랜드 마크(공식 4색 G). 외부 브랜드 자산이라 서비스 일러스트 폴더와 분리. */
function GoogleGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#4285F4"
        d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"
      />
      <path
        fill="#34A853"
        d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7A21.99 21.99 0 0 0 24 46z"
      />
      <path
        fill="#FBBC05"
        d="M11.69 28.18A13.2 13.2 0 0 1 11 24c0-1.45.25-2.86.69-4.18v-5.7H4.34A22 22 0 0 0 2 24c0 3.55.85 6.91 2.34 9.88l7.35-5.7z"
      />
      <path
        fill="#EA4335"
        d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.94 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"
      />
    </svg>
  );
}
