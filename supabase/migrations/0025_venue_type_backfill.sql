-- ============================================================
-- 사우나우(SAUNAU) — 장소 유형(venue_type) 초기 백필 (누락분 보정)
-- PostgreSQL (Supabase). 0024 이후 적용.
-- 적용: Supabase Dashboard > SQL Editor 에 그대로 붙여넣기
-- ============================================================
--
-- 배경: 0010(venue_type 도입)의 "step 2 백필"이 운영 DB에 적용되지 않아
--   기존 행이 전부 기본값 'standalone' 으로 남아 있었다.
--   → 필터의 "호텔·숙소(lodging)" / "체육·복지시설(community)" 칩이 무매치.
--   0024 는 community 키워드 4종(스포츠센터·체력단련·청소년수련·레포츠)만 보강한다.
--
-- 이 파일은 0010 step 2 의 UPDATE 만 재적용한다(RPC 재정의는 하지 않음 —
--   0016/0019/0021 이 확장한 saunas_nearby_v2 를 덮어쓰지 않도록).
-- 분류 신호는 lib/ingest/mapToSauna.ts 의 classifyVenue() 와 동일하게 유지.
--
-- 멱등: venue_type='standalone' 인 행만 대상 → 재실행/기존 lodging·community 안전.

update public.saunas
   set venue_type = case
     when name ~ '호텔|모텔|리조트|레지던스|게스트|호스텔|콘도|펜션|루프 ?사우나|아늑'
       or coalesce(address, '') ~ '호텔|모텔|리조트|레지던스|게스트|호스텔|콘도|펜션'
       then 'lodging'
     when name ~ '체육센터|주민센터|문화센터|복지관|복지센터|체육관|생활관|휘트니스|피트니스|헬스|버핏그라운드|스포츠센터|체력단련|청소년수련|레포츠'
       then 'community'
     else 'standalone'
   end
 where venue_type = 'standalone';
