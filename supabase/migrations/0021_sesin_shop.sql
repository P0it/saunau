-- ============================================================
-- 사우나우(SAUNAU) — 1인 세신샵 별도 카테고리
-- PostgreSQL (Supabase). 0019 이후 적용.
-- 적용: Supabase Dashboard > SQL Editor 에 그대로 붙여넣기
-- ============================================================
-- 1인 세신샵(욕탕 없는 독립 세신)은 목욕장업이 아니라 미용업/자유업 등으로 등록돼
-- 공공데이터에 대부분 없다(효소찜질과 동일). 네이버 "세신샵" 검색으로 수집한다.
-- has_sesin(=목욕탕에 세신사가 있음, 속성)과 달리 is_sesin_shop 은 "욕탕 없는 독립 세신샵"
-- 이라는 별도 카테고리 신호다. 목욕탕(사우나) 필터에서 제외해 오염을 막는다(효소 방식).

-- 1) 카테고리 플래그
alter table public.saunas
  add column if not exists is_sesin_shop boolean not null default false;

comment on column public.saunas.is_sesin_shop is
  '1인 세신샵(욕탕 없는 독립 세신). 목욕탕 필터서 제외, 세신 테마 노출(primaryCategory 최우선).';

-- 부분 인덱스(true 행만 색인 → 작고 빠름)
create index if not exists saunas_sesin_shop_idx on public.saunas (id) where is_sesin_shop;

-- 2) saunas_nearby_v2(0016) 재정의 — is_sesin_shop 추가
--    내주변(거리순) 경로도 이 플래그를 실어야 목록에서 목욕탕 필터 제외가 일관되게 적용된다.
--    (RETURNS TABLE 변경은 반환 타입 변경이라 drop 후 재생성)
--    ⚠ 이 DB는 0019(찜/favorite_count) 미적용이라 favorite_count 컬럼을 넣지 않는다.
--      만약 나중에 0019 를 적용하면 이 함수가 favorite_count 포함본으로 되돌아가며
--      is_sesin_shop 이 빠지므로, 0019 적용 후 이 0020 을 다시 실행해야 한다.
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
