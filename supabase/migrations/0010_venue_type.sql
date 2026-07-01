-- ============================================================
-- 사우나우(SAUNAU) — 장소 유형(venue_type) 분류 축 추가
-- PostgreSQL (Supabase). 0009 이후 적용.
-- 적용: Supabase Dashboard > SQL Editor 에 그대로 붙여넣기
-- ============================================================
--
-- 기존 카테고리(is_jjimjilbang/is_hot_spring/is_enzyme)는 "탕의 종류" 축이다.
-- venue_type 은 이와 직교하는 "어떤 장소인가" 축으로, 신종·부속 사우나를 분류한다.
--   - standalone : 독립형(전통 대중탕/사우나/찜질방) — 기본값
--   - lodging    : 숙박형(호텔·리조트·숙소 부속) 예) 루프 사우나, 아늑 시그니처
--   - community  : 커뮤니티형(휘트니스·주민체육·복지시설 부속) 예) 버핏그라운드, 구립체육센터
--
-- 분류 신호는 lib/ingest/mapToSauna.ts 의 classifyVenue() 와 동일하게 유지한다(상호/주소 키워드).

-- 1) 컬럼 + 제약
alter table public.saunas
  add column if not exists venue_type text not null default 'standalone';

alter table public.saunas
  drop constraint if exists saunas_venue_type_chk;
alter table public.saunas
  add constraint saunas_venue_type_chk
  check (venue_type in ('standalone', 'lodging', 'community'));

comment on column public.saunas.venue_type is
  '장소 유형(탕 종류와 직교): standalone(독립)/lodging(숙박형)/community(휘트니스·주민체육·복지 부속).';

-- 부분 인덱스(비독립형만 색인 → 작고 빠름)
create index if not exists saunas_venue_type_idx
  on public.saunas (venue_type) where venue_type <> 'standalone';

-- 2) 기존 데이터 백필 — 상호/주소 키워드로 분류(lib/ingest/mapToSauna.ts 와 동일 신호)
--    lodging 우선(호텔 부속 피트니스/스파는 숙박형으로 본다).
update public.saunas
   set venue_type = case
     when name ~ '호텔|모텔|리조트|레지던스|게스트|호스텔|콘도|펜션|루프 ?사우나|아늑'
       or coalesce(address, '') ~ '호텔|모텔|리조트|레지던스|게스트|호스텔|콘도|펜션'
       then 'lodging'
     when name ~ '체육센터|주민센터|문화센터|복지관|복지센터|체육관|생활관|휘트니스|피트니스|헬스|버핏그라운드'
       then 'community'
     else 'standalone'
   end
 where venue_type = 'standalone';

-- 3) 거리순 RPC(0007)에 venue_type 추가 — 반환 타입이 바뀌므로 drop 후 재생성.
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
  distance_m       double precision
)
language sql stable as $$
  select s.id, s.license_no, s.name, s.address,
         s.sido, s.sigungu, s.dong,
         s.location::geography, s.status, s.closed_date,
         s.phone, s.open_date, s.created_at,
         s.is_jjimjilbang, s.is_hot_spring, s.is_enzyme, s.venue_type,
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

grant execute on function public.saunas_nearby_v2(double precision, double precision, double precision, integer)
  to anon, authenticated;
