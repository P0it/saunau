"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { Sauna } from "@/lib/data/types";
import { useRecentIds } from "@/lib/recent";
import { getSaunasByIds } from "@/lib/data/queries";
import { TempHeadline } from "@/components/sauna/TempHeadline";
import { saunaHref } from "@/components/sauna/SaunaCard";
import { SaunaImage } from "@/components/sauna/SaunaImage";

/** 최근 본 사우나 peek — 최근 id를 Supabase에서 직접 조회. 기록 없으면 섹션 숨김. */
export function RecentPeek() {
  const ids = useRecentIds();
  const [recent, setRecent] = useState<Sauna | null>(null);

  useEffect(() => {
    let alive = true;
    // getSaunasByIds([]) → [] 이므로 빈 경우도 동일 경로(동기 setState 회피).
    getSaunasByIds(ids.slice(0, 1))
      .then((rows) => {
        if (alive) setRecent(rows[0] ?? null);
      })
      .catch(() => {
        if (alive) setRecent(null);
      });
    return () => {
      alive = false;
    };
  }, [ids]);

  if (!recent) return null;

  return (
    <Link
      href={saunaHref(recent)}
      className="mt-[4px] flex items-center gap-[12px] rounded-[18px] bg-card px-[14px] py-[12px] shadow-[0_2px_12px_rgba(0,0,0,0.05)]"
    >
      <div className="relative h-[48px] w-[48px] flex-none overflow-hidden rounded-[12px] bg-[#EEF0F2]">
        <SaunaImage
          src={recent.thumbnail_url}
          alt={recent.name}
          sizes="48px"
          iconSize={18}
        />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-semibold text-brand">최근 본 사우나</div>
        <div className="mt-[2px] truncate text-[14px] font-semibold text-ink">
          {recent.name}
        </div>
      </div>
      <div className="flex items-center gap-[6px]">
        <TempHeadline
          saunaTemp={recent.sauna_room_temp}
          coldTemp={recent.cold_bath_temp}
        />
        <ChevronRight size={18} className="text-[#C9C4BD]" />
      </div>
    </Link>
  );
}
