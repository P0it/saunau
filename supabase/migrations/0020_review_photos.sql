-- ============================================================
-- 0020_review_photos — 후기 첨부 사진
-- 방문자 후기(sauna_reviews)에 사진을 붙일 수 있게 sauna_photos 를 재사용한다.
--   · review_id 가 있는 사진 = "후기 전용" → 매장 갤러리에는 노출하지 않고 후기 카드에만 보인다.
--   · review_id 가 null 인 사진 = 기존 매장 갤러리 사진(회귀 없음).
-- 모더레이션·스토리지·신고·삭제 정책(0015)은 그대로 재사용(source='user').
-- 0015 이후 적용. 적용: Supabase Dashboard > SQL Editor 에 그대로 붙여넣기.
-- ============================================================

alter table public.sauna_photos
  add column if not exists review_id uuid
    references public.sauna_reviews(id) on delete cascade;

comment on column public.sauna_photos.review_id is
  '후기 첨부 사진이면 대상 후기(sauna_reviews). null 이면 매장 갤러리 사진. 후기 삭제 시 함께 정리(cascade).';

-- 후기별 사진 조회(활성+승인분, 후기 최신 렌더용)
create index if not exists sauna_photos_review_idx
  on public.sauna_photos (review_id)
  where review_id is not null and is_active and moderation_status = 'approved';

-- 매장 갤러리(사용자 사진) 부분 인덱스도 후기 사진을 배제하도록 재정의.
drop index if exists public.sauna_photos_user_active_idx;
create index if not exists sauna_photos_user_active_idx
  on public.sauna_photos (sauna_id, sort_order)
  where source = 'user' and review_id is null
    and is_active and moderation_status = 'approved';
