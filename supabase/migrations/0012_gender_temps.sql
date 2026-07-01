-- ============================================================
-- 사우나우(SAUNAU) — 탕별(남/여) 온도 분리
-- PostgreSQL (Supabase). 0011 이후 적용.
-- 적용: Supabase Dashboard > SQL Editor 에 그대로 붙여넣기
-- ============================================================
--
-- 기존 sauna_room_temp / cold_bath_temp 는 "대표(공통) 온도"로 유지한다.
-- 남탕·여탕은 같은 업소라도 사우나실/냉탕 온도가 다른 경우가 많아 성별 컬럼을 추가한다.
-- 표시 폴백 순서: 성별 실측값 → 공통값(sauna_room_temp/cold_bath_temp) → UI 기본값(90/20).
-- 방문 제보(visits.reported_*)가 쌓이면 성별 컬럼을 보정하는 용도.

alter table public.saunas
  add column if not exists sauna_room_temp_m integer,  -- 남탕 사우나실
  add column if not exists sauna_room_temp_f integer,  -- 여탕 사우나실
  add column if not exists cold_bath_temp_m  integer,  -- 남탕 냉탕
  add column if not exists cold_bath_temp_f  integer;  -- 여탕 냉탕

comment on column public.saunas.sauna_room_temp_m is '남탕 사우나실 온도(℃). null=미확인, 표시 시 공통값으로 폴백.';
comment on column public.saunas.sauna_room_temp_f is '여탕 사우나실 온도(℃). null=미확인, 표시 시 공통값으로 폴백.';
comment on column public.saunas.cold_bath_temp_m is '남탕 냉탕 온도(℃). null=미확인, 표시 시 공통값으로 폴백.';
comment on column public.saunas.cold_bath_temp_f is '여탕 냉탕 온도(℃). null=미확인, 표시 시 공통값으로 폴백.';

-- 방문 제보에도 성별 축을 더한다(어느 탕에서 잰 값인지 구분).
alter table public.visits
  add column if not exists reported_gender text;

alter table public.visits
  drop constraint if exists visits_reported_gender_chk;
alter table public.visits
  add constraint visits_reported_gender_chk
  check (reported_gender is null or reported_gender in ('male', 'female'));

comment on column public.visits.reported_gender is '제보 온도를 측정한 탕(male=남탕/female=여탕). null=미상.';
