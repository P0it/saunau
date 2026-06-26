-- ============================================================
-- 사우나우(SAUNAU) MVP 초기 스키마
-- PostgreSQL + PostGIS (Supabase)
-- 적용: Supabase Dashboard > SQL Editor 에 그대로 붙여넣기
-- ============================================================

-- ---------- Extensions ----------
create extension if not exists postgis;        -- geography / 거리 쿼리
-- gen_random_uuid() 는 Supabase에 기본 내장(pgcrypto)

-- ============================================================
-- 1) saunas  — 핵심 엔티티
-- ============================================================
create table public.saunas (
  id               uuid primary key default gen_random_uuid(),
  license_no       text unique,                       -- 인허가번호: 동기화 upsert 키
  name             text not null,                     -- 상호명
  address          text,                              -- 소재지
  sido             text,                              -- 시/도   (필터·SEO 분해)
  sigungu          text,                              -- 시/군/구
  dong             text,                              -- 동
  location         geography(Point, 4326),            -- WGS84 좌표 (5174 → 4326 재투영 후 적재)
  status           text,                              -- 영업상태(영업/정상만 노출, 폐업 전환 시 갱신)
  closed_date      date,                              -- 폐업일자(동기화가 폐업 감지 시 마킹, 영업이면 null)
  phone            text,
  open_date        date,                              -- 개업일자(새로 오픈 정렬)
  created_at       timestamptz not null default now(),-- 시스템 등록일
  updated_at       timestamptz not null default now(),-- 동기화 갱신 추적(아래 트리거)

  -- 분류 플래그 (모든 행 기본 = 사우나·대중탕, 아래는 추가 플래그·복수 가능)
  is_jjimjilbang   boolean not null default false,    -- 찜질방/불가마/한증막/스파
  is_hot_spring    boolean not null default false,    -- 온천(키워드 또는 온천표준데이터 근접)
  verified_hot_spring boolean not null default false, -- 「온천법」 등록 온천 500m 인근(진짜 온천 인증)
  is_24h           boolean not null default false,    -- 24시/연중무휴
  has_outdoor      boolean not null default false,    -- 노천 (에디터 시딩)
  needs_review     boolean not null default false,    -- 강한 탕 라이선스+피트니스名 → 노출 보류, 에디터 검수

  -- 시그니처 / 에디터 시딩 (공공데이터에 없음)
  sauna_room_temp  integer,                           -- 사우나실 온도
  cold_bath_temp   integer,                           -- 냉탕 온도
  has_sesin        boolean not null default false,    -- 세신
  sauna_kind       text[],                            -- 습식/건식/한증막 등
  price            integer,                           -- 입욕료
  hours            text,                              -- 영업시간 텍스트
  thumbnail_url    text,                              -- 대표 사진
  editor_note      text,                              -- 에디터 한 줄/소개
  slug             text unique                        -- SEO URL용
);

comment on table public.saunas is '사우나·대중탕·온천·찜질방 핵심 엔티티';
comment on column public.saunas.location is 'WGS84(EPSG:4326). LOCALDATA TM(5174) 재투영 후 적재';

-- 인덱스
create index saunas_location_gix on public.saunas using gist (location);          -- 반경/거리 쿼리(ST_DWithin)
create index saunas_sido_sigungu_idx on public.saunas (sido, sigungu);            -- 지역 필터·인덱스 페이지
create index saunas_open_date_idx on public.saunas (open_date desc nulls last);   -- 새로 오픈
create index saunas_sauna_room_temp_idx on public.saunas (sauna_room_temp);       -- 온도 필터(고온 파생)
-- 카테고리 부분 인덱스(true 행만 색인 → 작고 빠름)
create index saunas_jjimjilbang_idx on public.saunas (id) where is_jjimjilbang;
create index saunas_hot_spring_idx  on public.saunas (id) where is_hot_spring;
create index saunas_verified_hot_spring_idx on public.saunas (id) where verified_hot_spring;

-- updated_at 자동 갱신
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger saunas_set_updated_at
  before update on public.saunas
  for each row execute function public.set_updated_at();

-- ============================================================
-- 2) visits  — 다녀옴(3초 체크인, 무로그인 device_id)
-- ============================================================
create table public.visits (
  id                  uuid primary key default gen_random_uuid(),
  sauna_id            uuid not null references public.saunas(id) on delete cascade,
  device_id           text not null,                  -- 익명 디바이스 식별
  satisfaction        text check (satisfaction in ('개운해요','평범해요','아쉬워요')),
  tags                text[],                         -- 객관식 키워드
  reported_sauna_temp integer,                        -- 온도 제보(선택)
  reported_cold_temp  integer,
  created_at          timestamptz not null default now()
);

comment on table public.visits is '다녀옴 체크인: 방문수·태그 누적·온도 관측';

create index visits_sauna_id_idx on public.visits (sauna_id);
create index visits_device_id_idx on public.visits (device_id);
-- 어뷰징 가드(P1)용: 동일 device·sauna 단시간 중복 조회
create index visits_sauna_device_created_idx on public.visits (sauna_id, device_id, created_at desc);

-- ============================================================
-- 3) collections  — 큐레이션 레일
-- ============================================================
create table public.collections (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  description  text,
  slug         text unique,
  sort         integer not null default 0,
  is_published boolean not null default false,
  created_at   timestamptz not null default now()
);

create table public.collection_saunas (
  collection_id uuid not null references public.collections(id) on delete cascade,
  sauna_id      uuid not null references public.saunas(id) on delete cascade,
  sort          integer not null default 0,
  primary key (collection_id, sauna_id)
);

create index collection_saunas_collection_idx on public.collection_saunas (collection_id, sort);
create index collections_published_sort_idx on public.collections (sort) where is_published;

-- ============================================================
-- 4) articles  — 읽을거리/매거진 (SEO 대상)
-- ============================================================
create table public.articles (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  summary       text,
  body          text,                                 -- markdown
  thumbnail_url text,
  category      text check (category in ('효능','소식','가이드')),
  slug          text unique,
  published_at  timestamptz,
  is_published  boolean not null default false,
  created_at    timestamptz not null default now()
);

create index articles_published_idx on public.articles (published_at desc) where is_published;

-- ============================================================
-- 5) RLS  — 공개 읽기 + visits 익명 쓰기
--    (적재/큐레이션/매거진 쓰기는 service_role 키가 RLS 우회)
-- ============================================================
alter table public.saunas             enable row level security;
alter table public.visits             enable row level security;
alter table public.collections        enable row level security;
alter table public.collection_saunas  enable row level security;
alter table public.articles           enable row level security;

-- saunas: 누구나 읽기 (상태 필터는 앱 쿼리에서)
create policy "saunas read" on public.saunas
  for select to anon, authenticated using (true);

-- visits: 누구나 읽기 + 누구나 작성(무로그인 체크인)
create policy "visits read" on public.visits
  for select to anon, authenticated using (true);
create policy "visits insert" on public.visits
  for insert to anon, authenticated with check (true);

-- collections: 발행분만 읽기
create policy "collections read" on public.collections
  for select to anon, authenticated using (is_published);
create policy "collection_saunas read" on public.collection_saunas
  for select to anon, authenticated using (true);

-- articles: 발행분만 읽기
create policy "articles read" on public.articles
  for select to anon, authenticated using (is_published);

-- ============================================================
-- 6) 거리순 조회 RPC  — Geolocation 기반 탐색(8.1)
--    클라에서 supabase.rpc('saunas_nearby', {...})
-- ============================================================
create or replace function public.saunas_nearby(
  lng           double precision,
  lat           double precision,
  radius_m      double precision default 5000,
  max_results   integer default 50
)
returns table (
  id              uuid,
  name            text,
  address         text,
  sauna_room_temp integer,
  cold_bath_temp  integer,
  thumbnail_url   text,
  slug            text,
  distance_m      double precision
)
language sql stable as $$
  select s.id, s.name, s.address,
         s.sauna_room_temp, s.cold_bath_temp,
         s.thumbnail_url, s.slug,
         st_distance(s.location, st_makepoint(lng, lat)::geography) as distance_m
  from public.saunas s
  where s.location is not null
    and s.status = '영업/정상'        -- 폐업·휴업 제외
    and not s.needs_review            -- 검수 보류(피트니스名) 제외
    and st_dwithin(s.location, st_makepoint(lng, lat)::geography, radius_m)
  order by s.location <-> st_makepoint(lng, lat)::geography
  limit max_results;
$$;

-- ============================================================
-- 7) hot_springs  — 전국온천표준데이터(「온천법」 등록 온천)
--    영업장이 아닌 온천 지구/원천. saunas 교차링크 + 마니아 정보(성분/수온) 소스.
--    ⚠ source_temp 는 원천 수온(욕탕 온도 아님). 위경도는 이미 WGS84.
-- ============================================================
create table public.hot_springs (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,                     -- 온천명(htspNm)
  sido            text,                              -- 시도(ctpvNm)
  sigungu         text,                              -- 시군구(sggNm)
  address         text,                              -- 도로명 우선
  location        geography(Point, 4326),            -- 위경도 직접(lat/lot)
  source_temp     numeric,                           -- 원천 수온 ℃(htspTp) — 욕탕 온도 아님
  spring_quality  text,                              -- 온천천질(htspQlty)
  composition     text,                              -- 온천성분명(htspIgrdNm)
  well_count      integer,                           -- 온천공수(htwlCnt)
  depth           numeric,                           -- 심도(dpth)
  designated_year integer,                           -- 지정연도(dsgnYr)
  manager_org     text,                              -- 관리기관명(mngInstNm)
  manager_tel     text,                              -- 관리기관전화(mngInstTelno)
  data_base_date  date,                              -- 데이터기준일자(dataCrtrYmd)
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (name, sigungu)                             -- 소스에 안정 ID 없음 → 자연키 upsert
);

comment on table public.hot_springs is '「온천법」 등록 온천(전국온천표준데이터). saunas 교차링크·마니아 정보 소스';
comment on column public.hot_springs.source_temp is '원천 수온(℃). 욕탕/사우나 온도 아님';

create index hot_springs_location_gix on public.hot_springs using gist (location);

create trigger hot_springs_set_updated_at
  before update on public.hot_springs
  for each row execute function public.set_updated_at();

alter table public.hot_springs enable row level security;
create policy "hot_springs read" on public.hot_springs
  for select to anon, authenticated using (true);

-- 교차링크: 등록 온천 500m 인근 영업장에 진짜 온천 인증 덧칠(키워드 위 보강).
-- 적재/동기화 후 service_role 로 호출. 갱신된 행 수 반환(idempotent).
create or replace function public.link_verified_hot_springs(radius_m double precision default 500)
returns integer
language plpgsql security definer as $$
declare
  affected integer;
begin
  with near as (
    select distinct s.id
    from public.saunas s
    join public.hot_springs h
      on st_dwithin(s.location, h.location, radius_m)
    where s.location is not null
  )
  update public.saunas s
     set is_hot_spring = true,
         verified_hot_spring = true
    from near
   where s.id = near.id
     and (s.verified_hot_spring is distinct from true
          or s.is_hot_spring is distinct from true);
  get diagnostics affected = row_count;
  return affected;
end $$;
