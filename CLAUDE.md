# 사우나우 — 작업 지침

## 작업 완료 시 (커밋·푸시)

기능이 **동작 확인까지 끝나면 지시를 기다리지 말고** 커밋·푸시까지 진행한다.

1. `npm run lint` — 통과해야 커밋. 실패하면 고치고 다시.
2. `git add` 는 **이번 작업에 관련된 파일만** (`git add -A` 금지 — 크롤 산출물·로컬 설정 섞임).
3. 커밋 — Conventional Commits + 한글 요약: `feat(map): 내 주변 진입 지연 제거`
   `feat` `fix` `perf` `refactor` / scope: `ui` `map` `ingest` `storage` `auth` `share` `admin` …
4. `git push origin main` — 이 저장소는 **main 직접 푸시**(브랜치·PR 안 씀).

**멈추고 물어볼 것:** 실패하는 테스트/린트를 우회해야 할 때, DB 스키마·마이그레이션 변경,
`scripts/` 크롤러가 외부에 실제 요청을 보내는 변경, 시크릿·환경변수 관련 파일.

## 공용 일러스트 (`components/illustrations/`)

서비스에서 반복되는 용어(목욕탕·찜질방·온천·고온 사우나·노천·세신·24시·숙박·커뮤니티…)는
각각 **전용 플랫 일러스트**를 가지며, 모두 `components/illustrations/` **한 곳**에 모은다.
같은 용어는 홈/지도 등 어느 화면에서나 **같은 일러스트**로 읽혀야 한다(의미 통일·재사용).

> **새 화면에 아이콘/그림이 필요하면 먼저 이 폴더부터 본다.**
> 이미 있으면 그대로 import, 없으면 같은 팔레트·모티프로 여기에 **추가**한다.
> Lucide 같은 범용 라인 아이콘은 임시 자리표시로만 쓰고, 자리 잡으면 전용 일러스트로 교체한다.

### 팔레트 (app/globals.css 토큰과 일치)

| 의미 | 색 |
|------|-----|
| 뜨거움/사우나실/김 (brand) | `#F5402C` |
| 냉탕/온천물/차가움 | `#1C6FFF` · 연한 `#5C9BEE` / `#9CC2F5` |
| 목욕탕 욕조(분홍) | `#F2789B` / 테 `#E85C84` |
| 찜질방 돔(주황) | `#FF7A45` |
| 커뮤니티/락커(초록) | `#2E8B57` / `#3FA76A` |
| 먹색/문 | `#22201E` · `#2A2724` |

`♨` 김은 빨강 곡선 1~3가닥(`#F5402C`)으로 통일 — 거의 모든 일러스트의 공통 모티프.

### 사이즈 계열

- **대형 씬/카드 일러스트** — `BathhouseIllust`, `JjimjilbangIllust`, `HotSpringIllust`,
  `TrendingTubIllust`, `HotSaunaRoomIllust`, `Night24Scene`, `OutdoorScene`, `SesinScene`,
  `SandBathScene`, `FeaturedMapScene`, `Article*Thumb` 등. 홈 카테고리/테마 카드·썸네일용(정적 SVG).
- **칩 일러스트 (≈16–20px)** — `*Chip` 계열. 지도 칩·필터 칩처럼 *용어 옆 작은 토큰* 자리용.
  대형 일러스트의 모티프·팔레트를 압축한 짝이라 같은 용어가 어디서나 같게 읽힌다. `size` prop을 받는다.

| 칩 컴포넌트 | 용어 | 모티프 |
|------------|------|--------|
| `BathhouseChip` | 목욕탕 | 분홍 목욕 바구니(손잡이·망) + 샴푸병·빨강 바가지 |
| `JjimjilbangChip` | 찜질방 | 주황 한증막 돔 + 빨강 김 |
| `LodgingChip` | 호텔·숙소 | 파란 침대 |
| `CommunityChip` | 커뮤니티 | 초록 덤벨 |
| `HotSpringChip` | 온천 | 파란 노천탕 + 빨강 김 |

### 단독 모티프

| 컴포넌트 | 용어 | 모티프 |
|---------|------|--------|
| `SteamMark` | ♨ 김 | 빨강 곡선 3가닥(가운데가 큼) — 단색이라 토큰 배경 없이도 읽힌다 |
| `LogoMark` | 서비스 로고 | 좌상단만 각진 판(plate) — 정면 3스톱 + 측면(두께) 두 겹, 글로스 없음 |

전용 그림이 없는 상태 화면(404·에러)의 아이콘 자리에 `SteamMark` 를 쓴다. `size` prop.

`LogoMark` 는 서비스 로고라 다른 일러스트와 규칙이 다르다 — 색을 `app/globals.css`
의 `--mark-*` 토큰에서 받아 라이트/다크 그라운드용 두 벌이 자동으로 붙는다.
**글로스·하이라이트를 넣지 않는다**(무광 유지가 이 마크의 성격).
워드마크와 묶은 락업은 `components/layout/Logo.tsx` — 네 글자 모두 브랜드 레드.
앱 아이콘·OG는 satori가 SVG 그라디언트를 못 받아 `lib/og.tsx` 의 `MARK` 상수로
div 두 장을 쌓아 같은 그림을 다시 그린다. **마크 색을 바꾸면 두 곳을 같이 고친다.**
파비콘은 `npm run favicon`(dev 서버 3177 필요)으로 재생성.

### 칩 렌더 주의

칩 일러스트는 **다색**이라 `currentColor` 틴트가 안 된다. 활성(빨강 배경)/비활성(흰 배경)
어느 칩에서도 또렷하게 보이도록 **둥근 토큰 배경**(활성=흰색, 비활성=연회색 `#F4F2EF`) 위에 얹어 쓴다.
참고: `components/map/NaverMapView.tsx`의 `TOP_CHIPS` 렌더.

### 현재 사용처

- `app/page.tsx` — 홈 카테고리/테마 카드 (대형)
- `components/map/NaverMapView.tsx` — 지도 상단 빠른필터 칩 (`*Chip`)
- `app/not-found.tsx`, `app/error.tsx` — 상태 화면 (`SteamMark`)
