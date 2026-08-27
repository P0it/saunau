import Link from "next/link";
import { CONTACT_EMAIL, SITE_NAME } from "@/lib/site";

/**
 * 화면 하단 정보 블록 — 데이터 출처 표기·문의 창구·약관 링크.
 *
 * 세 가지를 한 번에 해결한다.
 *  1) 공공데이터포털 데이터 이용약관이 요구하는 **출처 표시**
 *  2) 앱 안에 없던 **문의·삭제요청 창구**(약관 본문에만 이메일이 있었다)
 *  3) 비회원도 닿는 약관 열람 경로(그동안 로그인 후 계정 시트에만 있었다)
 *
 * 로그인 여부와 무관해야 하므로 서버 컴포넌트로 두고 홈·마이에 붙인다.
 */
export function AppFooter() {
  return (
    <footer className="border-t border-line px-[20px] pb-[28px] pt-[20px] text-[12px] leading-[1.7] text-muted">
      <p>
        매장 정보는 공공데이터포털의 <strong className="font-semibold">목욕장업 인허가</strong>
        {" · "}
        <strong className="font-semibold">전국 온천 표준데이터</strong>와 공개된 장소정보를
        바탕으로 정리했습니다. 실제와 다를 수 있으니 방문 전 매장에 확인해주세요.
      </p>
      <p className="mt-[8px]">
        사진·게시물에 대한 삭제 요청과 서비스 문의는{" "}
        <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold text-ink underline">
          {CONTACT_EMAIL}
        </a>
        로 보내주세요.
      </p>
      <div className="mt-[12px] flex items-center gap-[10px]">
        <Link href="/terms" className="font-semibold text-ink">
          이용약관
        </Link>
        <span className="text-line">|</span>
        <Link href="/privacy" className="font-semibold text-ink">
          개인정보처리방침
        </Link>
      </div>
      <p className="mt-[10px] text-[11px] text-dot">© {SITE_NAME}</p>
    </footer>
  );
}
