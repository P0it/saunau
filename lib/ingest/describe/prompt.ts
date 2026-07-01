/**
 * 매장 AI 소개 생성용 프롬프트 빌더.
 *
 * 입력 = 공공데이터 사실 + 네이버 블로그 발췌(짧은 snippet). 출력 = 사실 기반 오리지널 소개.
 * 핵심 규칙(저작권/신뢰): 블로그 문장 복사 금지, 1인칭(다녀온 척) 금지, 지어내기 금지.
 */
import type { DescribeInput } from "./types";

const RULES = `너는 사우나 정보 앱 "사우나우"의 매장 소개를 쓰는 에디터다.
아래는 한 매장의 공공데이터 사실과, 네이버 블로그 후기에서 발췌한 짧은 텍스트들이다.

[description 작성 규칙]
- 위치·주소·"무슨 구에 있다"는 쓰지 마라. 그건 앱의 지도·주소로 이미 보여준다. 절대 반복하지 마라.
- 사람들이 궁금한 "실제 모습"만 써라: 시설·탕 종류·온도·세신·노천·수질·규모·분위기·시그니처·이용 팁 등.
- 블로그 문장을 그대로 복사하지 마라. 여러 글에서 공통으로 확인되는 사실만 뽑아 새로 써라.
- 한 곳에서만 나온 불확실한 정보, 마사지샵 등 매장과 무관한 내용은 빼라.
- 1인칭("제가 가봤더니") 금지. 다녀온 사람인 척하지 마라.
- 문체는 "해요체"로 친근하게 써라(예: "~있어요", "~좋아요", "~추천해요"). 딱딱한 개조식·"~임/~함" 종결 금지.
- 과장·미사여구 금지. 2~4문장, 자연스러운 한국어.
- 지어내지 마라. **위치 말고 쓸 만한 실제 내용이 없으면 description 을 빈 문자열("")로 둬라.** 억지로 채우지 마라.

[facts 추출 규칙]
- 블로그에서 확인되는 값만. 없으면 null. 추측 금지.
- parking: 주차 가능 여부와 조건을 짧게(예: "3시간 무료, 이후 20분당 1,000원"). 주차 언급 없으면 null.
- water: 수질 특징(예: "400m 천연암반수"). 없으면 null.

출력은 JSON 한 줄만(코드펜스 없이): {"description": "...", "facts": {"price_won": 정수 또는 null, "hours": "문자열 또는 null", "water": "문자열 또는 null", "parking": "문자열 또는 null"}}`;

function factLines(s: DescribeInput["sauna"]): string {
  const kinds: string[] = [];
  if (s.is_enzyme) kinds.push("효소찜질방");
  else if (s.is_jjimjilbang) kinds.push("찜질방");
  if (s.is_hot_spring) kinds.push("온천");
  if (s.is_24h) kinds.push("24시간");
  if (s.has_outdoor) kinds.push("노천");
  if (s.has_sesin) kinds.push("세신");
  const facts = [
    `이름: ${s.name}`,
    `위치: ${[s.sido, s.sigungu, s.dong].filter(Boolean).join(" ")}`,
    kinds.length ? `특징: ${kinds.join(", ")}` : "",
    s.price ? `공공/기존 입욕료: ${s.price}원` : "",
    s.hours ? `영업시간: ${s.hours}` : "",
    s.sauna_room_temp ? `사우나실 온도: ${s.sauna_room_temp}℃` : "",
    s.cold_bath_temp ? `냉탕 온도: ${s.cold_bath_temp}℃` : "",
  ].filter(Boolean);
  return facts.join(" / ");
}

export function buildPrompt(input: DescribeInput): string {
  const excerpts = input.reviews
    .map((r, i) => {
      const text = [r.title, r.snippet].filter(Boolean).join(" — ");
      return `${i + 1}) ${text}`;
    })
    .join("\n");

  return [
    RULES,
    "",
    "[매장]",
    factLines(input.sauna),
    "",
    "[블로그 발췌]",
    excerpts || "(발췌 없음 — 공공데이터 사실만으로 짧게)",
  ].join("\n");
}
