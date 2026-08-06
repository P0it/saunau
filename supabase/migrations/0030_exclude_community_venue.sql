-- ============================================================
-- 사우나우(SAUNAU) — 체육·복지시설(venue_type='community') 노출 제외
-- PostgreSQL (Supabase). 0029 이후 적용.
-- 적용: Supabase Dashboard > SQL Editor 에 그대로 붙여넣기
-- ============================================================
--
-- 배경: community(헬스장 샤워실·시민체육센터·복지관 부속 목욕탕)가 목욕탕/찜질방
--   목록·지도에 섞여 "헬스장이 왜 뜨냐"는 신뢰도 문제가 됐다. 라이선스상으로는
--   목욕장업이 맞지만, 서비스가 다루는 '가서 씻고 쉬는 목욕탕'과 성격이 다르다.
--
-- 결정: 카테고리째 발견(홈·목록·지도·검색·주변)에서 제외. 데이터는 지우지 않고
--   needs_review=true 로 보류만 한다 — 모든 조회 경로(queries.ts, saunas_nearby_v2,
--   크롤 대상 선정)가 이미 `not needs_review` 를 공통으로 건다.
--   0004(효소찜질 보류)와 같은 방식.
--
-- 되돌리려면: update public.saunas set needs_review = false
--               where venue_type = 'community' and status = '영업/정상';
--   (단 lib/ingest/mapToSauna.ts 의 needs_review 규칙도 함께 되돌려야 한다.)

update public.saunas
   set needs_review = true
 where venue_type = 'community'
   and needs_review = false;
