import type { MetadataRoute } from "next";

/**
 * 크롤러 규칙. 개인화 화면(/my, /favorites)과 API·인증 콜백은 색인 대상이 아니다.
 * 매장 상세·읽을거리는 열어둔다(검색 유입이 이 서비스의 주 진입로).
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/auth/", "/my", "/favorites"],
    },
    sitemap: "https://saunau.vercel.app/sitemap.xml",
  };
}
