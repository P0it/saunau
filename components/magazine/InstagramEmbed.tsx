"use client";

import { useEffect } from "react";

/**
 * 인스타그램 공개 게시물 인앱 임베드(공식 embed.js).
 * - 토큰/그래프API 불필요 — blockquote + //www.instagram.com/embed.js 로 렌더.
 * - 스크립트는 1회만 로드하고, 이후엔 window.instgrm.embeds.process() 로 새 블록만 처리.
 * - 본문 마크다운에서 인스타 URL 감지 시 이 컴포넌트로 치환된다(ArticleBody).
 */
declare global {
  interface Window {
    instgrm?: { embeds: { process: () => void } };
  }
}

const SCRIPT_SRC = "https://www.instagram.com/embed.js";

export function InstagramEmbed({ url }: { url: string }) {
  // 쿼리스트링(?igsh=...) 제거 — 캡션/임베드 안정화
  const permalink = url.split("?")[0];

  useEffect(() => {
    if (window.instgrm) {
      window.instgrm.embeds.process();
      return;
    }
    if (document.querySelector(`script[src="${SCRIPT_SRC}"]`)) return;
    const s = document.createElement("script");
    s.src = SCRIPT_SRC;
    s.async = true;
    s.onload = () => window.instgrm?.embeds.process();
    document.body.appendChild(s);
  }, [permalink]);

  return (
    <blockquote
      className="instagram-media mx-auto my-[18px] w-full"
      data-instgrm-permalink={permalink}
      data-instgrm-version="14"
      style={{ maxWidth: 540, margin: "18px auto", minWidth: 0 }}
    >
      <a href={permalink} target="_blank" rel="noopener noreferrer">
        인스타그램에서 보기
      </a>
    </blockquote>
  );
}

/** instagram.com/p/ 또는 /reel/ permalink 인지 판별. */
export function isInstagramUrl(href: string): boolean {
  return /(^https?:)?\/\/(www\.)?instagram\.com\/(p|reel|tv)\//.test(href);
}
