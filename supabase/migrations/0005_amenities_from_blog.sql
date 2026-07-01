-- ============================================================
-- 사우나우(SAUNAU) — 블로그에서 확인되는 편의시설 사실을 구조화 필드로
-- PostgreSQL (Supabase). 0003(0004) 이후 적용.
-- 적용: Supabase Dashboard > SQL Editor 에 그대로 붙여넣기
-- ============================================================
-- 소개(ai_description)는 "분위기/시설 설명"만 담고, 주차·수질 같은 하드 팩트는
-- 검색·필터·뱃지에 쓸 수 있게 별도 컬럼으로 뽑는다. (블로그 발췌 기반 = best-effort)
-- price/hours 는 기존 컬럼 재사용(describe 스크립트가 "비어있을 때만" 채운다).
alter table public.saunas
  add column if not exists has_parking  boolean,   -- null=모름, true/false=블로그로 확인
  add column if not exists parking_note text,       -- 예: "3시간 무료, 이후 20분당 1,000원"
  add column if not exists water_note   text;       -- 예: "400m 천연암반수"

comment on column public.saunas.has_parking is
  '주차 가능 여부(블로그 발췌 기반 best-effort). null=확인 안 됨.';
comment on column public.saunas.parking_note is '주차 조건 한 줄(블로그 발췌 기반).';
comment on column public.saunas.water_note is '수질 특징 한 줄(예: 천연암반수). 블로그 발췌 기반.';
