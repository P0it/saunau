-- ============================================================
-- 사우나우(SAUNAU) — 요일별 영업시간(구조화) 백필
-- PostgreSQL (Supabase). 0013 이후 적용.
-- 적용: Supabase Dashboard > SQL Editor 에 그대로 붙여넣기
-- ============================================================
-- 네이버 플레이스 /home 의 newBusinessHours 배열(요일별 start/end·브레이크·휴무)을
-- 구조화해 저장한다. hours(text)는 사람이 읽는 요약본으로 함께 유지(기존 UI·JSON-LD 호환).
--
-- hours_json 형태:
--   { "is24h": false,
--     "days": { "mon": {"start":"09:00","end":"21:00","overnight":false,"break":"13:30~15:00","note":null},
--               ... "tue": null /* 휴무 */ ... },
--     "summary": "월 휴무 · 화~일 09:00~21:00" }
--   24시간: { "is24h": true, "days": {...null...}, "summary": "24시간 영업 (연중무휴)" }
--   예약제 등 시간정보 없음: hours_json = null (휴무로 오인 금지)

alter table public.saunas
  add column if not exists hours_json jsonb;
comment on column public.saunas.hours_json is
  '요일별 영업시간(네이버 newBusinessHours 구조화). days.mon~sun, is24h, summary. 시간정보 없으면 null.';

-- 요일별 수집 마지막 시도 시각(매칭/미보유 포함). 재조회·재실행 스킵 마커.
alter table public.saunas
  add column if not exists hours_synced_at timestamptz;
comment on column public.saunas.hours_synced_at is
  '요일별 영업시간(crawl:naver-hours) 마지막 시도 시각. 재시도는 --force.';

-- placeId 있고 아직 요일별 미수집인 행만 빠르게 고르는 부분 인덱스.
create index if not exists saunas_hours_synced_idx
  on public.saunas (id)
  where hours_synced_at is null and naver_place_id is not null;
