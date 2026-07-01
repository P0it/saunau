-- ============================================================
-- 사우나우(SAUNAU) — 커뮤니티(체육·복지시설) 분류 신호 보강 백필
-- PostgreSQL (Supabase). 0023 이후 적용.
-- 적용: Supabase Dashboard > SQL Editor 에 그대로 붙여넣기
-- ============================================================
--
-- 배경: venue_type='community'(라벨 "체육·복지시설")는 상호 키워드로만 잡는데,
--   "스포츠센터 / 체력단련장 / 청소년수련관 / 레포츠센터" 처럼 기존 정규식
--   (체육센터·체육관 등)에서 새던 케이스가 있어 재현율이 낮았다.
-- lib/ingest/mapToSauna.ts 의 COMMUNITY_RE 에 위 키워드를 추가했고,
-- 이미 적재된 데이터도 동일 신호로 재분류한다.
--
-- 안전장치: venue_type='standalone' 인 행만 대상으로 한다.
--   → lodging(숙박형 우선 규칙)·수동 편집분을 덮어쓰지 않는다.
--   → classifyVenue()의 "lodging 우선" 순서와 결과가 일치.

update public.saunas
   set venue_type = 'community'
 where venue_type = 'standalone'
   and name ~ '스포츠센터|체력단련|청소년수련|레포츠';
