-- ============================================================
-- 사우나우(SAUNAU) — 네이버 플레이스 "기본정보" 백필 (영업시간·전화·편의시설)
-- PostgreSQL (Supabase). 0008 이후 적용.
-- 적용: Supabase Dashboard > SQL Editor 에 그대로 붙여넣기
-- ============================================================
-- 사진(저작물)과 달리 영업시간/전화/주차여부/좌표는 **사실 정보**라 별도 경로로 수집한다.
-- pcmap.place.naver.com SSR 에서 읽으며, placeId 를 저장해 재조회·재실행 스킵에 쓴다.
-- 채우는 컬럼(영업시간·전화·is_24h·has_parking)은 기존 컬럼 재사용 — "비어있을 때만" 채운다.

-- 1) 매칭된 네이버 placeId — 재사용/디버깅/재실행 스킵 마커.
alter table public.saunas
  add column if not exists naver_place_id text;
comment on column public.saunas.naver_place_id is
  '매칭된 네이버 플레이스 id(pcmap). 영업시간/전화 백필 출처. 재조회 방지용.';

-- 2) 네이버 기본정보 마지막 시도 시각 — 매칭 실패해도 찍어 재조회 과부하 방지.
--    (placeId 가 null 이어도 synced_at 이 있으면 "시도했으나 매칭 실패"로 스킵.)
alter table public.saunas
  add column if not exists naver_synced_at timestamptz;
comment on column public.saunas.naver_synced_at is
  '네이버 기본정보 수집 마지막 시도 시각(매칭 실패 포함). 재시도는 --force.';

-- 미수집분만 빠르게 고르는 부분 인덱스(스킵 마커 없는 행).
create index if not exists saunas_naver_synced_idx
  on public.saunas (id) where naver_synced_at is null;
