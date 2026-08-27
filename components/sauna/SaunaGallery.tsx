"use client";

import { useState } from "react";
import { SaunaImage } from "./SaunaImage";
import { PhotoReportButton } from "./PhotoReportButton";
import { AdminPhotoHideButton } from "./AdminPhotoHideButton";
import { PhotoCredit } from "./PhotoCredit";
import type { SaunaPhoto } from "@/lib/data/types";

/**
 * 상세 히어로 갤러리. 사진이 여러 장이면 클릭(좌/우 탭)으로 전환 — 스크롤 없음.
 * 부모는 relative + 고정 높이(260px) — SaunaImage 가 fill 로 채운다.
 * 사진 0건이거나 정책 OFF면 SaunaImage 가 Waves 폴백을 렌더(폴백엔 신고 버튼 없음).
 * 수집 사진에는 출처를 함께 표기한다(PhotoCredit) — 원 권리자가 따로 있는 사진이라
 * 무표기 재게시는 곤란하다. 운영자 사진은 표기하지 않는다.
 */
export function SaunaGallery({
  photos,
  fallbackUrl,
  alt,
}: {
  photos: SaunaPhoto[];
  fallbackUrl: string | null;
  alt: string;
}) {
  const urls = photos.length
    ? photos.map((p) => p.url)
    : fallbackUrl
      ? [fallbackUrl]
      : [];

  const [idx, setIdx] = useState(0);

  // 현재 인덱스가 실제 사진(sauna_photos)일 때만 신고 가능(폴백 썸네일 제외).
  const currentPhoto = photos[idx];

  if (urls.length <= 1) {
    return (
      <div className="relative h-full w-full">
        <SaunaImage src={urls[0] ?? null} alt={alt} sizes="430px" />
        {currentPhoto && (
          <div className="absolute bottom-[12px] left-[12px] flex items-center gap-[6px]">
            <PhotoReportButton photoId={currentPhoto.id} />
            <AdminPhotoHideButton photoId={currentPhoto.id} />
            <PhotoCredit source={currentPhoto.source} />
          </div>
        )}
      </div>
    );
  }

  const total = urls.length;
  const go = (dir: 1 | -1) => setIdx((i) => (i + dir + total) % total);

  return (
    <div className="relative h-full w-full overflow-hidden">
      <SaunaImage src={urls[idx]} alt={`${alt} ${idx + 1}`} sizes="430px" />

      {/* 좌/우 탭 영역 — 클릭으로 이전·다음 사진 */}
      <button
        type="button"
        aria-label="이전 사진"
        onClick={() => go(-1)}
        className="absolute left-0 top-0 h-full w-1/2"
      />
      <button
        type="button"
        aria-label="다음 사진"
        onClick={() => go(1)}
        className="absolute right-0 top-0 h-full w-1/2"
      />

      {/* 인디케이터 dots */}
      <div className="pointer-events-none absolute bottom-[12px] left-1/2 flex -translate-x-1/2 gap-[6px]">
        {urls.map((_, i) => (
          <span
            key={i}
            className={`h-[6px] rounded-full transition-all ${
              i === idx ? "w-[16px] bg-white" : "w-[6px] bg-white/55"
            }`}
          />
        ))}
      </div>

      {/* 신고/관리(현재 사진) — dots 와 겹치지 않게 좌측 하단 */}
      {currentPhoto && (
        <div className="absolute bottom-[12px] left-[12px] flex items-center gap-[6px]">
          <PhotoReportButton photoId={currentPhoto.id} />
          <AdminPhotoHideButton photoId={currentPhoto.id} />
          <PhotoCredit source={currentPhoto.source} />
        </div>
      )}
    </div>
  );
}
