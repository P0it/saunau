/**
 * 서비스 기본 정보 — 절대 URL이 필요한 곳(메타데이터·사이트맵·robots·OG)의 단일 출처.
 *
 * 도메인이 robots/sitemap/layout 세 곳에 리터럴로 박혀 있어서 커스텀 도메인을 붙이는 순간
 * 흩어진 곳을 모두 찾아야 했다. 여기 한 곳만 보면 되게 모은다.
 *
 * 우선순위: NEXT_PUBLIC_SITE_URL → Vercel 이 주입하는 프로덕션 도메인 → 기본값.
 * (프리뷰 배포에서도 절대 URL 이 자기 자신을 가리키도록 VERCEL_PROJECT_PRODUCTION_URL 을 쓴다.)
 */
function resolveSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercel) return `https://${vercel}`;
  return "https://saunau.vercel.app";
}

export const SITE_URL = resolveSiteUrl();
export const SITE_NAME = "사우나우";
export const SITE_DESCRIPTION = "내 주변 목욕탕·찜질방·온천 찾기";

/** 문의·삭제요청 창구. 약관·개인정보처리방침에 적힌 주소와 같아야 한다. */
export const CONTACT_EMAIL = "taesion9060@gmail.com";
