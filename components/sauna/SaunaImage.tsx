import Image from "next/image";
import { Waves } from "lucide-react";

/**
 * 사우나 사진을 렌더하는 **유일한** 컴포넌트(단일 choke point).
 *
 * - 표시 여부(킬스위치)·출처 필터는 이미 서버 쿼리 계층에서 적용되어,
 *   여기로는 표시 가능한 우리 Storage `src`(또는 null)만 들어온다.
 * - `src` 가 없으면(미수집·정책 OFF) 연한 톤 + Waves 폴백 = plain card.
 * - `fill` 컨테이너 전제(부모가 relative + 고정 높이). next/image 로 우리 Storage 이미지 최적화.
 *
 * ⚠ 외부(pstatic/네이버) URL 은 구조적으로 들어올 수 없다 — 쿼리 계층이 우리 Storage URL 만 내려준다.
 */
export function SaunaImage({
  src,
  alt,
  sizes = "430px",
  className = "object-cover",
  grayscale = false,
  iconSize = 34,
}: {
  src: string | null;
  alt: string;
  sizes?: string;
  className?: string;
  grayscale?: boolean;
  iconSize?: number;
}) {
  if (!src) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-[#EEF0F2]">
        <Waves size={iconSize} className="text-[#C3C7CD]" />
      </div>
    );
  }
  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      className={`${className} ${grayscale ? "grayscale" : ""}`}
    />
  );
}
