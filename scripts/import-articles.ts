/**
 * 읽을거리(피드) 마크다운 → DB 적재.  content/magazine/*.md 를 읽어
 * articles 테이블에 slug 기준 upsert 한다. 운영자 마크다운 생성 도구의 출력물을
 * 그대로 폴더에 떨궈 두고 이 스크립트를 돌리면 발행된다.
 *
 *   pnpm import:articles            # content/magazine/*.md 전부 upsert
 *   pnpm import:articles -- --dry   # 파싱만(콘솔 출력, DB 미적재)
 *
 * 각 .md 파일은 frontmatter + 본문(마크다운) 형식:
 *
 *   ---
 *   title: 일본 사우나 문화 입문
 *   summary: 한 줄 요약(목록/홈 노출)
 *   slug: japan-sauna-culture           # 없으면 파일명 사용
 *   thumbnail_url: https://<project>.supabase.co/storage/v1/object/public/...
 *   published_at: 2026-06-30            # 없으면 오늘
 *   is_published: true                  # 기본 true
 *   ---
 *   본문 마크다운... (인스타 게시물은 URL 한 줄로 적으면 임베드됨)
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { config } from "dotenv";
import matter from "gray-matter";
import { getAdminClient } from "../lib/supabase/admin";

config({ path: ".env.local" });
config();

const flag = (name: string) => process.argv.includes(`--${name}`);

const DIR = join(process.cwd(), "content", "magazine");

async function main() {
  const dry = flag("dry");
  const supabase = getAdminClient();

  let files: string[];
  try {
    // `_` 로 시작하는 파일은 아티클이 아닌 문서(작성 가이드 등)라 건너뛴다.
    files = readdirSync(DIR).filter(
      (f) => f.endsWith(".md") && !f.startsWith("_"),
    );
  } catch {
    console.error(`디렉터리가 없습니다: ${DIR}`);
    process.exit(1);
  }
  if (files.length === 0) {
    console.log(`적재할 .md 파일이 없습니다: ${DIR}`);
    return;
  }

  const rows = files.map((file) => {
    const raw = readFileSync(join(DIR, file), "utf8");
    const { data: fm, content } = matter(raw);
    const slug = String(fm.slug ?? file.replace(/\.md$/, "")).trim();
    if (!fm.title) throw new Error(`${file}: frontmatter 에 title 이 필요합니다.`);
    return {
      title: String(fm.title).trim(),
      summary: fm.summary ? String(fm.summary).trim() : null,
      body: content.trim(),
      thumbnail_url: fm.thumbnail_url ? String(fm.thumbnail_url).trim() : null,
      category: fm.category ? String(fm.category).trim() : null, // 단일 피드: 보통 비움
      slug,
      published_at: fm.published_at
        ? new Date(String(fm.published_at)).toISOString()
        : new Date().toISOString(),
      is_published: fm.is_published === undefined ? true : Boolean(fm.is_published),
    };
  });

  if (dry) {
    for (const r of rows) {
      console.log(`• ${r.slug}  [${r.is_published ? "발행" : "비공개"}]  ${r.title}`);
    }
    console.log(`\n(dry) ${rows.length}건 — DB 미적재.`);
    return;
  }

  const { error } = await supabase
    .from("articles")
    .upsert(rows, { onConflict: "slug" });
  if (error) throw error;
  console.log(`${rows.length}건 upsert 완료.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
