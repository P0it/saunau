/**
 * 적재 분류 — 업태(라이선스) 강도 + 이름 신호로 3분류.
 *
 * 신뢰도 우선 원칙: "휘트니스가 갑자기 뜨면" 서비스 불신 → 애매한 건 노출 보류.
 * 단 진짜 탕은 안 버린다(공동탕/한증/찜질은 법적 탕). 세신샵은 테마로 따로 관리 → 반드시 보존.
 *
 *  - exclude(not_operating): 영업상태코드 ≠ 01
 *  - exclude(non_bath): "목욕장업 기타"(약한 misc 라이선스) + 피트니스/미용名 + 구제 없음 → 제외
 *  - review: 공동탕/한증/찜질(강한 탕 라이선스) + 피트니스/미용名 → 적재하되 needs_review(노출 보류)
 *  - keep: 그 외 전부
 */
import type { BathApiItem } from "./types";

const OPERATING_CODE = "01";

// 실제 욕탕을 보유한 라이선스 = 공동탕업(공동탕업+찜질 포함)만.
// 찜질시설·한증막은 욕탕이 없어, 다이어트·점핑名이면 진짜 찜질방이 아닌 스튜디오 → 제외 대상.
const PUBLIC_BATH_UPTAE_RE = /공동탕/;

// 헬스장/스포츠/골프/미용·다이어트 부속 이름
const NON_BATH_NAME_RE =
  /피트니스|휘트니스|헬스|스포츠|스포렉스|스포츠센터|짐|gym|골프|클럽|레포츠|점핑|미용|피부|에스테|스킨|왁싱|네일|마사지|테라피|다이어트|슬리밍/i;

// 명백한 목욕시설 이름 → 위 키워드가 있어도 구제. 세신·복지관 포함(세신샵 테마 보존).
const RESCUE_NAME_RE =
  /사우나|대중탕|목욕탕|목욕장|목욕|온천|해수|찜질방|찜질|한증막|한증|불가마|숯가마|맥반석|스파|탕|세신|복지관/i;

export type FilterAction = "keep" | "review" | "exclude";
export type ExcludeReason = "not_operating" | "non_bath_facility";

export interface FilterResult {
  action: FilterAction;
  /** action === "exclude" 일 때만 의미. */
  reason?: ExcludeReason;
}

function looksNonBath(name: string): boolean {
  return NON_BATH_NAME_RE.test(name) && !RESCUE_NAME_RE.test(name);
}

export function classify(item: BathApiItem): FilterResult {
  if ((item.SALS_STTS_CD ?? "").trim() !== OPERATING_CODE) {
    return { action: "exclude", reason: "not_operating" };
  }

  const uptae = item.BZSTAT_SE_NM ?? "";
  const nonBathName = looksNonBath(item.BPLC_NM ?? "");

  if (PUBLIC_BATH_UPTAE_RE.test(uptae)) {
    // 공동탕업(실제 욕탕 보유): 피트니스名이어도 진짜 탕 → 안 버림, 검수 보류.
    return nonBathName ? { action: "review" } : { action: "keep" };
  }

  // 욕탕 없는 라이선스(목욕장업 기타·찜질시설·한증막): 피트니스/다이어트名이면 제외(신뢰도 우선).
  if (nonBathName) return { action: "exclude", reason: "non_bath_facility" };
  return { action: "keep" };
}

export function isRelevant(item: BathApiItem): boolean {
  return classify(item).action !== "exclude";
}
