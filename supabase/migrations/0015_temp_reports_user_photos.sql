-- ============================================================
-- 0015_temp_reports_user_photos
-- 온도 제보(회원) + 사용자 사진(즉시 게시 + 서버 모더레이션) + 신고
-- "제보 + 자동 집계" 모델: 표시 온도는 최근 30일 제보의 중앙값(median)으로 산출(운영자 비개입).
-- 0014 이후 적용. 적용: Supabase Dashboard > SQL Editor 에 그대로 붙여넣기.
-- ============================================================

-- ============================================================
-- 1) sauna_temp_reports — 온도 제보(회원)
--    visits(익명 device_id) 재사용 대신 신규 테이블: 로그인 책임성 + 깔끔한 RLS/집계.
--    범위 CHECK 가 1차 룰 기반 모더레이션(물리적으로 불가능한 값 자동 거부).
-- ============================================================
create table public.sauna_temp_reports (
  id              uuid primary key default gen_random_uuid(),
  sauna_id        uuid not null references public.saunas(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  gender          text not null check (gender in ('male','female')),
  sauna_room_temp integer check (sauna_room_temp between 40 and 110),
  cold_bath_temp  integer check (cold_bath_temp  between 1  and 25),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  -- 최소 하나는 채워야 의미 있는 제보
  check (sauna_room_temp is not null or cold_bath_temp is not null),
  -- 1인 1제보 / (매장 × 탕): 다시 제보하면 최신값으로 갱신(upsert)
  unique (sauna_id, user_id, gender)
);

comment on table public.sauna_temp_reports is
  '온도 제보(회원). 최근 30일 median 자동 집계로 표시 온도 산출. 운영자 비개입.';

create index sauna_temp_reports_sauna_recent_idx
  on public.sauna_temp_reports (sauna_id, gender, created_at desc);

create trigger sauna_temp_reports_set_updated_at
  before update on public.sauna_temp_reports
  for each row execute function public.set_updated_at();    -- 0001 공용 함수 재사용

-- ---------- RLS: 공개 읽기 + 본인만 쓰기 (0013 패턴) ----------
alter table public.sauna_temp_reports enable row level security;

create policy "temp_reports read" on public.sauna_temp_reports
  for select to anon, authenticated using (true);

create policy "temp_reports insert own" on public.sauna_temp_reports
  for insert to authenticated with check (auth.uid() = user_id);

create policy "temp_reports update own" on public.sauna_temp_reports
  for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "temp_reports delete own" on public.sauna_temp_reports
  for delete to authenticated using (auth.uid() = user_id);

-- ---------- 집계 RPC: 매장별 성별×지표 median(최근 30일) ----------
-- 표시 온도 산출용. report_count 임계치(앱에서 >=2 적용)·신선도(latest)도 함께 내려준다.
create or replace function public.sauna_temp_agg(p_sauna_id uuid)
returns table (
  gender            text,
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
  select g.gender, 'sauna_room'::text as metric,
         percentile_cont(0.5) within group (order by r.sauna_room_temp)
           filter (where r.sauna_room_temp is not null),
         count(r.sauna_room_temp)::int,
         max(r.created_at) filter (where r.sauna_room_temp is not null)
  from (values ('male'),('female')) g(gender)
  left join recent r on r.gender = g.gender
  group by g.gender
  union all
  select g.gender, 'cold_bath'::text,
         percentile_cont(0.5) within group (order by r.cold_bath_temp)
           filter (where r.cold_bath_temp is not null),
         count(r.cold_bath_temp)::int,
         max(r.created_at) filter (where r.cold_bath_temp is not null)
  from (values ('male'),('female')) g(gender)
  left join recent r on r.gender = g.gender
  group by g.gender;
$$;

grant execute on function public.sauna_temp_agg(uuid) to anon, authenticated;

-- ============================================================
-- 2) sauna_photos: 사용자 업로드 지원
--    (a) 'user' 출처 추가  (b) 업로더 식별  (c) 모더레이션 상태
-- ============================================================
alter table public.sauna_photos
  drop constraint if exists sauna_photos_source_check;
alter table public.sauna_photos
  add constraint sauna_photos_source_check
  check (source in ('naver_crawl','website','owner','editor','google','licensed','user'));

alter table public.sauna_photos
  add column if not exists uploaded_by uuid references auth.users(id) on delete set null,
  add column if not exists moderation_status text not null default 'approved'
    check (moderation_status in ('pending','approved','rejected'));

comment on column public.sauna_photos.uploaded_by is
  '사용자 업로드 사진의 업로더(auth.users). 크롤/에디터 사진은 null.';
comment on column public.sauna_photos.moderation_status is
  '커머셜 모더레이션 결과. approved=표시, rejected/pending=숨김. 기존 행은 default approved.';

-- 사용자 사진 활성+승인분만 빠르게 조회
create index if not exists sauna_photos_user_active_idx
  on public.sauna_photos (sauna_id, sort_order)
  where source = 'user' and is_active and moderation_status = 'approved';

-- 읽기 정책 교체: is_active + 모더레이션 승인분만 노출(기존 행은 default approved 라 회귀 없음).
drop policy if exists "sauna_photos read" on public.sauna_photos;
create policy "sauna_photos read" on public.sauna_photos
  for select to anon, authenticated
  using (is_active and moderation_status = 'approved');

-- 본인 업로드(user 출처) 사진은 본인이 삭제 가능(자기 정리).
-- ⚠ insert 정책은 일부러 부여하지 않는다 → 클라 직접 insert 차단,
--    모더레이션 통과 후 service_role 라우트(app/api/photos)만 단일 쓰기 경로.
create policy "sauna_photos delete own user photo" on public.sauna_photos
  for delete to authenticated
  using (source = 'user' and uploaded_by = auth.uid());

-- ============================================================
-- 3) photo_reports — 사진 신고/플래그 (룰 기반 자동 내림)
-- ============================================================
create table public.photo_reports (
  id          uuid primary key default gen_random_uuid(),
  photo_id    uuid not null references public.sauna_photos(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  reason      text check (reason in ('not_sauna','offensive','privacy','spam','other')),
  note        text,
  created_at  timestamptz not null default now(),
  unique (photo_id, user_id)                 -- 1인 1신고/사진
);

comment on table public.photo_reports is
  '사용자 사진 신고. 서로 다른 사용자 신고 임계치(3) 도달 시 트리거로 자동 비활성화.';

create index photo_reports_photo_idx on public.photo_reports (photo_id);

alter table public.photo_reports enable row level security;

create policy "photo_reports insert own" on public.photo_reports
  for insert to authenticated with check (auth.uid() = user_id);
-- read 정책 미부여 → anon-key 로 신고 목록 조회 불가(서버/운영자 전용).

-- 신고 누적 자동 내림: 같은 사진의 (서로 다른 사용자) 신고 수 >= 3 이면 is_active=false.
create or replace function public.handle_photo_report()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  cnt integer;
begin
  select count(*) into cnt from public.photo_reports where photo_id = new.photo_id;
  if cnt >= 3 then
    update public.sauna_photos set is_active = false where id = new.photo_id;
  end if;
  return new;
end
$$;

create trigger photo_reports_autohide
  after insert on public.photo_reports
  for each row execute function public.handle_photo_report();
