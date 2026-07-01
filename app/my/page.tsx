"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Heart, MessageSquareText, Plus, Trash2, Lock } from "lucide-react";
import { CATEGORY_LABEL, primaryCategory, type Sauna } from "@/lib/data/types";
import { useFavorites } from "@/lib/favorites";
import { useMyReviews, type MyReview } from "@/lib/reviews";
import { useRecords } from "@/lib/records";
import { getSaunasByIds } from "@/lib/data/queries";
import { useAuth } from "@/lib/auth";
import { saunaHref } from "@/components/sauna/SaunaCard";
import { SaunaImage } from "@/components/sauna/SaunaImage";
import { FlameRating } from "@/components/sauna/FlameRating";
import { RecordsTab } from "@/components/my/RecordsTab";
import { LoginSheet } from "@/components/auth/LoginSheet";
import { AccountSheet } from "@/components/auth/AccountSheet";
import { ProfileHeader } from "@/components/auth/ProfileHeader";

type Tab = "review" | "record";

export default function MyPage() {
  const [tab, setTab] = useState<Tab>("review");
  const { reviews, loading: reviewsLoading, setRating, setBody, remove } =
    useMyReviews();
  const { records } = useRecords();
  const { user, nickname, loading: authLoading } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);

  // 후기가 참조하는 사우나를 id로 한 번에 조회(폐업도 resolve).
  // 기록 탭은 자체적으로 사우나를 resolve 하므로 여기선 제외.
  const allIds = useMemo(() => {
    const set = new Set<string>();
    reviews.forEach((r) => set.add(r.saunaId));
    return [...set];
  }, [reviews]);

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

  return (
    <div className="flex min-h-full flex-col">
      {/* 상단 계정 헤더는 로그인 상태에서만. 비로그인은 중앙 프롬프트가 로그인 유도(중복 제거). */}
      {(authLoading || user) && (
        <ProfileHeader
          email={user?.email ?? null}
          nickname={nickname}
          loading={authLoading}
          onOpen={() => setAuthOpen(true)}
        />
      )}
      <header className="flex flex-none items-center px-[20px] pb-[14px] pt-[2px]">
        <div className="flex rounded-full bg-[#F3F3F5] p-[3px]">
          <TabButton active={tab === "review"} onClick={() => setTab("review")}>
            후기 <CountNum active={tab === "review"}>{reviews.length}</CountNum>
          </TabButton>
          <TabButton active={tab === "record"} onClick={() => setTab("record")}>
            기록 <CountNum active={tab === "record"}>{records.length}</CountNum>
          </TabButton>
        </div>
      </header>

      {tab === "review" ? (
        !user ? (
          <ReviewLoginPrompt onLogin={() => setAuthOpen(true)} />
        ) : reviewsLoading ? null : reviews.length === 0 ? (
          <ReviewEmpty />
        ) : (
          <div className="flex flex-col gap-[24px] px-[20px] pb-[20px] pt-[2px]">
            {reviews.map((r) => {
              const s = byId.get(r.saunaId);
              if (!s) return null;
              return (
                <ReviewCard
                  key={r.saunaId}
                  sauna={s}
                  review={r}
                  onRate={(n) => setRating(r.saunaId, n)}
                  onBody={(b) => setBody(r.saunaId, b)}
                  onRemove={() => remove(r.saunaId)}
                />
              );
            })}
          </div>
        )
      ) : (
        <RecordsTab />
      )}

      {user ? (
        <AccountSheet open={authOpen} onClose={() => setAuthOpen(false)} />
      ) : (
        <LoginSheet open={authOpen} onClose={() => setAuthOpen(false)} />
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
      className="rounded-full px-[14px] py-[7px] text-[14px] font-semibold"
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

function ReviewEmpty() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-[20px] py-[40px] text-center">
      <div className="flex h-[84px] w-[84px] items-center justify-center rounded-full bg-[#F2F1EF]">
        <MessageSquareText size={36} className="text-muted" />
      </div>
      <p className="mt-[18px] text-[15px] font-semibold text-ink">
        아직 남긴 후기가 없어요
      </p>
      <p className="mt-[6px] text-[13px] text-muted">
        상세 화면에서 불꽃 점수와 한줄평을 남겨보세요
      </p>
    </div>
  );
}

function ReviewLoginPrompt({ onLogin }: { onLogin: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-[20px] py-[40px] text-center">
      <div className="flex h-[84px] w-[84px] items-center justify-center rounded-full bg-[#F2F1EF]">
        <Lock size={34} className="text-muted" />
      </div>
      <p className="mt-[18px] text-[15px] font-semibold text-ink">
        로그인하면 내 후기를 모아볼 수 있어요
      </p>
      <p className="mt-[6px] text-[13px] text-muted">
        남긴 후기는 어디서 접속해도 그대로예요
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

function formatReviewDate(iso: string): string {
  // ISO(YYYY-MM-DD...) 파싱 — 로케일 비의존
  const [, m, d] = iso.slice(0, 10).split("-");
  return `${Number(m)}월 ${Number(d)}일 후기`;
}

function ReviewCard({
  sauna,
  review,
  onRate,
  onBody,
  onRemove,
}: {
  sauna: Sauna;
  review: MyReview;
  onRate: (n: number) => void;
  onBody: (b: string) => void;
  onRemove: () => void;
}) {
  const { isFavorite, toggle } = useFavorites();
  const fav = isFavorite(sauna.id);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(review.body ?? "");

  const cat = CATEGORY_LABEL[primaryCategory(sauna)];

  return (
    <div>
      <Link href={saunaHref(sauna)} className="relative block overflow-hidden rounded-[16px]">
        <div className="relative aspect-[16/10] bg-[#EEF0F2]">
          <SaunaImage
            src={sauna.thumbnail_url}
            alt={sauna.name}
            sizes="(max-width: 430px) 50vw, 200px"
            iconSize={42}
          />
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
          <button
            type="button"
            aria-label="후기 삭제"
            onClick={onRemove}
            className="ml-auto flex h-[30px] w-[30px] items-center justify-center rounded-full text-[#B9B3AB] active:bg-[#F2F1EF]"
          >
            <Trash2 size={16} />
          </button>
        </div>
        <div className="mt-[7px] text-[13px] font-normal text-muted tabular-nums">
          {formatReviewDate(review.created_at)}
          {sauna.distance_km != null && <> · {sauna.distance_km}km</>} · {sauna.dong}
        </div>

        <div className="mt-[10px] flex items-center gap-[8px]">
          <FlameRating value={review.rating} onChange={onRate} size={24} />
          {review.rating > 0 && (
            <span className="text-[13px] font-semibold text-hot tabular-nums">
              {review.rating.toFixed(1)}
            </span>
          )}
        </div>

        {editing ? (
          <div className="mt-[11px]">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={3}
              autoFocus
              placeholder="한줄평을 남겨보세요"
              className="w-full rounded-[12px] border border-line bg-card p-[12px] text-[13px] leading-[1.55] text-ink outline-none"
            />
            <div className="mt-[8px] flex justify-end gap-[8px]">
              <button
                type="button"
                onClick={() => {
                  setDraft(review.body ?? "");
                  setEditing(false);
                }}
                className="rounded-full px-[14px] py-[7px] text-[13px] font-semibold text-muted"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => {
                  onBody(draft.trim());
                  setEditing(false);
                }}
                className="rounded-full bg-brand px-[16px] py-[7px] text-[13px] font-semibold text-white"
              >
                저장
              </button>
            </div>
          </div>
        ) : review.body ? (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="mt-[11px] block w-full rounded-[12px] bg-[#F7F6F4] p-[11px_13px] text-left"
          >
            <div className="mb-[5px] flex items-center gap-[5px] text-[11px] font-semibold text-[#9A938A]">
              <MessageSquareText size={12} />
              한줄평
            </div>
            <div className="text-[13px] leading-[1.55] text-[#46423E] text-pretty">
              {review.body}
            </div>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="mt-[11px] flex h-[42px] w-full items-center justify-center gap-[6px] rounded-[12px] border border-dashed border-[#DAD6CF] bg-card text-[13px] font-semibold text-muted"
          >
            <Plus size={15} />
            한줄평 추가
          </button>
        )}
      </div>
    </div>
  );
}
