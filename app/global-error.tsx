"use client";

/**
 * 루트 레이아웃 자체가 깨졌을 때의 최후 경계 — layout.tsx 를 대체하므로
 * html/body 를 직접 그린다(전역 CSS·폰트도 못 쓰는 상황이라 인라인 스타일).
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ko">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          fontFamily: "system-ui, -apple-system, sans-serif",
          color: "#22201E",
          background: "#FFFFFF",
          textAlign: "center",
          padding: 20,
        }}
      >
        <strong style={{ fontSize: 15 }}>잠시 문제가 생겼어요</strong>
        <span style={{ fontSize: 13, color: "#8B8680" }}>
          잠깐 뒤에 다시 시도해 주세요
        </span>
        <button
          type="button"
          onClick={reset}
          style={{
            marginTop: 10,
            border: 0,
            borderRadius: 999,
            background: "#F5402C",
            color: "#fff",
            fontSize: 14,
            fontWeight: 600,
            padding: "11px 20px",
            cursor: "pointer",
          }}
        >
          다시 시도
        </button>
        {error.digest && (
          <span style={{ fontSize: 11, color: "#8B8680" }}>
            오류 코드 {error.digest}
          </span>
        )}
      </body>
    </html>
  );
}
