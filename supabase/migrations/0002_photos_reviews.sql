-- ============================================================
-- 사우나우(SAUNAU) — 매장 사진·블로그 후기 + 안전장치(킬스위치/출처)
-- PostgreSQL (Supabase). 0001_init.sql 이후 적용.
-- 적용: Supabase Dashboard > SQL Editor 에 그대로 붙여넣기
-- ============================================================

-- ---------- 0) saunas: 대표 썸네일 출처 컬럼 ----------
-- thumbnail_url(0001)은 대표 사진 캐시로 재사용. 그 출처를 함께 기록해
-- 교체 우선순위(owner>editor>licensed/google>naver_crawl)·퍼지에 사용한다.
alter table public.saunas
  add column if not exists thumbnail_source text;          -- 'naver_crawl'|'owner'|'editor'|'google'|'licensed'

comment on column public.saunas.thumbnail_source is
  '대표 썸네일 출처. 교체 우선순위/퍼지 기준. 클라이언트로 노출하지 않음(서버 전용).';

-- ============================================================
-- 1) sauna_photos — 갤러리 다중 사진 + 출처(provenance)
--    ⚠ url 은 항상 우리 Storage URL. source_url(원본)은 서버 전용(클라 노출 금지).
-- ============================================================
create table if not exists public.sauna_photos (
  id           uuid primary key default gen_random_uuid(),
  sauna_id     uuid not null references public.saunas(id) on delete cascade,
  storage_path text,                                       -- 버킷 내 경로 sauna-photos/{sauna_id}/{n}.jpg
  url          text not null,                              -- 우리 Storage 공개 URL (클라 노출용)
  source       text not null
    check (source in ('naver_crawl','owner','editor','google','licensed')),
  source_url   text,                                       -- 원본 URL(추적/퍼지/내림 근거) — 서버 전용
  width        integer,
  height       integer,
  sort_order   integer not null default 0,
  is_active    boolean not null default true,              -- 개별 사진 소프트 토글(부분 내림)
  created_at   timestamptz not null default now()
);

comment on table public.sauna_photos is '매장 사진 갤러리. url=우리 Storage, source_url=서버 전용';
comment on column public.sauna_photos.source_url is '원본 URL. 서버 전용 — 절대 클라이언트로 select 하지 않는다';

create index if not exists sauna_photos_sauna_sort_idx
  on public.sauna_photos (sauna_id, sort_order);
-- 퍼지용: 크롤 출처만 빠르게 식별·삭제
create index if not exists sauna_photos_naver_crawl_idx
  on public.sauna_photos (id) where source = 'naver_crawl';

-- ============================================================
-- 2) sauna_blog_reviews — 네이버 블로그 링크 카드(제목+발췌+링크아웃)
--    blog_url(원문 링크아웃)은 합법 인용이므로 클라 노출. thumb_url 은 자체 호스팅분만.
-- ============================================================
create table if not exists public.sauna_blog_reviews (
  id           uuid primary key default gen_random_uuid(),
  sauna_id     uuid not null references public.saunas(id) on delete cascade,
  title        text not null,
  snippet      text,
  blog_url     text not null,                              -- 원문 링크아웃(클릭 시 이동)
  blogger_name text,
  thumb_url    text,                                       -- 우리 Storage 재호스팅분만(없으면 null)
  posted_at    date,
  source       text not null default 'naver_blog',
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  unique (sauna_id, blog_url)                              -- 동일 후기 중복 방지(upsert 키)
);

comment on table public.sauna_blog_reviews is '네이버 블로그 후기 링크 카드. blog_url 링크아웃은 합법 인용';

create index if not exists sauna_blog_reviews_sauna_idx
  on public.sauna_blog_reviews (sauna_id, posted_at desc nulls last);

-- ============================================================
-- 3) system_flags — 런타임 킬스위치(재배포 없이 즉시 반영)
--    값만 바꾸면 사진/블로그후기를 독립적으로 끌 수 있다.
-- ============================================================
create table if not exists public.system_flags (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

comment on table public.system_flags is '런타임 기능 플래그(킬스위치). 대시보드/스크립트에서 value 변경 → 즉시 반영';

insert into public.system_flags (key, value) values
  ('images_enabled',       'true'::jsonb),
  ('blog_reviews_enabled', 'true'::jsonb)
on conflict (key) do nothing;

create trigger system_flags_set_updated_at
  before update on public.system_flags
  for each row execute function public.set_updated_at();   -- 0001 정의 재사용

-- ============================================================
-- 4) RLS — 공개 읽기(활성분), 쓰기는 service_role 우회
-- ============================================================
alter table public.sauna_photos       enable row level security;
alter table public.sauna_blog_reviews enable row level security;
alter table public.system_flags       enable row level security;

create policy "sauna_photos read" on public.sauna_photos
  for select to anon, authenticated using (is_active);

create policy "sauna_blog_reviews read" on public.sauna_blog_reviews
  for select to anon, authenticated using (is_active);

create policy "system_flags read" on public.system_flags
  for select to anon, authenticated using (true);

-- ============================================================
-- 5) Storage 버킷 — sauna-photos (공개 읽기, 쓰기 service_role)
--    버킷/객체 정책은 SQL 로 생성 가능. 서비스롤은 RLS 우회하므로 쓰기 정책 불필요.
-- ============================================================
insert into storage.buckets (id, name, public)
values ('sauna-photos', 'sauna-photos', true)
on conflict (id) do nothing;

-- 공개 읽기(버킷이 public=true 면 자동 공개지만, 명시 정책으로 의도 고정)
drop policy if exists "sauna-photos public read" on storage.objects;
create policy "sauna-photos public read" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'sauna-photos');
