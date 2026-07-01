-- ============================================================
-- 0016_review_rating_agg — 방문자 후기 평점 집계(리스트·상세 노출용)
-- sauna_reviews(0013)의 불꽃 5점을 매장별 평균/개수로 비정규화해
-- saunas 에 선계산 컬럼으로 둔다(리스트 카드·상세 히어로가 join 없이 읽음).
-- sauna_reviews 의 insert/update/delete 마다 트리거로 자동 갱신.
-- 적용: Supabase Dashboard > SQL Editor 에 그대로 붙여넣기
-- ============================================================

-- ---------- 선계산 컬럼 ----------
alter table public.saunas
  add column if not exists rating_avg   numeric(3, 2),                 -- 평균(1.00~5.00). 후기 없으면 null
  add column if not exists rating_count integer not null default 0;    -- 후기 수

comment on column public.saunas.rating_avg   is '방문자 후기(sauna_reviews) 평균 평점. 후기 없으면 null';
comment on column public.saunas.rating_count is '방문자 후기 수(집계 트리거로 유지)';

-- ---------- 단건 재집계 함수 ----------
-- 해당 매장의 avg/count 를 sauna_reviews 에서 다시 계산해 saunas 에 반영.
create or replace function public.refresh_sauna_rating(p_sauna_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.saunas s
  set rating_count = agg.cnt,
      rating_avg   = case when agg.cnt > 0
                          then round(agg.sum::numeric / agg.cnt, 2)
                          else null end
  from (
    select count(*)::int as cnt, coalesce(sum(rating), 0) as sum
    from public.sauna_reviews
    where sauna_id = p_sauna_id
  ) agg
  where s.id = p_sauna_id;
$$;

-- ---------- 트리거: 후기 변경 시 해당 매장 재집계 ----------
create or replace function public.sauna_reviews_agg_trg()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'DELETE') then
    perform public.refresh_sauna_rating(old.sauna_id);
    return old;
  end if;
  perform public.refresh_sauna_rating(new.sauna_id);
  -- sauna_id 가 바뀌는 update 는 없지만(키 고정) 방어적으로 옛 매장도 갱신
  if (tg_op = 'UPDATE' and new.sauna_id <> old.sauna_id) then
    perform public.refresh_sauna_rating(old.sauna_id);
  end if;
  return new;
end;
$$;

drop trigger if exists sauna_reviews_agg on public.sauna_reviews;
create trigger sauna_reviews_agg
  after insert or update or delete on public.sauna_reviews
  for each row execute function public.sauna_reviews_agg_trg();

-- ---------- 기존 후기 백필 ----------
update public.saunas s
set rating_count = agg.cnt,
    rating_avg   = round(agg.sum::numeric / agg.cnt, 2)
from (
  select sauna_id, count(*)::int as cnt, sum(rating) as sum
  from public.sauna_reviews
  group by sauna_id
) agg
where s.id = agg.sauna_id;

-- ============================================================
-- saunas_nearby_v2(0007) 재정의 — rating_avg/rating_count 추가
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
         s.rating_avg, s.rating_count,
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
