import { SaunaImage } from "./SaunaImage";
import type { SaunaPhoto } from "@/lib/data/types";

/**
 * 상세 히어로 갤러리. 사진이 여러 장이면 가로 스냅 스크롤, 한 장/없음이면 단일.
 * 부모는 relative + 고정 높이(260px) — SaunaImage 가 fill 로 채운다.
 * 사진 0건이거나 정책 OFF면 SaunaImage 가 Waves 폴백을 렌더.
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

  if (urls.length <= 1) {
    return <SaunaImage src={urls[0] ?? null} alt={alt} sizes="430px" />;
  }

  return (
    <div className="flex h-full w-full snap-x snap-mandatory overflow-x-auto">
      {urls.map((u, i) => (
        <div key={i} className="relative h-full w-full shrink-0 snap-center">
          <SaunaImage src={u} alt={`${alt} ${i + 1}`} sizes="430px" />
        </div>
      ))}
    </div>
  );
}
