"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { EyeOff, RotateCcw, Loader2, ShieldCheck } from "lucide-react";

interface ReportedPhoto {
  photoId: string;
  url: string;
  source: string;
  isActive: boolean;
  saunaId: string;
  saunaName: string;
  sido: string | null;
  slug: string | null;
  count: number;
  reasons: string[];
  notes: string[];
  lastReportedAt: string;
}

const REASON_LABEL: Record<string, string> = {
  not_sauna: "사우나 무관",
  offensive: "부적절·혐오",
  privacy: "사생활 침해",
  spam: "스팸·광고",
  other: "기타",
};

/**
 * 신고함 목록 — /api/admin/reports 로 조회하고 /api/admin/photos 로 숨김·복원한다.
 * 권한은 두 라우트 모두 서버에서 ADMIN_EMAILS 로 강제하므로 여기선 표시만 한다.
 */
export function ReportInbox() {
  const [items, setItems] = useState<ReportedPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/reports?status=${showAll ? "all" : "open"}`,
      );
      const json = await res.json();
      setItems(res.ok ? (json.items ?? []) : []);
    } catch {
      setItems([]);
    }
    setLoading(false);
  }, [showAll]);

  useEffect(() => {
    // 로드는 비동기 안에서 — 이펙트 본문에서 곧장 상태를 건드리지 않는다
    // (lib/reviews.ts·lib/records.ts 와 같은 형태).
    void (async () => {
      await load();
    })();
  }, [load]);

  const act = async (photoId: string, action: "hide" | "restore") => {
    if (busyId) return;
    setBusyId(photoId);
    try {
      await fetch("/api/admin/photos", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ photoId, action }),
      });
      await load();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <label className="flex items-center gap-[8px] text-[13px] text-muted">
        <input
          type="checkbox"
          checked={showAll}
          onChange={(e) => setShowAll(e.target.checked)}
          className="h-[16px] w-[16px] accent-[#F5402C]"
        />
        이미 숨긴 사진도 보기
      </label>

      {loading ? (
        <div className="flex justify-center py-[40px] text-muted">
          <Loader2 size={20} className="animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center py-[48px] text-center">
          <ShieldCheck size={30} className="text-[#C9C4BD]" />
          <p className="mt-[8px] text-[13px] text-muted">
            처리할 신고가 없어요
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-[12px]">
          {items.map((it) => (
            <li
              key={it.photoId}
              className="flex gap-[12px] rounded-[14px] border border-line bg-card p-[12px]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={it.url}
                alt=""
                className="h-[84px] w-[84px] flex-none rounded-[10px] object-cover"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-[6px]">
                  {it.slug ? (
                    <Link
                      href={`/sauna/${encodeURIComponent(it.sido ?? "-")}/${it.slug}`}
                      className="truncate text-[14px] font-semibold text-ink underline"
                    >
                      {it.saunaName}
                    </Link>
                  ) : (
                    <span className="truncate text-[14px] font-semibold text-ink">
                      {it.saunaName}
                    </span>
                  )}
                  {!it.isActive && (
                    <span className="flex-none rounded-full bg-[#EFEDEA] px-[7px] py-[2px] text-[10px] font-semibold text-muted">
                      숨김
                    </span>
                  )}
                </div>
                <div className="mt-[4px] text-[12px] text-muted">
                  신고 {it.count}건 · {it.reasons
                    .map((r) => REASON_LABEL[r] ?? r)
                    .join(", ")}{" "}
                  · 출처 {it.source}
                </div>
                {it.notes.length > 0 && (
                  <p className="mt-[4px] line-clamp-2 text-[12px] leading-[1.5] text-ink/80">
                    {it.notes.join(" / ")}
                  </p>
                )}
                <div className="mt-[8px] flex gap-[6px]">
                  {it.isActive ? (
                    <button
                      type="button"
                      disabled={busyId === it.photoId}
                      onClick={() => act(it.photoId, "hide")}
                      className="flex items-center gap-[5px] rounded-full bg-brand px-[12px] py-[6px] text-[12px] font-semibold text-white disabled:opacity-40"
                    >
                      <EyeOff size={13} />
                      숨기기
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={busyId === it.photoId}
                      onClick={() => act(it.photoId, "restore")}
                      className="flex items-center gap-[5px] rounded-full border border-line px-[12px] py-[6px] text-[12px] font-semibold text-ink disabled:opacity-40"
                    >
                      <RotateCcw size={13} />
                      되돌리기
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
