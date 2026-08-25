"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Sauna } from "@/lib/data/types";
import { ScrubberIcon } from "@/components/sauna/ScrubberIcon";
import { useFavorites } from "@/lib/favorites";
import { LoginSheet } from "@/components/auth/LoginSheet";
import { getSaunasByIds } from "@/lib/data/queries";
import { SaunaCard } from "@/components/sauna/SaunaCard";

/**
 * 찜 — 하단 탭. 때수건으로 모은 사우나만 모아본다(폐업도 resolve).
 * 비로그인이면 이 기기에만 저장된 목록을 그대로 보여주고 배너로 로그인을 권한다 —
 * 로그인하는 순간 lib/favorites 가 서버로 병합한다.
 */
export default function FavoritesPage() {
  const { ids, isLocal, loading } = useFavorites();
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

      {/* 이 기기에만 저장 중임을 알리는 배너. 찜이 하나라도 있을 때만 —
          빈 화면에서는 안내가 겹쳐 잔소리처럼 읽힌다. */}
      {!loading && isLocal && ids.length > 0 && (
        <button
          type="button"
          onClick={() => setLoginOpen(true)}
          className="mx-[16px] mb-[12px] flex items-center justify-between rounded-[14px] bg-[#F7F6F4] px-[16px] py-[13px] text-left"
        >
          <span className="pr-[12px] text-[13px] leading-[1.5] text-muted">
            지금은 <span className="font-semibold text-ink">이 기기에만</span>{" "}
            저장돼요.
            <br />
            로그인하면 어디서 접속해도 그대로예요.
          </span>
          <span className="flex-none rounded-full bg-brand px-[14px] py-[7px] text-[13px] font-semibold text-white">
            로그인
          </span>
        </button>
      )}

      {loading ? null : saved.length === 0 ? (
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
