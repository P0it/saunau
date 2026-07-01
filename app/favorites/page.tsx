"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Sauna } from "@/lib/data/types";
import { Lock } from "lucide-react";
import { ScrubberIcon } from "@/components/sauna/ScrubberIcon";
import { useFavorites } from "@/lib/favorites";
import { LoginSheet } from "@/components/auth/LoginSheet";
import { getSaunasByIds } from "@/lib/data/queries";
import { SaunaCard } from "@/components/sauna/SaunaCard";

/** 찜 — 하단 탭. 하트로 모은 사우나만 모아본다(폐업도 resolve). */
export default function FavoritesPage() {
  const { ids, userId, loading } = useFavorites();
  const [loginOpen, setLoginOpen] = useState(false);

  const idList = useMemo(() => [...ids], [ids]);
  const [byId, setById] = useState<Map<string, Sauna>>(new Map());
  useEffect(() => {
    let alive = true;
    getSaunasByIds(idList)
      .then((rows) => {
        if (alive) setById(new Map(rows.map((s) => [s.id, s])));
      })
      .catch(() => {
        if (alive) setById(new Map());
      });
    return () => {
      alive = false;
    };
  }, [idList]);

  const saved = idList
    .map((id) => byId.get(id))
    .filter((s): s is Sauna => Boolean(s));

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-20 flex flex-none items-center bg-frame/90 px-[20px] pb-[12px] pt-[16px] backdrop-blur">
        <span className="text-[20px] font-extrabold tracking-[-0.02em] text-ink">
          찜
        </span>
        {ids.length > 0 && (
          <span className="ml-[8px] text-[15px] font-bold tabular-nums text-brand">
            {ids.length}
          </span>
        )}
      </header>

      {loading ? null : !userId ? (
        <LoginPrompt onLogin={() => setLoginOpen(true)} />
      ) : saved.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="flex flex-col gap-[14px] px-[16px] pb-[20px]">
          {saved.map((s) => (
            <SaunaCard key={s.id} sauna={s} />
          ))}
        </div>
      )}
      <LoginSheet open={loginOpen} onClose={() => setLoginOpen(false)} />
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-[20px] py-[40px] text-center">
      <div className="flex h-[84px] w-[84px] items-center justify-center rounded-full bg-[#F4F2EF]">
        <ScrubberIcon size={46} filled />
      </div>
      <p className="mt-[18px] text-[15px] font-semibold text-ink">
        마음에 드는 사우나를 찜해보세요
      </p>
      <p className="mt-[6px] text-[13px] text-muted">때수건을 누르면 여기에 모여요</p>
      <Link
        href="/list"
        className="mt-[20px] rounded-full bg-brand px-[20px] py-[11px] text-[14px] font-semibold text-white"
      >
        사우나 둘러보기
      </Link>
    </div>
  );
}

function LoginPrompt({ onLogin }: { onLogin: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-[20px] py-[40px] text-center">
      <div className="flex h-[84px] w-[84px] items-center justify-center rounded-full bg-[#F4F2EF]">
        <Lock size={34} className="text-muted" />
      </div>
      <p className="mt-[18px] text-[15px] font-semibold text-ink">
        로그인하면 찜을 모아볼 수 있어요
      </p>
      <p className="mt-[6px] text-[13px] text-muted">
        찜한 사우나는 어디서 접속해도 그대로예요
      </p>
      <button
        type="button"
        onClick={onLogin}
        className="mt-[20px] rounded-full bg-brand px-[20px] py-[11px] text-[14px] font-semibold text-white"
      >
        로그인
      </button>
    </div>
  );
}
