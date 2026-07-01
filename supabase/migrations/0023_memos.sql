-- ============================================================
-- 0023_memos — 로그인 사용자 비공개 메모(사우나별)
-- 지금까지 메모는 브라우저 localStorage(lib/records.ts)에만 있었다.
-- 로그인(0011)이 붙었고 찜(0019)을 서버로 옮기는 것과 함께
-- 메모도 계정에 저장해 기기가 바뀌어도 유지되게 한다.
-- 후기(0013)와 달리 비공개(본인만) — 집계·노출 없음.
-- 적용: Supabase Dashboard > SQL Editor 에 그대로 붙여넣기
-- ============================================================

-- 사용자×매장 1행. 같은 사우나 메모는 upsert로 갱신 → 복합 PK.
create table public.sauna_memos (
  user_id    uuid not null references auth.users(id) on delete cascade,
  sauna_id   uuid not null references public.saunas(id) on delete cascade,
  note       text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, sauna_id)
);

comment on table public.sauna_memos is
  '로그인 사용자 비공개 메모. (user_id, sauna_id) 유일. 본인만 열람(RLS). 후기와 별개.';

-- "내 메모 목록"(user_id 선두)은 PK가 커버. 최신순 정렬용 보조 인덱스.
create index sauna_memos_user_updated_idx
  on public.sauna_memos (user_id, updated_at desc);

-- ---------- RLS: 본인 메모만 ----------
alter table public.sauna_memos enable row level security;

create policy "memos read own" on public.sauna_memos
  for select to authenticated using (auth.uid() = user_id);

create policy "memos insert own" on public.sauna_memos
  for insert to authenticated with check (auth.uid() = user_id);

create policy "memos update own" on public.sauna_memos
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "memos delete own" on public.sauna_memos
  for delete to authenticated using (auth.uid() = user_id);
