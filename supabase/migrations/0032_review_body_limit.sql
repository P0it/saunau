-- ============================================================
-- 0032_review_body_limit — 후기 본문 길이 상한 + 후기 첨부 사진 종료
--
-- 1) sauna_reviews.body 는 제약 없는 text 였다. 클라 textarea 에도 maxLength 가
--    없어서, anon 키로 PostgREST 를 직접 호출하면 수 MB 본문도 들어갔다.
--    한줄평이라는 성격에 맞춰 500자로 자른다(lib/reviews.ts REVIEW_BODY_MAX 와 동일 값).
--
-- 2) 후기 첨부 사진 기능을 없앤다 — 사우나와 무관한 사진이 섞이는 오염 때문에
--    매장 사진은 운영자(source='editor')만 등록한다. review_id 컬럼은 남기되
--    새 행이 붙지 못하게 막는다(과거 행 보존 + 되살릴 때 스키마 변경 불필요).
--
-- 적용: Supabase Dashboard > SQL Editor 에 그대로 붙여넣기
-- ============================================================

-- 1) 본문 길이 상한 --------------------------------------------------
-- 기존 행에 초과분이 있으면 제약 추가가 실패한다 → 먼저 잘라낸다.
update public.sauna_reviews
   set body = left(body, 500)
 where body is not null and length(body) > 500;

alter table public.sauna_reviews
  drop constraint if exists sauna_reviews_body_len;

alter table public.sauna_reviews
  add constraint sauna_reviews_body_len
  check (body is null or length(body) <= 500);

comment on constraint sauna_reviews_body_len on public.sauna_reviews is
  '한줄평 500자 상한. lib/reviews.ts 의 REVIEW_BODY_MAX 와 같은 값이어야 한다';

-- 2) 후기 첨부 사진 종료 ----------------------------------------------
-- 남아 있던 후기 사진은 갤러리에도 안 뜨고 후기 카드도 더는 렌더하지 않는다 → 비활성화.
update public.sauna_photos
   set is_active = false
 where review_id is not null and is_active;

-- 앞으로 review_id 가 채워진 행은 만들 수 없다(service_role 도 막힌다 — 의도된 것).
alter table public.sauna_photos
  drop constraint if exists sauna_photos_no_review_attach;

alter table public.sauna_photos
  add constraint sauna_photos_no_review_attach
  check (review_id is null) not valid;   -- not valid: 과거 행은 그대로 두고 신규만 검사

comment on constraint sauna_photos_no_review_attach on public.sauna_photos is
  '후기 첨부 사진 기능 종료(0032). 되살리려면 이 제약을 drop 하고 /api/photos 의 review_id 경로를 복원';
