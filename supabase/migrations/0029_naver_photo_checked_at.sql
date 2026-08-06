-- ============================================================
-- 사우나우(SAUNAU) — 네이버 업체사진 확인 마커
-- PostgreSQL (Supabase). 0028 이후 적용.
-- 적용: Supabase Dashboard > SQL Editor 에 그대로 붙여넣기
-- ============================================================
--
-- 배경: crawl:naver-photos 는 "네이버 사진이 이미 있는 매장"만 건너뛴다. 그래서
--   **확인은 했는데 업체사진이 0장이던 매장**을 실행할 때마다 다시 조회한다.
--   실측(2026-08-06): 남은 대상 2,030곳을 돌렸더니 검증 통과 113곳이 전부 사진 0장 —
--   앞선 실행들이 이미 훑어 수확을 끝낸 구간을 되풀이하고 있었다. 진전이 없을 뿐 아니라
--   네이버에 불필요한 요청을 보내 결국 연속 차단(8회)을 맞았다.
--
-- 해결: 사진 유무와 무관하게 "이 매장은 확인했다"를 기록한다.
--   구글 크롤의 photo_checked_at 과 **섞지 않는다** — 그쪽은 Google Places 시도 마커이고
--   crawl:google 이 되살아나면 의미가 충돌한다.

alter table public.saunas
  add column if not exists naver_photo_checked_at timestamptz;

comment on column public.saunas.naver_photo_checked_at is
  '네이버 업체사진 확인 시각(사진이 0장이어도 기록). crawl:naver-photos 재조회 방지용.';

-- 이미 네이버 사진을 받은 매장은 확인 완료가 자명하다 → 마커를 채워둔다.
-- (사진이 0장이던 매장은 기록이 남아있지 않아 백필할 수 없다. 다음 실행에서 채워진다.)
update public.saunas s
   set naver_photo_checked_at = now()
 where naver_photo_checked_at is null
   and exists (
     select 1 from public.sauna_photos p
      where p.sauna_id = s.id and p.source = 'naver_crawl'
   );
