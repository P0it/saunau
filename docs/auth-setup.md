# 로그인 provider 설정 (사람이 하는 작업)

코드는 카카오·구글·이메일 세 경로를 모두 지원하지만, **provider 활성화는 Supabase
대시보드와 각 플랫폼 개발자 콘솔에서만 가능**하다. 이 문서대로 켜야 로그인이 동작한다.

현재 상태(2026-08-25 조회): `kakao=false`, `google=false`, `email=true`.
즉 지금은 어떤 사용자도 로그인할 수 없다 — `auth.users` 0명.

Supabase 프로젝트 ref: `ddvsfjkrpzueudbfvslx`
**공통 Redirect URI: `https://ddvsfjkrpzueudbfvslx.supabase.co/auth/v1/callback`**

---

## 1. 카카오 (주 로그인)

1. https://developers.kakao.com → 내 애플리케이션 → 애플리케이션 추가하기
   - 앱 이름 `사우나우`, 사업자명 입력
2. **앱 키** 탭에서 `REST API 키` 복사
3. **카카오 로그인** 탭
   - 활성화 설정 ON
   - Redirect URI 에 `https://ddvsfjkrpzueudbfvslx.supabase.co/auth/v1/callback` 등록
4. **카카오 로그인 > 보안** 탭 → `Client Secret` 생성 후 활성화 ON, 코드 복사
5. **카카오 로그인 > 동의항목**
   - 닉네임: 필수 동의
   - 프로필 사진: 선택 동의
   - 카카오계정(이메일): 선택 동의
     > 이메일은 선택이라 `user.email` 이 **null 일 수 있다**. 앱은 이를 전제로 동작한다
       (로그인 판정은 `user.id` 기준, 계정 화면은 이메일이 없으면 "카카오 계정으로 로그인됨" 표시).
6. Supabase Dashboard → Authentication → Providers → **Kakao**
   - Enable ON
   - `Kakao Client ID` = REST API 키
   - `Kakao Client Secret` = 4번에서 만든 시크릿

## 2. 구글 (보조 로그인)

1. https://console.cloud.google.com → APIs & Services → OAuth consent screen
   - External, 앱 이름 `사우나우`, 지원 이메일 입력
   - 승인된 도메인에 `supabase.co`, `saunau.vercel.app` 추가
2. Credentials → Create Credentials → OAuth client ID → Web application
   - 승인된 리디렉션 URI: `https://ddvsfjkrpzueudbfvslx.supabase.co/auth/v1/callback`
3. Supabase Dashboard → Authentication → Providers → **Google**
   - Enable ON, Client ID / Client Secret 입력

## 3. 리디렉션 허용 목록

Supabase Dashboard → Authentication → URL Configuration

- **Site URL**: `https://saunau.vercel.app`
- **Redirect URLs** 에 아래를 모두 추가
  - `https://saunau.vercel.app/auth/callback`
  - `http://localhost:3000/auth/callback`
  - Vercel 프리뷰를 쓸 경우 `https://*.vercel.app/auth/callback`

여기 없는 origin 으로 돌아오면 Supabase 가 리디렉션을 거부한다.

## 4. 이메일 매직링크 (폴백)

기본 SMTP 는 **시간당 3통·팀 멤버 한정**이라 실사용이 불가하다. 폴백을 실제로 쓰려면
Authentication → Emails → SMTP Settings 에 커스텀 SMTP(Resend·SendGrid 등)를 연결한다.
연결 전까지 이메일 경로는 "동작하지만 대부분의 사용자에게 메일이 가지 않는" 상태다.

## 5. 마이그레이션

`supabase/migrations/0031_profiles_onboarding.sql` 을 Dashboard → SQL Editor 에
붙여넣어 실행한다. 가입 절차(약관 동의·닉네임)가 이 컬럼들에 의존한다.

## 확인 방법

1. 0031 적용 → SQL Editor 에서 `select * from public.profiles limit 1;` 컬럼 확인
2. provider 활성화 후 `/my` → 로그인 → 카카오 동의 → `/welcome` 진입
3. 약관 동의 → 닉네임 입력 → `/my` 로 들어오면 성공
4. SQL Editor 에서 `select id, nickname, onboarded_at, terms_agreed_at from public.profiles;`
