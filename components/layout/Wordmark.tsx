/**
 * 사우나우 워드마크 — 한글 유지, 일본 센토 간판 느낌의 기울임.
 * skewX(이탤릭) + 우상향 회전(우측 끝이 살짝 올라감) + 좁은 자간.
 * 크기/색은 className으로 주입(text-[..px], text-brand/text-white 등).
 */
export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span
      className={
        "inline-block whitespace-nowrap font-black tracking-[-0.055em] " +
        className
      }
      // skewX(-9deg): 앞으로 기운 이탤릭, rotate(-3.5deg): 우상향(우측이 올라감)
      style={{ transform: "skewX(-9deg) rotate(-3.5deg)" }}
    >
      사우나우
    </span>
  );
}
