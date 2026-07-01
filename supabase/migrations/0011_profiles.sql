-- ============================================================
-- 0011_profiles — 회원 프로필(닉네임)
-- 최소 수집: 이메일은 auth.users에, 표시용 닉네임만 별도 보관.
-- 가입(auth.users insert) 시 트리거로 profiles 행 + 기본 닉네임 자동 생성.
-- 적용: Supabase Dashboard > SQL Editor 에 그대로 붙여넣기
-- ============================================================

create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  nickname    text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.profiles is '회원 표시용 프로필. 로그인 식별은 auth.users(이메일), 여기엔 닉네임만';

-- updated_at 자동 갱신(0001의 공용 함수 재사용)
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------- RLS: 본인 행만 ----------
alter table public.profiles enable row level security;

create policy "profiles read own" on public.profiles
  for select to authenticated using (auth.uid() = id);

create policy "profiles update own" on public.profiles
  for update to authenticated
  using (auth.uid() = id) with check (auth.uid() = id);

-- ---------- 가입 시 프로필 자동 생성 ----------
-- 기본 닉네임 = 이메일 로컬파트(@ 앞). 추가 가입 폼 없이 즉시 사용 가능.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, nickname)
  values (new.id, split_part(coalesce(new.email, ''), '@', 1))
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
