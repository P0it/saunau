/**
 * 약관·개인정보처리방침 본문 로더 (서버 전용).
 * 본문은 DB가 아니라 레포의 마크다운(content/legal/*.md)이다 —
 * 개정 이력이 곧 git 이력이어야 법적 증빙으로 쓸 수 있기 때문.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";

export { TERMS_VERSION } from "./legal-version";

export type LegalDoc = "terms" | "privacy";

export async function readLegalDoc(doc: LegalDoc): Promise<string> {
  const file = path.join(process.cwd(), "content", "legal", `${doc}.md`);
  return readFile(file, "utf8");
}
