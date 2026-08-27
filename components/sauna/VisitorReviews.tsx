"use client";

import { useState } from "react";
import { Lock, Pencil, Trash2, MessageSquareText } from "lucide-react";
import type { SaunaReview } from "@/lib/data/types";
import { useAuth } from "@/lib/auth";
import {
  fetchSaunaReviews,
  upsertReview,
  deleteReview,
  REVIEW_BODY_MAX,
} from "@/lib/reviews";
import { FlameRating } from "./FlameRating";
import { LoginSheet } from "@/components/auth/LoginSheet";

/**
 * 방문자 후기 — 회원이 남기는 불꽃 5점 + 한줄평(공유 노출). 상세에서 블로그 리뷰 위에 온다.
 * 로그인 사용자만 작성(1인 1후기/매장). 내 후기는 맨 위에 수정/삭제와 함께 표시.
 *
 * ⚠ 사진 첨부는 없다 — 사우나와 무관한 사진이 섞이는 오염을 막으려고 매장 사진은
 *   운영자만 등록한다(components/sauna/AdminPhotoUpload). 본문은 REVIEW_BODY_MAX 자까지.
 */
export function VisitorReviews({
  saunaId,
  initialReviews,
}: {
  saunaId: string;
  initialReviews: SaunaReview[];
}) {
  const { user, nickname } = useAuth();
  const [reviews, setReviews] = useState<SaunaReview[]>(initialReviews);
  const [loginOpen, setLoginOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draftRating, setDraftRating] = useState(0);
  const [draftBody, setDraftBody] = useState("");
  const [busy, setBusy] = useState(false);

  const myReview = user ? reviews.find((r) => r.userId === user.id) : undefined;
  const others = reviews.filter((r) => r.userId !== user?.id);
  const count = reviews.length;
  const avg = count ? reviews.reduce((sum, r) => sum + r.rating, 0) / count : 0;

  const startWrite = () => {
    setDraftRating(myReview?.rating ?? 0);
    setDraftBody(myReview?.body ?? "");
    setEditing(true);
  };

  const save = async () => {
    if (!user || !draftRating || busy) return;
    setBusy(true);
    const reviewId = await upsertReview(
      saunaId,
      user.id,
      draftRating,
      draftBody,
    );
    if (reviewId) {
      setReviews(await fetchSaunaReviews(saunaId));
      setEditing(false);
    }
    setBusy(false);
  };

  const remove = async () => {
    if (!user || busy) return;
    setBusy(true);
    if (await deleteReview(saunaId, user.id)) {
      setReviews(await fetchSaunaReviews(saunaId));
      setEditing(false);
    }
    setBusy(false);
  };

  return (
    <section>
      <div className="mb-[12px] flex items-center gap-[8px]">
        <span className="h-[15px] w-[3px] flex-none rounded-full bg-brand" />
        <h2 className="text-[16px] font-bold text-ink">방문자 후기</h2>
        {count > 0 && (
          <span className="text-[13px] font-semibold text-muted tabular-nums">
            {count}
          </span>
        )}
        {count > 0 && (
          <span className="ml-auto flex items-center gap-[6px]">
            <FlameRating value={avg} size={15} gap={1} />
            <span className="text-[14px] font-bold text-hot tabular-nums">
              {avg.toFixed(1)}
            </span>
          </span>
        )}
      </div>

      {/* 후기 없음 안내 — 작성 버튼 위로 */}
      {count === 0 && !editing && (
        <div className="mb-[16px] flex flex-col items-center py-[22px] text-center">
          <MessageSquareText size={28} className="text-[#C9C4BD]" />
          <p className="mt-[8px] text-[13px] text-muted">
            아직 후기가 없어요 · 첫 후기를 남겨보세요
          </p>
        </div>
      )}

      {/* 작성 영역 */}
      {editing ? (
        <div className="mb-[16px] rounded-[16px] border border-line bg-card p-[14px]">
          <div className="mb-[10px] text-[13px] font-semibold text-ink">
            {nickname ? `${nickname}님, ` : ""}오늘 사우나 어땠나요?
          </div>
          <FlameRating value={draftRating} onChange={setDraftRating} size={30} />
          <textarea
            value={draftBody}
            onChange={(e) => setDraftBody(e.target.value)}
            rows={3}
            maxLength={REVIEW_BODY_MAX}
            placeholder="한줄평을 남겨보세요 (선택)"
            className="mt-[12px] w-full rounded-[12px] border border-line bg-[#FBFAF8] p-[12px] text-[14px] leading-[1.55] text-ink outline-none"
          />
          <div className="mt-[4px] text-right text-[11px] text-muted tabular-nums">
            {draftBody.length}/{REVIEW_BODY_MAX}
          </div>

          <div className="mt-[10px] flex justify-end gap-[8px]">
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-full px-[14px] py-[8px] text-[13px] font-semibold text-muted"
            >
              취소
            </button>
            <button
              type="button"
              disabled={!draftRating || busy}
              onClick={save}
              className="rounded-full bg-brand px-[18px] py-[8px] text-[13px] font-semibold text-white disabled:opacity-40"
            >
              {busy ? "저장 중…" : "후기 등록"}
            </button>
          </div>
        </div>
      ) : myReview ? (
        <MyReviewCard
          review={myReview}
          onEdit={startWrite}
          onDelete={remove}
          busy={busy}
        />
      ) : user ? (
        <button
          type="button"
          onClick={startWrite}
          className="mb-[16px] flex h-[48px] w-full items-center justify-center gap-[7px] rounded-[14px] border border-dashed border-[#DAD6CF] bg-card text-[14px] font-semibold text-ink"
        >
          <Pencil size={16} />
          후기 남기기
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setLoginOpen(true)}
          className="mb-[16px] flex h-[48px] w-full items-center justify-center gap-[7px] rounded-[14px] bg-brand text-[14px] font-semibold text-white"
        >
          <Lock size={15} />
          로그인하고 후기 남기기
        </button>
      )}

      {/* 다른 방문자 후기 */}
      {others.length > 0 && (
        <ul className="flex flex-col">
          {others.map((r) => (
            <ReviewItem key={r.id} review={r} />
          ))}
        </ul>
      )}

      <LoginSheet open={loginOpen} onClose={() => setLoginOpen(false)} />
    </section>
  );
}

function formatReviewDate(iso: string): string {
  const [, m, d] = iso.slice(0, 10).split("-");
  return `${Number(m)}월 ${Number(d)}일`;
}

function MyReviewCard({
  review,
  onEdit,
  onDelete,
  busy,
}: {
  review: SaunaReview;
  onEdit: () => void;
  onDelete: () => void;
  busy: boolean;
}) {
  return (
    <div className="mb-[16px] rounded-[16px] border border-[#F3D9D3] bg-[#FFF7F5] p-[14px]">
      <div className="flex items-center justify-between">
        <span className="rounded-full bg-brand px-[9px] py-[3px] text-[11px] font-bold text-white">
          내 후기
        </span>
        <div className="flex gap-[2px]">
          <button
            type="button"
            aria-label="수정"
            onClick={onEdit}
            className="flex h-[32px] w-[32px] items-center justify-center rounded-full text-muted active:bg-black/5"
          >
            <Pencil size={16} />
          </button>
          <button
            type="button"
            aria-label="삭제"
            onClick={onDelete}
            disabled={busy}
            className="flex h-[32px] w-[32px] items-center justify-center rounded-full text-[#B9B3AB] active:bg-black/5 disabled:opacity-40"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
      <div className="mt-[8px] flex items-center gap-[7px]">
        <FlameRating value={review.rating} size={18} gap={2} />
        <span className="text-[12px] text-muted tabular-nums">
          {formatReviewDate(review.created_at)}
        </span>
      </div>
      {review.body && (
        <p className="mt-[8px] text-[14px] leading-[1.55] text-ink text-pretty">
          {review.body}
        </p>
      )}
    </div>
  );
}

function ReviewItem({ review }: { review: SaunaReview }) {
  return (
    <li className="border-b border-line py-[14px] last:border-b-0">
      <div className="flex items-center gap-[8px]">
        <span className="text-[14px] font-semibold text-ink">
          {review.nickname}
        </span>
        <span className="text-[12px] text-dot tabular-nums">
          {formatReviewDate(review.created_at)}
        </span>
      </div>
      <div className="mt-[5px]">
        <FlameRating value={review.rating} size={15} gap={1} />
      </div>
      {review.body && (
        <p className="mt-[7px] text-[14px] leading-[1.55] text-ink/90 text-pretty">
          {review.body}
        </p>
      )}
    </li>
  );
}
