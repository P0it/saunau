-- ============================================================
-- 사우나우(SAUNAU) — 효소 분류에 '발효' 상호 포함 (백필)
-- PostgreSQL (Supabase). 0017 이후 적용.
-- 적용: Supabase Dashboard > SQL Editor 에 그대로 붙여넣기
-- ============================================================
-- mapToSauna.ts 의 ENZYME_RE 를 /효소|발효/ 로 확장한 것과 일치시킨다.
-- (0004 는 '효소'만 백필했으므로 '발효' 상호를 추가로 효소찜질로 표시.)
-- 네이버 수집(crawl:naver-enzyme)이 브랜드까지 채우지만, 목욕장업에 이미
-- 들어온 '발효' 상호는 즉시 분류해 둔다.
update public.saunas
   set is_enzyme = true
 where name ilike '%발효%'
   and is_enzyme = false;
