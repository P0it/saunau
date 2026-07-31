-- ============================================================
-- 0027_temp_reports_unify_gender
-- 온도 제보를 남/여 구분 없이 하나로 받는다.
--
-- 배경: 상세 히어로의 남탕/여탕 토글은 어느 매장에서도 값이 갈리지 않았고
--       (성별 온도 컬럼 0건 / 제보 0건), 축을 둘로 쪼개면 표시 임계치
--       (제보 2건 × 성별 × 지표)를 넘기기가 두 배로 어려워 콜드스타트를 막고 있었다.
--       → 표시·수집 모두 단일 축으로 통합.
--
-- gender 컬럼은 drop 하지 않고 nullable 로 남긴다(향후 성별 분리를 되살릴 여지).
-- saunas 의 sauna_room_temp_m/_f, cold_bath_temp_m/_f (0012) 도 그대로 둔다 — 전부 null.
--
-- 적용 시점 기준 sauna_temp_reports 0건이라 데이터 마이그레이션 없음.
-- 적용: Supabase Dashboard > SQL Editor 에 그대로 붙여넣기.
-- ============================================================

-- ---------- 1) gender: not null + check 해제(값 자체는 보존 가능) ----------
alter table public.sauna_temp_reports
  alter column gender drop not null;

comment on column public.sauna_temp_reports.gender is
  '탕 구분(male/female). 0027 이후 수집하지 않아 신규 행은 null. 성별 분리 복원 시 재사용.';

-- ---------- 2) 1인 1제보 단위: (매장 × 탕) → (매장) ----------
-- gender 가 null 이면 unique(…, gender) 가 사실상 무력화되므로 반드시 교체해야 한다.
alter table public.sauna_temp_reports
  drop constraint if exists sauna_temp_reports_sauna_id_user_id_gender_key;

alter table public.sauna_temp_reports
  add constraint sauna_temp_reports_sauna_id_user_id_key
  unique (sauna_id, user_id);

-- ---------- 3) 집계 인덱스에서 gender 축 제거 ----------
drop index if exists public.sauna_temp_reports_sauna_recent_idx;
create index sauna_temp_reports_sauna_recent_idx
  on public.sauna_temp_reports (sauna_id, created_at desc);

-- ---------- 4) 집계 RPC: gender 축 제거, metric 축만 ----------
-- 반환 컬럼이 바뀌므로 drop 후 재생성(create or replace 불가).
drop function if exists public.sauna_temp_agg(uuid);

create function public.sauna_temp_agg(p_sauna_id uuid)
returns table (
  metric            text,        -- 'sauna_room' | 'cold_bath'
  crowd_median      numeric,
  report_count      integer,
  latest_report_at  timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  with recent as (
    select * from public.sauna_temp_reports
    where sauna_id = p_sauna_id
      and created_at >= now() - interval '30 days'
  )
  -- 제보가 0건이어도 두 지표 행은 항상 내려간다(앱의 맵 조회가 undefined 를 안 만나도록).
  select m.metric,
         (select percentile_cont(0.5) within group (order by r.sauna_room_temp)
            from recent r where r.sauna_room_temp is not null),
         (select count(r.sauna_room_temp)::int from recent r),
         (select max(r.created_at) from recent r where r.sauna_room_temp is not null)
  from (values ('sauna_room')) m(metric)
  union all
  select m.metric,
         (select percentile_cont(0.5) within group (order by r.cold_bath_temp)
            from recent r where r.cold_bath_temp is not null),
         (select count(r.cold_bath_temp)::int from recent r),
         (select max(r.created_at) from recent r where r.cold_bath_temp is not null)
  from (values ('cold_bath')) m(metric);
$$;

grant execute on function public.sauna_temp_agg(uuid) to anon, authenticated;
