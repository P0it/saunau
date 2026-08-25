-- ============================================================
-- 0031_profiles_onboarding — 가입 절차(약관 동의 + 닉네임)
-- 0011은 가입 즉시 이메일 로컬파트를 닉네임으로 박았다. 문제 둘:
--   (1) 후기에 닉네임이 공개되므로 이메일 앞글자가 그대로 노출된다
--   (2) 카카오는 이메일이 선택 동의라 email이 null일 수 있다 → 닉네임이 빈 문자열
-- 그래서 닉네임은 트리거가 만들지 않고 온보딩(/welcome)에서 받는다.
-- 동의 이력은 법적 증빙이라 컬럼으로 남긴다.
-- 적용: Supabase Dashboard > SQL Editor 에 그대로 붙여넣기
-- ============================================================

-- ---------- 프로필 확장 ----------
alter table public.profiles
  add column if not exists onboarded_at        timestamptz,
  add column if not exists terms_agreed_at     timestamptz,
  add column if not exists privacy_agreed_at   timestamptz,
  add column if not exists marketing_agreed_at timestamptz,
  add column if not exists terms_version       text,
  add column if not exists avatar_url          text;

comment on column public.profiles.onboarded_at is '가입 절차(약관 동의+닉네임) 완료 시각. null이면 /welcome 으로 게이트';
comment on column public.profiles.terms_agreed_at is '이용약관 필수 동의 시각';
comment on column public.profiles.privacy_agreed_at is '개인정보처리방침 필수 동의 시각';
comment on column public.profiles.marketing_agreed_at is '마케팅 수신 선택 동의 시각. null이면 미동의';
comment on column public.profiles.terms_version is '동의 당시 약관 버전. 개정 시 재동의 판단용';
comment on column public.profiles.avatar_url is '카카오·구글이 준 프로필 사진 URL. 직접 업로드는 지원하지 않음';

-- 닉네임 길이 제약 — 온보딩 입력 검증(2~12자)과 같은 규칙을 DB에서도 강제.
-- null 은 허용(온보딩 전 상태). 기존 행이 없으므로 not valid 없이 바로 건다.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_nickname_len'
  ) then
    alter table public.profiles
      add constraint profiles_nickname_len
      check (nickname is null or char_length(nickname) between 2 and 12);
  end if;
end $$;

-- ---------- RLS: 본인 행 insert 허용 ----------
-- 트리거가 security definer 라 평소엔 필요 없지만, 온보딩이 upsert 로 자기 행을
-- 만들어야 하는 경우(트리거 이전 가입자·복구)를 위한 안전망.
drop policy if exists "profiles insert own" on public.profiles;
create policy "profiles insert own" on public.profiles
  for insert to authenticated with check (auth.uid() = id);

-- ---------- 가입 트리거 재정의 ----------
-- 닉네임 자동 생성을 걷어낸다. OAuth가 준 프로필 사진만 채우고,
-- 표시 이름은 온보딩에서 사용자가 직접 정한다.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, nickname, avatar_url)
  values (
    new.id,
    null,
    coalesce(
      new.raw_user_meta_data ->> 'avatar_url',
      new.raw_user_meta_data ->> 'picture',
      new.raw_user_meta_data -> 'kakao_account' -> 'profile' ->> 'profile_image_url'
    )
  )
  on conflict (id) do nothing;
  return new;
end $$;

-- 트리거 자체는 0011에서 만든 것을 그대로 쓴다(함수만 교체).
