-- ============================================================
-- 사우나우(SAUNAU) — 사진 수집 시도 마커(재검색·과금 방지)
-- PostgreSQL (Supabase). 0007 이후 적용.
-- 적용: Supabase Dashboard > SQL Editor 에 그대로 붙여넣기
-- ============================================================
-- Google 에 없는 매장(매칭 실패)은 thumbnail_url 이 계속 null 이라, 다음 실행 때
-- 또 검색된다(= 무의미한 Google 호출 반복 = 과금 위험). 한번 시도하면 시각을 찍어
-- 다음 실행에서 건너뛴다. 재시도는 --force 또는 이 값 비우기로.
alter table public.saunas
  add column if not exists photo_checked_at timestamptz;

comment on column public.saunas.photo_checked_at is
  'Google 사진 수집 마지막 시도 시각(매칭 실패 포함). 재검색·과금 방지용 스킵 마커.';

create index if not exists saunas_photo_checked_idx
  on public.saunas (id) where photo_checked_at is null;
