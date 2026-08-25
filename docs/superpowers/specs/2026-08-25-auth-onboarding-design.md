# 로그인·가입 온보딩 + 찜 실사용화 설계

작성일: 2026-08-25

## 배경 — 왜 지금 하는가

라이브 Supabase 프로젝트를 조회한 결과:

- `profiles`, `sauna_favorites`, `sauna_reviews` 테이블은 모두 존재(마이그레이션 적용 완료)
- `auth.users` **0명** — 지금까지 가입에 성공한 사용자가 없다
- Auth settings 의 `external.google` = `false`, `external.kakao` = `false`
  → `LoginSheet` 의 주 버튼(구글)이 provider 미활성으로 실패한다
- 이메일 매직링크는 활성이나 Supabase 기본 SMTP(시간당 3통·팀 멤버 한정)라 실사용 불가

즉 찜·후기 코드는 이미 서버(RLS 포함) 연동이 끝나 있는데 **로그인이 뚫린 적이 없어**
모든 회원 테이블이 비어 있다. 기능이 없는 게 아니라 진입로가 막혀 있었다.

동시에 두 가지 구조적 결함이 있다.

1. 가입 절차가 없다. `handle_new_user` 트리거가 이메일 로컬파트를 닉네임으로 박고 끝난다.
   후기에 닉네임이 공개되므로 이메일 앞글자가 그대로 노출된다. 약관 동의 이력도 남지 않는다.
2. 비로그인 상태에서 찜 하트가 죽어 있다. `lib/favorites.ts` 의 `toggle` 이
   `userId` 가 없으면 조용히 return 한다 — 눌러도 아무 일도 일어나지 않는다.

## 결정 사항

| 항목 | 결정 |
|---|---|
| 로그인 수단 | 카카오(주) + 구글(보조). 이메일 매직링크는 폴백으로 유지 |
| 가입 절차 | 약관 동의 → 닉네임 설정, 2단계 |
| 비로그인 찜 | localStorage 저장 → 로그인 시 서버로 병합 |
| 약관 본문 | 실제 수집 항목에 맞춰 초안 작성, "법률 검토 전" 표시 |
| 온보딩 게이트 | 전용 라우트 `/welcome` + 클라이언트 게이트 |

### 온보딩 게이트를 라우트로 둔 이유

시트(sheet) 안에서 로그인→약관→닉네임을 잇는 방식은 OAuth 와 맞지 않는다.
카카오·구글은 페이지를 떠났다가 `/auth/callback` 으로 돌아오므로 시트 상태가 소실된다.
미들웨어(`proxy.ts`) 판정은 깜빡임이 없는 대신 요청마다 `profiles` 조회가 붙는데,
이 앱은 대부분 클라이언트 컴포넌트라 이득 대비 비용이 크다.

## 구성 요소

### 1. Provider 설정 (코드 밖 — `docs/auth-setup.md`)

카카오 개발자 앱·GCP OAuth 클라이언트를 만들고 Supabase Dashboard 에서 활성화한다.
Redirect URI 는 양쪽 모두 `https://<project>.supabase.co/auth/v1/callback`.

**카카오는 이메일이 선택 동의라 `user.email` 이 `null` 일 수 있다.**
따라서 로그인 여부 판정은 `user.email` 이 아니라 `user.id` 를 기준으로 해야 한다.
현재 `ProfileHeader` 가 `email != null` 로 판정하고 있어 카카오 로그인 시 비로그인으로 보인다.

### 2. 스키마 — `supabase/migrations/0031_profiles_onboarding.sql`

`profiles` 에 컬럼을 추가한다.

| 컬럼 | 용도 |
|---|---|
| `onboarded_at timestamptz` | null 이면 온보딩 미완료 = 게이트 조건 |
| `terms_agreed_at` / `privacy_agreed_at` | 필수 동의 시각(법적 증빙) |
| `marketing_agreed_at` | 선택 동의. null = 미동의 |
| `terms_version text` | 약관 개정 시 재동의 판단 |
| `avatar_url text` | 카카오·구글 프로필 사진 |

`handle_new_user` 트리거에서 이메일 앞글자 닉네임 자동 생성을 걷어낸다.
카카오는 이메일이 없을 수 있고 어차피 온보딩에서 받으므로 `nickname` 은 null 로 두고,
`raw_user_meta_data` 의 프로필 사진만 채운다.
닉네임 길이 2~12자 CHECK 제약을 추가한다.

`auth.users` 가 0명이므로 백필 대상이 없다.

### 3. 온보딩 — `app/welcome/page.tsx`

2단계, 뒤로가기 가능.

1. **약관 동의** — 전체 동의 + 개별 3항목(이용약관 필수 / 개인정보 필수 / 마케팅 선택).
   각 항목의 "보기"가 `/terms`·`/privacy` 로 이동
2. **닉네임** — 기본값은 카카오·구글이 준 이름, 2~12자 검증.
   확인 시 `profiles` 갱신 + `onboarded_at = now()` → `/my` 진입

`AppFrame` 게이트: `user && onboarded_at == null` 이고 경로가
`/welcome`·`/terms`·`/privacy`·`/auth/*` 가 아니면 `/welcome` 으로 replace.
`loading` 동안에는 게이트를 보류해 첫 페인트 깜빡임을 막는다.

### 4. 약관 — `/terms`, `/privacy`

본문은 `content/legal/terms.md`, `content/legal/privacy.md`.
렌더링은 매거진이 쓰는 `react-markdown` + `remark-gfm` 을 재사용한다.

개인정보처리방침은 이 서비스가 실제로 다루는 것만 적는다 —
이메일·닉네임·프로필사진(로그인), 찜·후기·방문기록·메모·업로드 사진(서비스 이용),
위치(내 주변, 저장하지 않음), 처리위탁(Supabase·Vercel·네이버지도), 보유기간, 파기,
이용자 권리와 탈퇴 절차. 상단에 "초안 — 법률 검토 전" 을 표시한다.

### 5. 찜 — `lib/favorites.ts`

- 비로그인: `localStorage("saunau:favorites")` 에 id 배열. 하트가 정상 동작
- 로그인 전환 시: 로컬 id 를 `sauna_favorites` 에 `upsert(ignoreDuplicates)` 로 올리고
  로컬을 비운 뒤 서버 목록을 재로드
- `useFavorites` 가 `isLocal`(비로그인 로컬 모드)을 노출.
  `app/favorites/page.tsx` 의 잠금 화면을 목록 + "로그인하면 기기가 바뀌어도 유지돼요" 배너로 교체

호출부는 `FavoriteScrubber`, `app/my/page.tsx`, `app/favorites/page.tsx` 세 곳뿐이다.

### 6. 계정 — `AccountSheet`

`user.id` 기준 판정, 카카오 로그인이고 이메일이 없으면 "카카오 계정으로 로그인됨" 표시.
프로필 사진 노출, 마케팅 수신 동의 토글, **회원 탈퇴**.
탈퇴는 `/api/account/delete` 가 service role 로 `auth.admin.deleteUser` 를 호출하고
FK cascade 로 프로필·찜·후기·기록이 함께 정리된다.
개인정보처리방침에 탈퇴 절차를 적는 이상 실제로 동작해야 한다.

## 검증

provider 활성화는 사람이 해야 하므로, 그 전까지 코드로 검증 가능한 범위는:

- `npm run lint`
- 0031 적용 후 스키마 조회로 컬럼 확인
- service role 로 테스트 유저 생성 → 트리거가 `profiles` 행을 만드는지, 닉네임이 null 인지 확인
- 로컬 찜 병합 로직 확인

실제 카카오·구글 로그인 왕복은 provider 활성화 후 사람이 확인한다.

## 범위 밖

- 재동의 플로우(약관 개정 시). `terms_version` 컬럼만 미리 둔다
- 프로필 사진 직접 업로드. OAuth 제공 사진만 쓴다
- 닉네임 중복 방지. 후기 표시용이라 중복을 허용한다
