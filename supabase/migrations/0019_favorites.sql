-- ============================================================
-- 0019_favorites — 로그인 사용자 찜(즐겨찾기)
-- 지금까지 찜은 브라우저 localStorage(lib/favorites.ts)에만 있었다.
-- 로그인(0011_profiles/auth)이 붙었으므로 서버에 사용자별로 저장해
--   (1) 기기 바뀌어도 유지되고
--   (2) 매장별 찜 수를 집계해 "추천순=찜 많은 순" 정렬에 쓴다.
-- 집계는 rating(0016)과 같은 방식: saunas 에 선계산 컬럼 + 트리거.
-- 적용: Supabase Dashboard > SQL Editor 에 그대로 붙여넣기
-- ============================================================

-- ---------- 찜 테이블 ----------
-- 사용자×매장 1행. 토글은 insert/delete 라 update 없음 → 복합 PK로 유일성 보장.
create table public.sauna_favorites (
  user_id    uuid not null references auth.users(id) on delete cascade,
  sauna_id   uuid not null references public.saunas(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, sauna_id)
);

comment on table public.sauna_favorites is '로그인 사용자 찜. (user_id, sauna_id) 유일. 매장 찜 수는 트리거로 saunas.favorite_count 에 집계';

-- PK(user_id, sauna_id)가 "내 찜 목록"(user_id 선두) 조회를 커버.
-- 역방향(매장별 찜 조회·재집계)용 인덱스만 추가.
create index sauna_favorites_sauna_id_idx on public.sauna_favorites (sauna_id);

-- ---------- RLS: 본인 찜만 ----------
alter table public.sauna_favorites enable row level security;

create policy "favorites read own" on public.sauna_favorites
  for select to authenticated using (auth.uid() = user_id);

create policy "favorites insert own" on public.sauna_favorites
  for insert to authenticated with check (auth.uid() = user_id);

create policy "favorites delete own" on public.sauna_favorites
  for delete to authenticated using (auth.uid() = user_id);

-- ---------- 선계산 컬럼: 매장별 찜 수 ----------
alter table public.saunas
  add column if not exists favorite_count integer not null default 0;

comment on column public.saunas.favorite_count is '로그인 사용자 찜 수(sauna_favorites 집계 트리거로 유지). 정렬(추천순) 노출용';

create index if not exists saunas_favorite_count_idx
  on public.saunas (favorite_count desc);

-- ---------- 단건 재집계 함수 ----------
-- 해당 매장의 찜 수를 sauna_favorites 에서 다시 세어 saunas 에 반영.
create or replace function public.refresh_sauna_favorite_count(p_sauna_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.saunas s
  set favorite_count = (
    select count(*)::int
    from public.sauna_favorites
    where sauna_id = p_sauna_id
  )
  where s.id = p_sauna_id;
$$;

-- ---------- 트리거: 찜 변경 시 해당 매장 재집계 ----------
create or replace function public.sauna_favorites_agg_trg()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'DELETE') then
    perform public.refresh_sauna_favorite_count(old.sauna_id);
    return old;
  end if;
  perform public.refresh_sauna_favorite_count(new.sauna_id);
  return new;
end;
$$;

drop trigger if exists sauna_favorites_agg on public.sauna_favorites;
create trigger sauna_favorites_agg
  after insert or delete on public.sauna_favorites
  for each row execute function public.sauna_favorites_agg_trg();

-- 신규 테이블이라 백필 대상 없음(favorite_count 기본값 0).

-- ============================================================
-- saunas_nearby_v2(0016) 재정의 — favorite_count 추가
-- 찜순 정렬은 "내 주변에서 찜 많은 순"이라 nearby 경로가 이 컬럼을 실어야 한다.
-- (RETURNS TABLE 변경은 반환 타입 변경이라 drop 후 재생성)
-- ============================================================
drop function if exists public.saunas_nearby_v2(double precision, double precision, double precision, integer);

create function public.saunas_nearby_v2(
  lng         double precision,
  lat         double precision,
  radius_m    double precision default 8000,
  max_results integer default 120
)
returns table (
  id               uuid,
  license_no       text,
  name             text,
  address          text,
  sido             text,
  sigungu          text,
  dong             text,
  location         geography,
  status           text,
  closed_date      date,
  phone            text,
  open_date        date,
  created_at       timestamptz,
  is_jjimjilbang   boolean,
  is_hot_spring    boolean,
  is_enzyme        boolean,
  is_24h           boolean,
  has_outdoor      boolean,
  sauna_room_temp  integer,
  cold_bath_temp   integer,
  has_sesin        boolean,
  sauna_kind       text[],
  price            integer,
  hours            text,
  has_parking      boolean,
  parking_note     text,
  water_note       text,
  thumbnail_url    text,
  thumbnail_source text,
  editor_note      text,
  ai_description   text,
  slug             text,
  rating_avg       numeric,
  rating_count     integer,
  favorite_count   integer,
  distance_m       double precision
)
language sql stable as $$
  select s.id, s.license_no, s.name, s.address,
         s.sido, s.sigungu, s.dong,
         s.location::geography, s.status, s.closed_date,
         s.phone, s.open_date, s.created_at,
         s.is_jjimjilbang, s.is_hot_spring, s.is_enzyme,
         s.is_24h, s.has_outdoor,
         s.sauna_room_temp, s.cold_bath_temp,
         s.has_sesin, s.sauna_kind, s.price, s.hours,
         s.has_parking, s.parking_note, s.water_note,
         s.thumbnail_url, s.thumbnail_source,
         s.editor_note, s.ai_description, s.slug,
         s.rating_avg, s.rating_count, s.favorite_count,
         st_distance(s.location, st_makepoint(lng, lat)::geography) as distance_m
  from public.saunas s
  where s.location is not null
    and s.status = '영업/정상'
    and not s.needs_review
    and st_dwithin(s.location, st_makepoint(lng, lat)::geography, radius_m)
  order by s.location <-> st_makepoint(lng, lat)::geography
  limit max_results;
$$;

grant execute on function public.saunas_nearby_v2(double precision, double precision, double precision, integer)
  to anon, authenticated;
