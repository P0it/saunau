/**
 * 이미지 모더레이션 — 서버 전용(API 라우트에서만 import). 게시 *이전*에 1회 호출한다.
 * ⚠ GOOGLE_VISION_API_KEY(비공개) 사용 — 절대 클라이언트 번들에 들어가면 안 된다.
 * 제공자(Google Vision SafeSearch)는 이 모듈 뒤로 추상화 → Rekognition 등 교체 가능.
 *
 * 페일-클로즈드: API 키 미설정/호출 실패 시 거부(ok:false). 미검증 이미지가
 * 공개되지 않도록 게시를 막는다(운영자 비개입 원칙 + 안전 우선).
 */

export interface ModerationResult {
  ok: boolean;
  reason?: string; // 거부 사유(코드). UI/로그용
}

/** SafeSearch likelihood 등급 — LIKELY 이상이면 위험으로 간주. */
const BLOCK_LEVELS = new Set(["LIKELY", "VERY_LIKELY"]);

/**
 * 이미지 바이트를 모더레이션. adult/violence/racy 가 LIKELY 이상이면 거부.
 * @param bytes 원본 이미지 바이트
 */
export async function moderateImage(
  bytes: Uint8Array,
): Promise<ModerationResult> {
  const apiKey = process.env.GOOGLE_VISION_API_KEY;
  if (!apiKey) {
    // 키 미설정 → 페일-클로즈드. 업로드 기능을 켜려면 GOOGLE_VISION_API_KEY 설정 필요.
    console.warn(
      "[moderation] GOOGLE_VISION_API_KEY 미설정 — 사진 업로드를 거부합니다(fail-closed).",
    );
    return { ok: false, reason: "moderation_unavailable" };
  }

  const base64 = Buffer.from(bytes).toString("base64");
  try {
    const res = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          requests: [
            {
              image: { content: base64 },
              features: [{ type: "SAFE_SEARCH_DETECTION" }],
            },
          ],
        }),
      },
    );
    if (!res.ok) {
      console.error("[moderation] Vision API 오류", res.status);
      return { ok: false, reason: "moderation_error" };
    }
    const json = await res.json();
    const ss = json?.responses?.[0]?.safeSearchAnnotation;
    if (!ss) {
      // 주석이 없으면 판단 불가 → 안전하게 거부.
      return { ok: false, reason: "moderation_error" };
    }
    for (const cat of ["adult", "violence", "racy"] as const) {
      if (BLOCK_LEVELS.has(ss[cat])) {
        return { ok: false, reason: `blocked_${cat}` };
      }
    }
    return { ok: true };
  } catch (e) {
    console.error("[moderation] Vision API 호출 실패", e);
    return { ok: false, reason: "moderation_error" };
  }
}
