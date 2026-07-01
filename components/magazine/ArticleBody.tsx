"use client";

import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { InstagramEmbed, isInstagramUrl } from "./InstagramEmbed";

/**
 * 아티클 본문 마크다운 렌더러.
 * - 이 앱은 `prose` 미사용 → 디자인 토큰(text-ink/muted, 픽셀 클래스)에 맞춘 명시적 매핑.
 * - 본문에 인스타 게시물 URL을 한 줄로 적으면(remark-gfm 자동 링크) 실제 임베드로 치환.
 *
 * 저자용 확장 문법(글이 심심하지 않도록):
 * - 한 줄 개행 → 그대로 줄바꿈(remarkSoftBreaks)
 * - `==강조==`  → 형광펜 마커(rehypeMark)
 * - `> [!tip] 제목` 블록인용 → 콜아웃 박스(remarkCallouts)
 *   타입: tip · note · warn · hot · cold  (작성 가이드는 content/magazine/_AUTHORING.md)
 */

/** 콜아웃 타입별 색/라벨 — app/globals.css 팔레트와 일치(테두리 없이 은은한 톤). */
const CALLOUTS: Record<string, { label: string; accent: string; tint: string }> =
  {
    tip: { label: "팁", accent: "#2E8B57", tint: "#EDF7F1" },
    note: { label: "참고", accent: "#1C6FFF", tint: "#EDF3FF" },
    warn: { label: "주의", accent: "#F5402C", tint: "#FDEEEB" },
    hot: { label: "뜨거움", accent: "#F5402C", tint: "#FDEEEB" },
    cold: { label: "냉탕", accent: "#1C6FFF", tint: "#EDF3FF" },
  };

/**
 * 콜아웃: `> [!tip] 제목` 으로 시작하는 블록인용을 표식/제목/본문으로 분해해
 * hProperties(data-callout)로 넘긴다. remarkSoftBreaks 보다 먼저 돌려 첫 줄이
 * 온전한 텍스트일 때 마커를 떼어낸다.
 */
function remarkCallouts() {
  return (tree: { children?: Array<Record<string, unknown>> }) => {
    for (const node of tree.children ?? []) {
      if (node.type !== "blockquote") continue;
      const first = (node.children as Array<Record<string, unknown>>)?.[0];
      if (!first || first.type !== "paragraph") continue;
      const text = (first.children as Array<Record<string, unknown>>)?.[0];
      if (!text || text.type !== "text") continue;
      const m = /^\[!(\w+)\][^\S\n]*([^\n]*)\n?/.exec(text.value as string);
      if (!m || !CALLOUTS[m[1].toLowerCase()]) continue;
      text.value = (text.value as string).replace(
        /^\[!\w+\][^\n]*\n?/,
        "",
      );
      node.data = {
        hProperties: {
          "data-callout": m[1].toLowerCase(),
          "data-callout-title": m[2].trim(),
        },
      };
    }
  };
}

/** 한 줄 개행(soft break)을 실제 줄바꿈으로 — 저자가 준 줄바꿈을 그대로 살린다. */
function remarkSoftBreaks() {
  const walk = (node: Record<string, unknown>) => {
    const children = node.children as Array<Record<string, unknown>> | undefined;
    if (!children) return;
    const out: Array<Record<string, unknown>> = [];
    for (const child of children) {
      if (child.type === "text" && (child.value as string).includes("\n")) {
        (child.value as string).split("\n").forEach((part, i) => {
          if (i > 0) out.push({ type: "break" });
          if (part) out.push({ type: "text", value: part });
        });
      } else {
        walk(child);
        out.push(child);
      }
    }
    node.children = out;
  };
  return (tree: Record<string, unknown>) => walk(tree);
}

/** `==강조==` 텍스트를 <mark> 요소로 치환(hast 레벨). */
function rehypeMark() {
  const RE = /==([^=\n]+)==/g;
  const walk = (node: Record<string, unknown>) => {
    const children = node.children as Array<Record<string, unknown>> | undefined;
    if (!children) return;
    const out: Array<Record<string, unknown>> = [];
    for (const child of children) {
      if (child.type === "text" && RE.test(child.value as string)) {
        RE.lastIndex = 0;
        const value = child.value as string;
        let last = 0;
        let m: RegExpExecArray | null;
        while ((m = RE.exec(value))) {
          if (m.index > last)
            out.push({ type: "text", value: value.slice(last, m.index) });
          out.push({
            type: "element",
            tagName: "mark",
            properties: {},
            children: [{ type: "text", value: m[1] }],
          });
          last = m.index + m[0].length;
        }
        if (last < value.length)
          out.push({ type: "text", value: value.slice(last) });
      } else {
        walk(child);
        out.push(child);
      }
    }
    node.children = out;
  };
  return (tree: Record<string, unknown>) => walk(tree);
}

export function ArticleBody({ body }: { body: string }) {
  return (
    <div className="text-[15px] leading-[1.75] text-ink">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkCallouts, remarkSoftBreaks]}
        rehypePlugins={[rehypeMark]}
        components={{
          // 인스타 URL만 단독으로 있는 문단 → 임베드(블록 레벨)로 치환
          p({ node, children }) {
            const only =
              node?.children?.length === 1 ? node.children[0] : null;
            if (
              only &&
              only.type === "element" &&
              only.tagName === "a" &&
              typeof only.properties?.href === "string" &&
              isInstagramUrl(only.properties.href)
            ) {
              return <InstagramEmbed url={only.properties.href} />;
            }
            return <p className="my-[14px] text-pretty">{children}</p>;
          },
          h1: ({ children }) => (
            <h1 className="mb-[12px] mt-[30px] text-[22px] font-extrabold tracking-[-0.02em] text-ink">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="mb-[10px] mt-[30px] flex items-center gap-[8px] text-[19px] font-bold tracking-[-0.02em] text-ink">
              <span className="h-[16px] w-[3px] flex-none rounded-full bg-brand" />
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="mb-[8px] mt-[22px] text-[16px] font-bold text-ink">
              {children}
            </h3>
          ),
          ul: ({ children }) => (
            <ul className="my-[14px] list-disc space-y-[7px] pl-[20px] marker:text-brand">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="my-[14px] list-decimal space-y-[7px] pl-[20px] font-medium marker:font-bold marker:text-brand">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="pl-[2px] font-normal text-pretty">{children}</li>
          ),
          blockquote: ({ node, children }) => {
            // remark-rehype 가 hProperties 를 대시/카멜 어느 쪽으로 넘겨도 잡히게.
            const props = (node?.properties ?? {}) as Record<string, unknown>;
            const rawType = props.dataCallout ?? props["data-callout"];
            const type = typeof rawType === "string" ? rawType : "";
            const callout = CALLOUTS[type];
            if (callout) {
              const rawTitle =
                props.dataCalloutTitle ?? props["data-callout-title"];
              const title = typeof rawTitle === "string" ? rawTitle : "";
              return (
                <div
                  className="my-[18px] rounded-[14px] px-[16px] py-[13px]"
                  style={{ background: callout.tint }}
                >
                  <div
                    className="mb-[4px] text-[12px] font-bold tracking-[0.01em]"
                    style={{ color: callout.accent }}
                  >
                    {title || callout.label}
                  </div>
                  <div className="text-[14px] leading-[1.65] text-ink [&_p]:my-[6px]">
                    {children}
                  </div>
                </div>
              );
            }
            return (
              <blockquote className="my-[16px] border-l-[3px] border-line pl-[14px] text-muted">
                {children}
              </blockquote>
            );
          },
          a: ({ href, children }) => {
            const url = typeof href === "string" ? href : "";
            if (isInstagramUrl(url)) return <InstagramEmbed url={url} />;
            return (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-brand underline underline-offset-2"
              >
                {children}
              </a>
            );
          },
          img: ({ src, alt }) => (
            <figure className="my-[18px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={typeof src === "string" ? src : ""}
                alt={alt ?? ""}
                loading="lazy"
                className="w-full rounded-[16px]"
              />
              {alt ? (
                <figcaption className="mt-[7px] text-center text-[12px] text-muted">
                  {alt}
                </figcaption>
              ) : null}
            </figure>
          ),
          hr: () => (
            <hr className="mx-auto my-[26px] w-[40px] border-t-[2px] border-line" />
          ),
          strong: ({ children }) => (
            <strong className="font-bold text-ink">{children}</strong>
          ),
          mark: ({ children }: { children?: ReactNode }) => (
            <mark
              className="rounded-[3px] px-[3px] font-medium text-ink [box-decoration-break:clone]"
              style={{ background: "rgba(245,64,44,0.16)" }}
            >
              {children}
            </mark>
          ),
          code: ({ children }) => (
            <code className="rounded-[6px] bg-[#F1F1F3] px-[5px] py-[2px] text-[13px]">
              {children}
            </code>
          ),
        }}
      >
        {body}
      </ReactMarkdown>
    </div>
  );
}
