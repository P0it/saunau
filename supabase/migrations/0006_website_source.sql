-- ============================================================
-- 사우나우(SAUNAU) — 공식 사이트 출처 추가(사이트 사진 스크랩 + websiteUri 저장)
-- PostgreSQL (Supabase). 0005 이후 적용.
-- 적용: Supabase Dashboard > SQL Editor 에 그대로 붙여넣기
-- ============================================================

-- 1) 공식 사이트 주소(Google Places websiteUri 로 채움). 스크랩 대상·바로가기에 사용.
alter table public.saunas
  add column if not exists website_url text;
comment on column public.saunas.website_url is '공식 웹사이트(Google Places websiteUri). 사이트 사진 스크랩 출처.';

-- 2) sauna_photos.source 에 'website' 추가(업체 공식 사이트 스크랩분).
--    출처표기+takedown(is_active) 전제. 권리 정리되면 owner 로 승격.
alter table public.sauna_photos drop constraint if exists sauna_photos_source_check;
alter table public.sauna_photos
  add constraint sauna_photos_source_check
  check (source in ('naver_crawl','website','owner','editor','google','licensed'));
