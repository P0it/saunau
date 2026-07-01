"use client";

import { useEffect, useRef, useState } from "react";
import { Lock, Pencil, Trash2, MessageSquareText, ImagePlus, X } from "lucide-react";
import type { SaunaReview, SaunaPhoto } from "@/lib/data/types";
import { useAuth } from "@/lib/auth";
import { fetchSaunaReviews, upsertReview, deleteReview } from "@/lib/reviews";
import { uploadUserPhoto, deleteUserPhoto } from "@/lib/photos";
import { FlameRating } from "./FlameRating";
import { LoginSheet } from "@/components/auth/LoginSheet";

const MAX_REVIEW_PHOTOS = 5; // 후기 1개당 사진 상한(서버와 동일)

const PHOTO_REASON_LABEL: Record<string, string> = {
  unsupported_type: "JPG·PNG·WEBP 이미지만 올릴 수 있어요.",
  too_large: "12MB 이하 이미지만 올릴 수 있어요.",
  rate_limited: "오늘 업로드 한도를 초과했어요.",
  review_photo_limit: `사진은 후기당 ${MAX_REVIEW_PHOTOS}장까지예요.`,
  blocked_adult: "부적절한 사진은 등록되지 않아요.",
  blocked_violence: "부적절한 사진은 등록되지 않아요.",
  blocked_racy: "부적절한 사진은 등록되지 않아요.",
};

/**
 * 방문자 후기 — 회원이 남기는 불꽃 5점 + 한줄평(공유 노출). 상세에서 블로그 리뷰 위에 온다.
 * 로그인 사용자만 작성(1인 1후기/매장). 내 후기는 맨 위에 수정/삭제와 함께 표시.
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
  const [keepPhotos, setKeepPhotos] = useState<SaunaPhoto[]>([]); // 유지할 기존 사진
  const [newFiles, setNewFiles] = useState<File[]>([]); // 새로 올릴 사진
  const [photoErr, setPhotoErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const myReview = user ? reviews.find((r) => r.userId === user.id) : undefined;
  const others = reviews.filter((r) => r.userId !== user?.id);
  const count = reviews.length;
  const avg = count
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / count
    : 0;

  const photoTotal = keepPhotos.length + newFiles.length;

  const startWrite = () => {
    setDraftRating(myReview?.rating ?? 0);
    setDraftBody(myReview?.body ?? "");
    setKeepPhotos(myReview?.photos ?? []);
    setNewFiles([]);
    setPhotoErr(null);
    setEditing(true);
  };

  const addFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (picked.length === 0) return;
    const room = MAX_REVIEW_PHOTOS - photoTotal;
    if (room <= 0) {
      setPhotoErr(`사진은 최대 ${MAX_REVIEW_PHOTOS}장까지예요.`);
      return;
    }
    setPhotoErr(picked.length > room ? `사진은 최대 ${MAX_REVIEW_PHOTOS}장까지예요.` : null);
    setNewFiles((prev) => [...prev, ...picked.slice(0, room)]);
  };

  const save = async () => {
    if (!user || !draftRating || busy) return;
    setBusy(true);
    setPhotoErr(null);
    const reviewId = await upsertReview(saunaId, user.id, draftRating, draftBody);
    if (reviewId) {
      // 제거된 기존 사진 삭제(베스트 에포트)
      const removed = (myReview?.photos ?? []).filter(
        (p) => !keepPhotos.some((k) => k.id === p.id),
      );
      await Promise.all(removed.map((p) => deleteUserPhoto(p.id)));
      // 새 사진 순차 업로드(모더레이션·상한은 라우트가 파일별 처리)
      let lastReason = "";
      for (const file of newFiles) {
        const res = await uploadUserPhoto(saunaId, file, reviewId);
        if (!res.ok) lastReason = res.reason ?? "";
      }
      const fresh = await fetchSaunaReviews(saunaId);
      setReviews(fresh);
      if (lastReason) {
        // 성공분은 이미 저장됨 → 재시도 시 중복 업로드 방지로 초안을 최신 상태로 리셋.
        setKeepPhotos(fresh.find((r) => r.userId === user.id)?.photos ?? []);
        setNewFiles([]);
        setPhotoErr(PHOTO_REASON_LABEL[lastReason] ?? "일부 사진 업로드에 실패했어요.");
      } else {
        setEditing(false);
      }
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
          <FlameRating
            value={draftRating}
            onChange={setDraftRating}
            size={30}
          />
          <textarea
            value={draftBody}
            onChange={(e) => setDraftBody(e.target.value)}
            rows={3}
            placeholder="한줄평을 남겨보세요 (선택)"
            className="mt-[12px] w-full rounded-[12px] border border-line bg-[#FBFAF8] p-[12px] text-[14px] leading-[1.55] text-ink outline-none"
          />

          {/* 사진 첨부(최대 5장) */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="hidden"
            onChange={addFiles}
          />
          <div className="mt-[12px] flex flex-wrap gap-[8px]">
            {keepPhotos.map((p) => (
              <PhotoThumb
                key={p.id}
                src={p.url}
                onRemove={() =>
                  setKeepPhotos((prev) => prev.filter((x) => x.id !== p.id))
                }
              />
            ))}
            {newFiles.map((file, i) => (
              <NewPhotoThumb
                key={`${file.name}-${i}`}
                file={file}
                onRemove={() =>
                  setNewFiles((prev) => prev.filter((_, j) => j !== i))
                }
              />
            ))}
            {photoTotal < MAX_REVIEW_PHOTOS && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                aria-label="사진 추가"
                className="flex h-[62px] w-[62px] flex-none flex-col items-center justify-center gap-[2px] rounded-[10px] border border-dashed border-[#DAD6CF] bg-[#FBFAF8] text-muted"
              >
                <ImagePlus size={18} />
                <span className="text-[10px] font-semibold tabular-nums">
                  {photoTotal}/{MAX_REVIEW_PHOTOS}
                </span>
              </button>
            )}
          </div>
          {photoErr && (
            <p className="mt-[6px] text-[12px] text-brand">{photoErr}</p>
          )}

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
      <ReviewPhotoStrip photos={review.photos} />
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
      <ReviewPhotoStrip photos={review.photos} />
    </li>
  );
}

/* ── 사진 관련 ── */

/** 후기 카드에 붙는 사진 썸네일 가로 스트립(읽기 전용). */
function ReviewPhotoStrip({ photos }: { photos: SaunaPhoto[] }) {
  if (!photos.length) return null;
  return (
    <div className="mt-[10px] flex flex-wrap gap-[6px]">
      {photos.map((p) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={p.id}
          src={p.url}
          alt=""
          loading="lazy"
          className="h-[76px] w-[76px] flex-none rounded-[10px] object-cover"
        />
      ))}
    </div>
  );
}

/** 편집기 안 기존 사진 썸네일(삭제 가능). */
function PhotoThumb({ src, onRemove }: { src: string; onRemove: () => void }) {
  return (
    <div className="relative h-[62px] w-[62px] flex-none">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        className="h-full w-full rounded-[10px] object-cover"
      />
      <RemoveBadge onRemove={onRemove} />
    </div>
  );
}

/** 편집기 안 새로 고른 파일 썸네일(로컬 미리보기, 삭제 가능). */
function NewPhotoThumb({ file, onRemove }: { file: File; onRemove: () => void }) {
  const [url] = useState(() => URL.createObjectURL(file)); // 마운트 시 1회 생성
  useEffect(() => () => URL.revokeObjectURL(url), [url]); // 언마운트 시 해제
  return (
    <div className="relative h-[62px] w-[62px] flex-none">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt=""
        className="h-full w-full rounded-[10px] object-cover"
      />
      <RemoveBadge onRemove={onRemove} />
    </div>
  );
}

function RemoveBadge({ onRemove }: { onRemove: () => void }) {
  return (
    <button
      type="button"
      aria-label="사진 삭제"
      onClick={onRemove}
      className="absolute -right-[5px] -top-[5px] flex h-[20px] w-[20px] items-center justify-center rounded-full bg-black/70 text-white"
    >
      <X size={13} />
    </button>
  );
}
