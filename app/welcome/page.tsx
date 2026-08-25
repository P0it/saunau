"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { TERMS_VERSION } from "@/lib/legal-version";
import { SteamMark } from "@/components/illustrations";

/**
 * 가입 절차 — 로그인 직후 1회. ① 약관 동의 ② 닉네임 설정.
 *
 * 시트가 아니라 라우트인 이유: 카카오·구글은 페이지를 떠났다 /auth/callback 으로
 * 돌아오므로 시트 상태가 살아남지 못한다.
 * 완료 전까지 AppFrame 게이트가 다른 화면 진입을 막는다.
 */
type Step = "agree" | "nickname";

const NICK_MIN = 2;
const NICK_MAX = 12;

export default function WelcomePage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("agree");
  const [ready, setReady] = useState(false);

  // 동의 상태
  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [marketing, setMarketing] = useState(false);

  // 닉네임
  const [nickname, setNickname] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // 로그인 확인 + OAuth가 준 이름을 닉네임 기본값으로.
  useEffect(() => {
    let alive = true;
    void (async () => {
      const supabase = createSupabaseBrowserClient();
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (!user) {
        router.replace("/my");
        return;
      }
      if (!alive) return;
      const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
      const suggested =
        (meta.name as string) ||
        (meta.nickname as string) ||
        (meta.full_name as string) ||
        (meta.user_name as string) ||
        "";
      setNickname(suggested.slice(0, NICK_MAX));
      setReady(true);
    })();
    return () => {
      alive = false;
    };
  }, [router]);

  const allRequired = terms && privacy;
  const allChecked = terms && privacy && marketing;
  const nickTrimmed = nickname.trim();
  const nickValid =
    nickTrimmed.length >= NICK_MIN && nickTrimmed.length <= NICK_MAX;

  function toggleAll() {
    const next = !allChecked;
    setTerms(next);
    setPrivacy(next);
    setMarketing(next);
  }

  async function finish() {
    if (!nickValid || saving) return;
    setSaving(true);
    setError("");
    const supabase = createSupabaseBrowserClient();
    const { data } = await supabase.auth.getUser();
    const id = data.user?.id;
    if (!id) {
      router.replace("/my");
      return;
    }
    const now = new Date().toISOString();
    // upsert — 트리거가 만든 행이 있으면 갱신, 없으면(복구 상황) 생성.
    const { error: upsertError } = await supabase.from("profiles").upsert(
      {
        id,
        nickname: nickTrimmed,
        terms_agreed_at: now,
        privacy_agreed_at: now,
        marketing_agreed_at: marketing ? now : null,
        terms_version: TERMS_VERSION,
        onboarded_at: now,
      },
      { onConflict: "id" },
    );
    if (upsertError) {
      setError("저장에 실패했어요. 잠시 후 다시 시도해주세요.");
      setSaving(false);
      return;
    }
    // 게이트가 최신 profiles 를 다시 읽도록 전체 새로고침으로 진입.
    window.location.replace("/my");
  }

  if (!ready) return null;

  return (
    <div className="flex min-h-full flex-col bg-white">
      <header className="flex h-[52px] flex-none items-center px-[8px]">
        {step === "nickname" ? (
          <button
            type="button"
            aria-label="뒤로"
            onClick={() => setStep("agree")}
            className="flex h-[40px] w-[40px] items-center justify-center text-ink"
          >
            <ChevronLeft size={24} />
          </button>
        ) : (
          <div className="h-[40px] w-[40px]" />
        )}
        <div className="ml-auto mr-[14px] flex items-center gap-[6px]">
          <StepDot active />
          <StepDot active={step === "nickname"} />
        </div>
      </header>

      {step === "agree" ? (
        <div className="flex flex-1 flex-col px-[20px] pb-[28px]">
          <SteamMark size={44} />
          <h1 className="mt-[16px] text-[24px] font-extrabold leading-[1.35] tracking-[-0.02em] text-ink">
            사우나우에 오신 걸
            <br />
            환영해요
          </h1>
          <p className="mt-[10px] text-[14px] leading-[1.6] text-muted">
            서비스 이용을 위해 약관에 동의해주세요.
          </p>

          <button
            type="button"
            onClick={toggleAll}
            className="mt-[26px] flex items-center gap-[12px] rounded-[14px] bg-[#F7F6F4] px-[16px] py-[16px] text-left"
          >
            <CheckBox checked={allChecked} />
            <span className="text-[16px] font-bold text-ink">전체 동의</span>
          </button>

          <div className="mt-[8px] flex flex-col">
            <AgreeRow
              checked={terms}
              onToggle={() => setTerms((v) => !v)}
              label="이용약관 동의"
              required
              href="/terms"
            />
            <AgreeRow
              checked={privacy}
              onToggle={() => setPrivacy((v) => !v)}
              label="개인정보처리방침 동의"
              required
              href="/privacy"
            />
            <AgreeRow
              checked={marketing}
              onToggle={() => setMarketing((v) => !v)}
              label="마케팅 정보 수신 동의"
              href="/privacy"
            />
          </div>

          <p className="mt-[14px] text-[12px] leading-[1.6] text-[#A39D94]">
            마케팅 수신에 동의하지 않아도 서비스를 이용할 수 있어요.
          </p>

          <div className="flex-1" />
          <button
            type="button"
            disabled={!allRequired}
            onClick={() => setStep("nickname")}
            className="mt-[24px] h-[52px] w-full rounded-[14px] bg-brand text-[16px] font-semibold text-white disabled:opacity-40"
          >
            동의하고 계속하기
          </button>
        </div>
      ) : (
        <div className="flex flex-1 flex-col px-[20px] pb-[28px]">
          <h1 className="mt-[8px] text-[24px] font-extrabold leading-[1.35] tracking-[-0.02em] text-ink">
            어떤 이름으로
            <br />
            불러드릴까요?
          </h1>
          <p className="mt-[10px] text-[14px] leading-[1.6] text-muted">
            후기를 남기면 이 이름이 함께 표시돼요. 나중에 바꿀 수 있어요.
          </p>

          <div className="mt-[24px] rounded-[12px] border border-line bg-white px-[16px] py-[14px]">
            <input
              value={nickname}
              onChange={(e) => setNickname(e.target.value.slice(0, NICK_MAX))}
              onKeyDown={(e) => {
                if (e.key === "Enter") finish();
              }}
              maxLength={NICK_MAX}
              placeholder="닉네임"
              className="w-full bg-transparent text-[17px] font-semibold text-ink outline-none placeholder:font-normal placeholder:text-[#B8B2A9]"
            />
          </div>
          <div className="mt-[8px] flex items-center justify-between">
            <span className="text-[12px] text-[#A39D94]">
              {NICK_MIN}~{NICK_MAX}자
            </span>
            <span className="text-[12px] tabular-nums text-[#A39D94]">
              {nickTrimmed.length}/{NICK_MAX}
            </span>
          </div>
          {error && <p className="mt-[10px] text-[12px] text-brand">{error}</p>}

          <div className="flex-1" />
          <button
            type="button"
            disabled={!nickValid || saving}
            onClick={finish}
            className="mt-[24px] h-[52px] w-full rounded-[14px] bg-brand text-[16px] font-semibold text-white disabled:opacity-40"
          >
            {saving ? "저장 중…" : "시작하기"}
          </button>
        </div>
      )}
    </div>
  );
}

function StepDot({ active }: { active?: boolean }) {
  return (
    <span
      className={`h-[6px] rounded-full transition-all ${
        active ? "w-[18px] bg-brand" : "w-[6px] bg-[#E2DFD9]"
      }`}
    />
  );
}

function CheckBox({ checked }: { checked: boolean }) {
  return (
    <span
      className={`flex h-[24px] w-[24px] flex-none items-center justify-center rounded-full ${
        checked ? "bg-brand text-white" : "bg-[#E2DFD9] text-white"
      }`}
    >
      <Check size={15} strokeWidth={3} />
    </span>
  );
}

function AgreeRow({
  checked,
  onToggle,
  label,
  required,
  href,
}: {
  checked: boolean;
  onToggle: () => void;
  label: string;
  required?: boolean;
  href: string;
}) {
  return (
    <div className="flex items-center gap-[12px] px-[16px] py-[12px]">
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={checked}
        className="flex flex-1 items-center gap-[12px] text-left"
      >
        <CheckBox checked={checked} />
        <span className="text-[14px] text-ink">
          <span className={required ? "text-brand" : "text-[#A39D94]"}>
            ({required ? "필수" : "선택"})
          </span>{" "}
          {label}
        </span>
      </button>
      <Link
        href={href}
        aria-label={`${label} 보기`}
        className="flex h-[32px] w-[32px] items-center justify-center text-[#A39D94]"
      >
        <ChevronRight size={18} />
      </Link>
    </div>
  );
}
