-- ============================================================
-- 사우나우(SAUNAU) — 효소(발효) 찜질방 별도 카테고리 + 점핑 스튜디오 제외
-- PostgreSQL (Supabase). 0003 이후 적용.
-- 적용: Supabase Dashboard > SQL Editor 에 그대로 붙여넣기
-- ============================================================

-- 1) 효소찜질방 카테고리 플래그
--    효소(발효) 찜질방은 일반 찜질방과 운영·체험이 달라 별도 카테고리로 노출한다.
alter table public.saunas
  add column if not exists is_enzyme boolean not null default false;

comment on column public.saunas.is_enzyme is
  '효소(발효) 찜질방. 일반 찜질방과 별도 카테고리로 노출(primaryCategory 최우선).';

-- 부분 인덱스(true 행만 색인 → 작고 빠름)
create index if not exists saunas_enzyme_idx on public.saunas (id) where is_enzyme;

-- 2) 기존 데이터 백필 — 상호에 '효소' 포함 → 효소찜질방
update public.saunas
   set is_enzyme = true
 where name ilike '%효소%'
   and is_enzyme = false;

-- 3) 점핑/트램폴린 스튜디오 제외(노출 보류)
--    "온열찜질"·"찜질"을 상호에 붙여도 진짜 찜질방이 아니다(욕탕 없음).
--    데이터는 보존하되 발견(목록/지도/홈)에서 빼기 위해 needs_review=true 로 보류하고,
--    찜질방으로 잘못 분류된 플래그를 해제한다. (이후 신규 동기화는 적재 단계에서 제외)
update public.saunas
   set needs_review   = true,
       is_jjimjilbang = false
 where (name ilike '%점핑%' or name ilike '%트램폴린%');
