-- ============================================================
-- 사우나우(SAUNAU) — 지도/카드용 "거리순 전체컬럼" 조회 RPC
-- PostgreSQL (Supabase). 0006 이후 적용.
-- 적용: Supabase Dashboard > SQL Editor 에 그대로 붙여넣기
-- ============================================================
-- 기존 saunas_nearby(0001)는 카드 미리보기용 트리밍 컬럼만 반환해
-- 지도 마커(좌표·분류 플래그·sido 필요)에 쓸 수 없다. 그래서 mapRow(queries.ts)가
-- 기대하는 전체 컬럼 + distance_m 을 반환하는 v2 를 추가한다(기존 함수는 그대로 둠).
-- 좌표 결측 제외, 영업/정상 + 검수통과만, 반경 내, 가까운 순.
create or replace function public.saunas_nearby_v2(
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
         st_distance(s.location, st_makepoint(lng, lat)::geography) as distance_m
  from public.saunas s
  where s.location is not null
    and s.status = '영업/정상'
    and not s.needs_review
    and st_dwithin(s.location, st_makepoint(lng, lat)::geography, radius_m)
  order by s.location <-> st_makepoint(lng, lat)::geography
  limit max_results;
$$;

-- anon(공개 읽기)에서 supabase.rpc('saunas_nearby_v2', {...}) 호출 가능하게.
grant execute on function public.saunas_nearby_v2(double precision, double precision, double precision, integer)
  to anon, authenticated;
