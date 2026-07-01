-- ============================================================
-- 0013_reviews — 방문자 후기(회원 작성, 공유 노출)
-- 불꽃 5점 + 한줄평. 1인 1후기/매장(upsert). 닉네임은 profiles에서.
-- profiles는 "본인만 읽기"(0011) RLS라 공개 조인이 불가 →
-- 닉네임 포함 목록은 SECURITY DEFINER RPC(sauna_reviews_for)로 내려준다.
-- 적용: Supabase Dashboard > SQL Editor 에 그대로 붙여넣기
-- ============================================================

create table public.sauna_reviews (
  id          uuid primary key default gen_random_uuid(),
  sauna_id    uuid not null references public.saunas(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  rating      smallint not null check (rating between 1 and 5),
  body        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (sauna_id, user_id)                 -- 1인 1후기/매장(upsert 키)
);

comment on table public.sauna_reviews is '방문자 후기(회원). 불꽃 5점+한줄평. 닉네임은 profiles 조인';

create index sauna_reviews_sauna_idx
  on public.sauna_reviews (sauna_id, created_at desc);

create trigger sauna_reviews_set_updated_at
  before update on public.sauna_reviews
  for each row execute function public.set_updated_at();   -- 0001 공용 함수 재사용

-- ---------- RLS: 공개 읽기 + 본인만 쓰기 ----------
alter table public.sauna_reviews enable row level security;

create policy "sauna_reviews read" on public.sauna_reviews
  for select to anon, authenticated using (true);

create policy "sauna_reviews insert own" on public.sauna_reviews
  for insert to authenticated with check (auth.uid() = user_id);

create policy "sauna_reviews update own" on public.sauna_reviews
  for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "sauna_reviews delete own" on public.sauna_reviews
  for delete to authenticated using (auth.uid() = user_id);

-- ---------- 닉네임 포함 후기 목록(매장별, 최신순) ----------
-- profiles RLS를 우회해 표시용 닉네임만 join. 본문/평점은 공개 정보.
create or replace function public.sauna_reviews_for(p_sauna_id uuid)
returns table (
  id         uuid,
  user_id    uuid,
  rating     smallint,
  body       text,
  nickname   text,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select r.id, r.user_id, r.rating, r.body,
         coalesce(nullif(p.nickname, ''), '사우나우님') as nickname,
         r.created_at, r.updated_at
  from public.sauna_reviews r
  left join public.profiles p on p.id = r.user_id
  where r.sauna_id = p_sauna_id
  order by r.created_at desc
$$;

grant execute on function public.sauna_reviews_for(uuid) to anon, authenticated;
