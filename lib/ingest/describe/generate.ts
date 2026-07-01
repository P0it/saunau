/**
 * Claude Code CLI(`claude -p`)를 헤드리스로 호출해 소개를 생성한다.
 *
 * ⚠ API 키가 아니라 **로그인된 클로드 플랜**으로 돈다(별도 LLM 과금 없음).
 *   환경에 `claude` CLI 가 PATH 에 있어야 한다(2.x).
 *
 * 흐름: 프롬프트를 stdin 으로 넘기고 `--output-format json` 결과의 .result 를 받는다.
 *       .result 는 코드펜스가 섞일 수 있어 방어적으로 JSON 을 추출한다.
 */
import { spawn } from "node:child_process";
import type { DescribeResult } from "./types";

const MODEL = process.env.DESCRIBE_MODEL ?? "claude-sonnet-4-6";

/** 프롬프트 1건 → claude CLI 실행 → 원문 result 텍스트. */
function runClaude(prompt: string, timeoutMs = 90_000): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "claude",
      ["-p", "--model", MODEL, "--output-format", "json"],
      { shell: true }, // Windows: claude.cmd 해석
    );
    let out = "";
    let err = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error("claude CLI 타임아웃"));
    }, timeoutMs);

    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) return reject(new Error(`claude exit ${code}: ${err.slice(0, 300)}`));
      try {
        const env = JSON.parse(out);
        if (env.is_error) return reject(new Error(`claude error: ${env.result ?? "unknown"}`));
        resolve(String(env.result ?? ""));
      } catch {
        reject(new Error(`claude 출력 파싱 실패: ${out.slice(0, 300)}`));
      }
    });

    child.stdin.write(prompt);
    child.stdin.end();
  });
}

/**
 * result 텍스트(코드펜스 가능)에서 {description, facts} JSON 추출.
 * 빈 description 은 **정상 결과**(내용 없음)다 — null 로 깎지 않는다.
 * null 은 오직 JSON 자체를 못 읽을 때만(진짜 파싱 실패).
 */
function parseResult(text: string): DescribeResult | null {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const obj = JSON.parse(m[0]) as DescribeResult;
    return { description: (obj.description ?? "").trim(), facts: obj.facts };
  } catch {
    return null;
  }
}

export async function generateDescription(
  prompt: string,
): Promise<DescribeResult | null> {
  const text = await runClaude(prompt);
  return parseResult(text);
}
