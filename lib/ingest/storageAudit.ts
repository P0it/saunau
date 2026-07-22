/**
 * Storage 감사 공용 로직 — 감사(audit-storage)와 정리(cleanup-storage)가 공유한다.
 *
 * 고아 판정은 **양쪽이 반드시 같은 규칙**이어야 한다. 규칙이 갈리면 정리 스크립트가
 * 살아있는 이미지를 지운다. 그래서 복붙하지 않고 여기 한 곳에 둔다.
 *
 * storage 스키마는 PostgREST 에 노출돼 있지 않아(406) SQL 로 셀 수 없다.
 * → Storage API 재귀 listing 으로 객체를 모은다.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export const BUCKET = "sauna-photos";
const PAGE = 1000; // Storage list / PostgREST range 페이지 크기
const CONCURRENCY = 12; // 폴더 listing 동시 실행 수

export interface ObjInfo {
  path: string;
  size: number;
}

/**
 * 일시적 실패(네트워크·레이트리밋) 재시도. 버킷 전체 순회는 수천 콜이라
 * 한 번의 일시 오류로 전체가 중단되면 안 된다. 지수 백오프로 3회까지.
 */
async function withRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
    }
  }
  throw new Error(`${label} 3회 재시도 실패: ${String(lastErr)}`);
}

/** 한 폴더(prefix)의 항목을 페이지네이션으로 모두 가져온다. */
async function listAll(supabase: SupabaseClient, prefix: string) {
  const out: { name: string; id: string | null; size: number }[] = [];
  for (let offset = 0; ; offset += PAGE) {
    // list 는 예외 대신 { error } 를 돌려주므로, 재시도 대상이 되도록 안에서 throw 한다.
    const data = await withRetry(async () => {
      const res = await supabase.storage
        .from(BUCKET)
        .list(prefix, { limit: PAGE, offset });
      if (res.error) throw new Error(res.error.message);
      return res.data;
    }, `list(${prefix})`);
    if (!data?.length) break;
    for (const e of data) {
      out.push({
        name: e.name,
        id: e.id ?? null, // id=null 이면 폴더(가상 prefix)
        size: (e.metadata as { size?: number } | null)?.size ?? 0,
      });
    }
    if (data.length < PAGE) break;
  }
  return out;
}

/** 버킷 전체를 재귀 순회해 객체 목록을 만든다. 폴더는 큐로 넓이우선 처리. */
export async function walkBucket(
  supabase: SupabaseClient,
  onProgress?: (scanned: number, pending: number, found: number) => void,
): Promise<ObjInfo[]> {
  const objects: ObjInfo[] = [];
  let queue: string[] = [""];
  let scanned = 0;

  while (queue.length) {
    const batch = queue.splice(0, CONCURRENCY);
    const results = await Promise.all(
      batch.map(async (prefix) => ({
        prefix,
        entries: await listAll(supabase, prefix),
      })),
    );
    const next: string[] = [];
    for (const { prefix, entries } of results) {
      for (const e of entries) {
        const full = prefix ? `${prefix}/${e.name}` : e.name;
        if (e.id === null) next.push(full);
        else objects.push({ path: full, size: e.size });
      }
    }
    queue = queue.concat(next);
    scanned += batch.length;
    onProgress?.(scanned, queue.length, objects.length);
  }
  return objects;
}

/** PostgREST range 페이지네이션으로 테이블 컬럼 전량 조회. */
export async function selectAll<T>(
  supabase: SupabaseClient,
  table: string,
  columns: string,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`${table} 조회 실패: ${error.message}`);
    if (!data?.length) break;
    rows.push(...(data as T[]));
    if (data.length < PAGE) break;
  }
  return rows;
}

/** 공개 URL 에서 버킷 내 경로만 뽑는다. 우리 버킷이 아니면 null. */
export function pathFromPublicUrl(url: string | null): string | null {
  if (!url) return null;
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const i = url.indexOf(marker);
  return i === -1 ? null : decodeURIComponent(url.slice(i + marker.length));
}

export interface Refs {
  /** 화면에 실제로 쓰이는 객체 경로 */
  active: Set<string>;
  /** 활성 + 비활성(숨김/신고) 행이 가리키는 경로 — 이 밖이면 고아 */
  all: Set<string>;
  blogThumbCount: number;
}

/**
 * DB 가 가리키는 Storage 경로 전량 수집.
 *
 * 참조는 **두 곳**에서 나온다. 하나라도 빠뜨리면 살아있는 객체가 고아로 잡힌다:
 *   - sauna_photos.storage_path      갤러리/사용자 사진
 *   - sauna_blog_reviews.thumb_url   블로그 후기 썸네일({saunaId}/blog-N.webp)
 */
export async function collectRefs(supabase: SupabaseClient): Promise<Refs> {
  const photos = await selectAll<{
    storage_path: string | null;
    is_active: boolean;
  }>(supabase, "sauna_photos", "storage_path, is_active");
  const blogs = await selectAll<{ thumb_url: string | null }>(
    supabase,
    "sauna_blog_reviews",
    "thumb_url",
  );

  const active = new Set<string>();
  const all = new Set<string>();
  for (const p of photos) {
    if (!p.storage_path) continue;
    all.add(p.storage_path);
    if (p.is_active) active.add(p.storage_path);
  }
  let blogThumbCount = 0;
  for (const b of blogs) {
    const path = pathFromPublicUrl(b.thumb_url);
    if (!path) continue;
    blogThumbCount++;
    all.add(path);
    active.add(path); // 블로그 썸네일엔 is_active 개념이 없다
  }
  return { active, all, blogThumbCount };
}

/** 객체 경로가 블로그 후기 썸네일인가(= 64px 로만 렌더되는 것). */
export function isBlogThumb(path: string): boolean {
  if (path.startsWith("user/")) return false;
  return path.slice(path.lastIndexOf("/") + 1).startsWith("blog-");
}

/** 객체 경로 → 분류 키. */
export function classify(path: string): string {
  if (path.startsWith("user/")) return "user (사용자 업로드)";
  const file = path.slice(path.lastIndexOf("/") + 1);
  if (file.startsWith("blog-")) return "blog-* (블로그 썸네일)";
  if (file.startsWith("g-")) return "g-* (구글)";
  if (file.startsWith("w-")) return "w-* (업체 웹사이트)";
  return "N.webp (네이버 크롤)";
}

export const mb = (bytes: number) => (bytes / 1024 / 1024).toFixed(1);
