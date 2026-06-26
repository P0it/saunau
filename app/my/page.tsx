"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Heart, Settings, Check, Lock, Plus, Waves } from "lucide-react";
import { CATEGORY_LABEL, primaryCategory, type Sauna } from "@/lib/data/types";
import { useFavorites } from "@/lib/favorites";
import { useVisits, type VisitRecord } from "@/lib/visits";
import { getSaunasByIds } from "@/lib/data/queries";
import { SaunaCard, saunaHref } from "@/components/sauna/SaunaCard";

type Tab = "saved" | "visited";

export default function MyPage() {
  const [tab, setTab] = useState<Tab>("saved");
  const { ids } = useFavorites();
  const { visits } = useVisits();

  // 찜·다녀옴이 참조하는 사우나를 id로 한 번에 조회(폐업도 resolve).
  const allIds = useMemo(() => {
    const set = new Set<string>(ids);
    visits.forEach((v) => set.add(v.saunaId));
    return [...set];
  }, [ids, visits]);

  const [byId, setById] = useState<Map<string, Sauna>>(new Map());
  useEffect(() => {
    let alive = true;
    // getSaunasByIds([]) → [] 이므로 빈 경우도 동일 경로로 처리(동기 setState 회피).
    getSaunasByIds(allIds)
      .then((rows) => {
        if (alive) setById(new Map(rows.map((s) => [s.id, s])));
      })
      .catch(() => {
        if (alive) setById(new Map());
      });
    return () => {
      alive = false;
    };
  }, [allIds]);

  const saved = ids
    .map((id) => byId.get(id))
    .filter((s): s is Sauna => Boolean(s));

  return (
    <div className="flex flex-col">
      <header className="flex flex-none items-center justify-between px-[20px] pb-[14px] pt-[14px]">
        <div className="flex rounded-full bg-[#F3F3F5] p-[3px]">
          <TabButton active={tab === "saved"} onClick={() => setTab("saved")}>
            찜 <CountNum active={tab === "saved"}>{ids.length}</CountNum>
          </TabButton>
          <TabButton active={tab === "visited"} onClick={() => setTab("visited")}>
            다녀옴 <CountNum active={tab === "visited"}>{visits.length}</CountNum>
          </TabButton>
        </div>
        <button
          type="button"
          aria-label="설정"
          className="flex h-[40px] w-[40px] items-center justify-center text-ink"
        >
          <Settings size={22} />
        </button>
      </header>

      {tab === "saved" ? (
        saved.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="flex flex-col gap-[14px] px-[16px] pb-[20px]">
            {saved.map((s) => (
              <SaunaCard key={s.id} sauna={s} />
            ))}
          </div>
        )
      ) : visits.length === 0 ? (
        <VisitedEmpty />
      ) : (
        <div className="flex flex-col gap-[24px] px-[20px] pb-[20px] pt-[2px]">
          {visits.map((v) => {
            const s = byId.get(v.saunaId);
            if (!s) return null;
            return <VisitedCard key={v.saunaId} sauna={s} visit={v} />;
          })}
        </div>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full px-[15px] py-[7px] text-[14px] font-semibold"
      style={
        active
          ? { background: "#fff", color: "var(--color-ink)", boxShadow: "0 1px 3px rgba(0,0,0,.08)" }
          : { color: "var(--color-muted)" }
      }
    >
      {children}
    </button>
  );
}

function CountNum({ active, children }: { active: boolean; children: React.ReactNode }) {
  return (
    <span
      className="tabular-nums"
      style={{ color: active ? "var(--color-brand)" : "#B0AAA1" }}
    >
      {children}
    </span>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center px-[20px] py-[90px] text-center">
      <div className="flex h-[84px] w-[84px] items-center justify-center rounded-full bg-[#FDECE9]">
        <Heart size={38} className="text-brand" />
      </div>
      <p className="mt-[18px] text-[15px] font-semibold text-ink">
        마음에 드는 사우나를 찜해보세요
      </p>
      <p className="mt-[6px] text-[13px] text-muted">하트를 누르면 여기에 모여요</p>
      <Link
        href="/list"
        className="mt-[20px] rounded-full bg-brand px-[20px] py-[11px] text-[14px] font-semibold text-white"
      >
        사우나 둘러보기
      </Link>
    </div>
  );
}

function VisitedEmpty() {
  return (
    <div className="flex flex-col items-center justify-center px-[20px] py-[90px] text-center">
      <div className="flex h-[84px] w-[84px] items-center justify-center rounded-full bg-[#F2F1EF]">
        <Check size={38} className="text-muted" />
      </div>
      <p className="mt-[18px] text-[15px] font-semibold text-ink">
        아직 다녀온 기록이 없어요
      </p>
      <p className="mt-[6px] text-[13px] text-muted">
        상세 화면에서 ‘다녀옴’을 남겨보세요
      </p>
    </div>
  );
}

function formatVisitDate(iso: string): string {
  // ISO(YYYY-MM-DD...) 파싱 — 로케일 비의존
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${Number(m)}월 ${Number(d)}일 방문`;
}

function VisitedCard({ sauna, visit }: { sauna: Sauna; visit: VisitRecord }) {
  const { setMemo } = useVisits();
  const { isFavorite, toggle } = useFavorites();
  const fav = isFavorite(sauna.id);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(visit.memo ?? "");

  const cat = CATEGORY_LABEL[primaryCategory(sauna)];

  return (
    <div>
      <Link href={saunaHref(sauna)} className="relative block overflow-hidden rounded-[16px]">
        <div className="flex aspect-[16/10] items-center justify-center bg-[#EEF0F2]">
          <Waves size={42} className="text-[#C3C7CD]" />
        </div>
        <div className="absolute left-[10px] top-[10px] flex h-[30px] items-center gap-[4px] rounded-full bg-[rgba(34,32,30,.85)] pl-[9px] pr-[12px]">
          <Check size={15} className="text-white" />
          <span className="text-[12px] font-semibold text-white">다녀옴</span>
        </div>
        <button
          type="button"
          aria-label={fav ? "찜 해제" : "찜하기"}
          onClick={(e) => {
            e.preventDefault();
            toggle(sauna.id);
          }}
          className="absolute right-[10px] top-[10px] flex h-[34px] w-[34px] items-center justify-center rounded-full bg-white/90 shadow-[0_1px_5px_rgba(0,0,0,0.14)]"
        >
          <Heart
            size={18}
            fill={fav ? "#F5402C" : "none"}
            stroke={fav ? "#F5402C" : "#C9C4BD"}
          />
        </button>
      </Link>

      <div className="px-[2px] pt-[12px]">
        <div className="flex items-center gap-[7px]">
          <span className="text-[16px] font-semibold text-ink">{sauna.name}</span>
          <span className="rounded-[6px] border border-[#E6E6E9] px-[6px] py-[2px] text-[11px] font-semibold text-muted">
            {cat}
          </span>
        </div>
        <div className="mt-[7px] text-[13px] font-normal text-muted tabular-nums">
          {formatVisitDate(visit.visitedAt)}
          {sauna.distance_km != null && <> · {sauna.distance_km}km</>} · {sauna.dong}
        </div>

        {editing ? (
          <div className="mt-[11px]">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={3}
              autoFocus
              placeholder="나만 보는 메모를 남겨보세요"
              className="w-full rounded-[12px] border border-line bg-card p-[12px] text-[13px] leading-[1.55] text-ink outline-none"
            />
            <div className="mt-[8px] flex justify-end gap-[8px]">
              <button
                type="button"
                onClick={() => {
                  setDraft(visit.memo ?? "");
                  setEditing(false);
                }}
                className="rounded-full px-[14px] py-[7px] text-[13px] font-semibold text-muted"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => {
                  setMemo(sauna.id, draft.trim());
                  setEditing(false);
                }}
                className="rounded-full bg-brand px-[16px] py-[7px] text-[13px] font-semibold text-white"
              >
                저장
              </button>
            </div>
          </div>
        ) : visit.memo ? (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="mt-[11px] block w-full rounded-[12px] bg-[#F7F6F4] p-[11px_13px] text-left"
          >
            <div className="mb-[5px] flex items-center gap-[5px] text-[11px] font-semibold text-[#9A938A]">
              <Lock size={12} />
              나만의 메모
            </div>
            <div className="text-[13px] leading-[1.55] text-[#46423E] text-pretty">
              {visit.memo}
            </div>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="mt-[11px] flex h-[42px] w-full items-center justify-center gap-[6px] rounded-[12px] border border-dashed border-[#DAD6CF] bg-card text-[13px] font-semibold text-muted"
          >
            <Plus size={15} />
            나만의 메모 추가
          </button>
        )}
      </div>
    </div>
  );
}
