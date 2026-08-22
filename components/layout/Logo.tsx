import { LogoMark } from "@/components/illustrations";
import { Wordmark } from "./Wordmark";

/**
 * 로고 락업 — 플레이트 마크 + 워드마크.
 * 워드마크는 네 글자 모두 브랜드 레드(text-brand)로 간다. 마크의 정면 중간 스톱과
 * 같은 톤이라 마크·글자가 한 물건으로 읽힌다.
 *
 * 마크만 필요하면 LogoMark 를 직접 쓴다(앱 아이콘·파비콘·OG는 각자 렌더).
 */
export function Logo({
  size = 30,
  className = "",
}: {
  /** 마크 한 변(px). 워드마크는 이 값에 비례해 커진다. */
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={"inline-flex items-center gap-[9px] " + className}
      // 워드마크 글자 크기는 마크에 비례(상속) — 락업 비율이 크기와 무관하게 유지된다
      style={{ fontSize: Math.round(size * 0.94) }}
    >
      <LogoMark size={size} />
      <Wordmark className="text-brand" />
    </span>
  );
}
