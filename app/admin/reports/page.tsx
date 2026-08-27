import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAdminUser } from "@/lib/admin";
import { ReportInbox } from "@/components/admin/ReportInbox";

export const dynamic = "force-dynamic"; // 세션·신고 현황 — 캐시 금지

export const metadata: Metadata = {
  title: "신고함",
  robots: { index: false, follow: false },
};

/**
 * 운영자 신고함 — 접수된 사진 신고를 확인하고 숨김/복원한다.
 *
 * 신고 기능만 있고 볼 화면이 없으면 신고는 쌓이기만 한다(= 삭제 요청에 응답 못 함).
 * 권한은 서버에서 ADMIN_EMAILS 로 강제하고, 관리자가 아니면 404 로 존재 자체를 숨긴다.
 */
export default async function AdminReportsPage() {
  const user = await getAdminUser();
  if (!user) notFound();

  return (
    <div className="flex flex-col gap-[16px] px-[20px] pb-[32px] pt-[24px]">
      <div>
        <h1 className="text-[22px] font-bold tracking-[-0.02em] text-ink">
          신고함
        </h1>
        <p className="mt-[6px] text-[13px] leading-[1.6] text-muted">
          신고된 사진을 확인하고 숨기거나 되돌립니다. 서로 다른 이용자 3명이 신고하면
          자동으로 숨겨집니다.
        </p>
      </div>
      <ReportInbox />
    </div>
  );
}
