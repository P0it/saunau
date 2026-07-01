-- ============================================================
-- 사우나우(SAUNAU) — saunas_nearby_v2 에 venue_type 복원
-- PostgreSQL (Supabase). 0025 이후 적용.
-- 적용: Supabase Dashboard > SQL Editor 에 그대로 붙여넣기
-- ============================================================
--
-- 배경: venue_type 은 0010 에서 RPC 반환에 포함됐지만, 이후 0016/0019/0021 의
--   재정의(RETURNS TABLE 변경 → drop/create)에서 매번 누락됐다. 그 결과
--   "내 주변(거리순)" 경로(getSaunasNearby → RPC)로 받은 행은 venue_type 이 없어
--   mapRow 에서 전부 기본값 'standalone' 으로 떨어졌다.
--   → 위치 권한이 있는 화면에서만 "호텔·숙소/체육·복지시설" 필터가 항상 빈 결과.
--
-- 0021 정의를 그대로 유지하고 venue_type 만 되살린다(반환 타입 변경이라 drop 후 재생성).

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
  is_sesin_shop    boolean,
  venue_type       text,
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
         s.is_jjimjilbang, s.is_hot_spring, s.is_enzyme, s.is_sesin_shop,
         s.venue_type,
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
