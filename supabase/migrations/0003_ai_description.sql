-- ============================================================
-- 사우나우(SAUNAU) — 매장 AI 소개(블로그 발췌+공공데이터 기반, 출처 구분)
-- PostgreSQL (Supabase). 0002 이후 적용.
-- 적용: Supabase Dashboard > SQL Editor 에 그대로 붙여넣기
-- ============================================================
-- editor_note(0001)는 사람(에디터)이 직접 쓴 소개. 그것과 출처를 분리하기 위해
-- AI 생성 소개는 별도 컬럼에 둔다. 상세페이지는 editor_note 우선, 없으면 ai_description.
alter table public.saunas
  add column if not exists ai_description    text,
  add column if not exists ai_description_at timestamptz;

comment on column public.saunas.ai_description is
  'AI가 공공데이터+블로그 발췌의 사실만 뽑아 새로 쓴 매장 소개. 블로그 원문 복제 아님. 화면에 "AI 정리" 라벨과 함께 노출.';
comment on column public.saunas.ai_description_at is
  'ai_description 생성 시각. 재생성/신선도 판단용.';
