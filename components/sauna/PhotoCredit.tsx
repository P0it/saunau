import type { PhotoSource } from "@/lib/data/types";

/**
 * 사진 출처 표기(저작권 고지) — 갤러리에서 현재 보고 있는 사진 위에 얹는다.
 *
 * 운영자가 직접 올린 사진('editor'/'owner'/'licensed')은 우리 권리이므로 표기하지 않는다.
 * 수집 사진(네이버 플레이스 업체 제공·Google)은 원 권리자가 따로 있으므로 반드시 표기한다.
 * 권리자 삭제 요청 창구는 이용약관 제6조의2에 적어두었다.
 */
const CREDIT: Partial<Record<PhotoSource, string>> = {
  naver_crawl: "네이버 플레이스",
  google: "Google",
  website: "업체 홈페이지",
};

export function PhotoCredit({ source }: { source: PhotoSource }) {
  const label = CREDIT[source];
  if (!label) return null;
  return (
    <span className="pointer-events-none rounded-full bg-black/45 px-[8px] py-[4px] text-[10px] font-medium leading-none text-white/90 backdrop-blur">
      사진 {label}
    </span>
  );
}
