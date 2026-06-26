/**
 * 런타임 콘텐츠 정책(킬스위치) — 서버·클라이언트 공용(isomorphic).
 *
 * 사진·블로그후기 표시 여부를 `system_flags` 테이블(공개 읽기)에서 읽어
 * 재배포 없이 즉시 토글한다. queries.ts 가 모든 조회에서 이 정책을 적용하므로,
 * 서버 컴포넌트든 클라이언트 컴포넌트든 동일하게 킬스위치가 걸린다.
 *
 *  - 1순위: system_flags(images_enabled / blog_reviews_enabled)
 *  - 폴백:  env NEXT_PUBLIC_IMAGES_ENABLED / NEXT_PUBLIC_BLOG_REVIEWS_ENABLED (DB 장애 시)
 *  - 기본:  모두 on
 *
 * ⚠ queries.ts 가 클라이언트 컴포넌트에서도 import 되므로 이 모듈은 server-only 가 될 수 없다.
 *    그래서 next/cache(unstable_cache) 대신 모듈 레벨 TTL 캐시를 쓴다.
 */
import { supabasePublic } from "@/lib/supabase/public";
import type { ContentPolicy, PhotoSource } from "@/lib/data/types";

const ALL_SOURCES: PhotoSource[] = [
  "naver_crawl",
  "owner",
  "editor",
  "google",
  "licensed",
];

const TTL_MS = 30_000; // 플래그 변경은 최대 30초 내 반영
let cache: { at: number; policy: ContentPolicy } | null = null;
let inflight: Promise<ContentPolicy> | null = null;

/** env 문자열을 bool 로(미설정 시 fallback). "false"/"0"/"off"/"no" → false. */
function envBool(name: string, fallback: boolean): boolean {
  const v = process.env[name];
  if (v == null || v === "") return fallback;
  return !/^(false|0|off|no)$/i.test(v.trim());
}

/** jsonb 플래그(boolean) 우선, 없으면 env 폴백(기본 on). */
function resolveBool(flagValue: unknown, envName: string): boolean {
  if (typeof flagValue === "boolean") return flagValue;
  return envBool(envName, true);
}

async function load(): Promise<ContentPolicy> {
  let flags: Record<string, unknown> = {};
  try {
    const { data, error } = await supabasePublic
      .from("system_flags")
      .select("key, value");
    if (error) throw error;
    for (const r of data ?? []) flags[r.key as string] = r.value;
  } catch {
    // DB 장애 시 env 폴백(기본 on). 표시 가용성 우선.
    flags = {};
  }
  return {
    images: {
      show: resolveBool(flags["images_enabled"], "NEXT_PUBLIC_IMAGES_ENABLED"),
      allowedSources: ALL_SOURCES,
    },
    blogReviews: {
      show: resolveBool(
        flags["blog_reviews_enabled"],
        "NEXT_PUBLIC_BLOG_REVIEWS_ENABLED",
      ),
    },
  };
}

export async function getContentPolicy(): Promise<ContentPolicy> {
  const now = Date.now();
  if (cache && now - cache.at < TTL_MS) return cache.policy;
  if (inflight) return inflight;
  inflight = load()
    .then((policy) => {
      cache = { at: Date.now(), policy };
      return policy;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

/**
 * 대표 썸네일/사진 URL 을 정책에 따라 해석.
 * 표시 불가면 null(→ plain 폴백). url 은 호출부에서 항상 우리 Storage URL 만 넘긴다.
 */
export function resolvePhotoUrl(
  url: string | null | undefined,
  source: string | null | undefined,
  images: ContentPolicy["images"],
): string | null {
  if (!images.show || !url) return null;
  if (source && !images.allowedSources.includes(source as PhotoSource)) {
    return null;
  }
  return url;
}
