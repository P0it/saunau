/**
 * 사우나우 워드마크 — 한글 유지, 좁은 자간의 곧은 세팅.
 * (기울임(skew+rotate)을 쓰던 시기가 있었으나, 플레이트 로고 마크와 나란히 서면
 *  글자만 기울어 보여서 걷어냈다. 마크가 방향을 갖는 형태라 글자는 곧게 둔다.)
 * 크기/색은 className으로 주입(text-[..px], text-brand 등).
 */
export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span
      className={
        "inline-block whitespace-nowrap font-black tracking-[-0.055em] " +
        className
      }
    >
      사우나우
    </span>
  );
}
