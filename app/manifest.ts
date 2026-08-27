import type { MetadataRoute } from "next";
import { SITE_NAME, SITE_DESCRIPTION } from "@/lib/site";

/**
 * 웹 앱 매니페스트 — "홈 화면에 추가" 시 이름·색·아이콘을 잡아준다.
 * 아이콘은 파일 컨벤션이 만들어주는 /icon(64) · /apple-icon(180) 을 그대로 쓴다.
 * theme_color 는 프레임 배경(app/globals.css --color-frame)과 같은 값 — 상단 바가 튀지 않게.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${SITE_NAME} - 전국 사우나 지도`,
    short_name: SITE_NAME,
    description: SITE_DESCRIPTION,
    lang: "ko",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#F3F3F4",
    theme_color: "#F3F3F4",
    icons: [
      { src: "/icon", sizes: "64x64", type: "image/png" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
