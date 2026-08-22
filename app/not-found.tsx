import Link from "next/link";
import { SteamMark } from "@/components/illustrations";

/**
 * 404 — 없는 매장 slug·오래된 링크. 상세 페이지의 notFound() 도 여기로 떨어진다.
 * 막다른 길로 두지 않고 목록/홈으로 되돌려 보낸다.
 */
export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-[20px] py-[40px] text-center">
      <div className="flex h-[84px] w-[84px] items-center justify-center rounded-full bg-[#F4F2EF]">
        <SteamMark size={42} />
      </div>
      <p className="mt-[18px] text-[15px] font-semibold text-ink">
        찾는 페이지가 없어요
      </p>
      <p className="mt-[6px] text-[13px] text-muted">
        주소가 바뀌었거나 문 닫은 매장일 수 있어요
      </p>
      <div className="mt-[20px] flex items-center gap-[10px]">
        <Link
          href="/list"
          className="rounded-full bg-brand px-[20px] py-[11px] text-[14px] font-semibold text-white"
        >
          사우나 둘러보기
        </Link>
        <Link
          href="/"
          className="rounded-full border border-line bg-card px-[20px] py-[11px] text-[14px] font-semibold text-ink"
        >
          홈으로
        </Link>
      </div>
    </div>
  );
}
