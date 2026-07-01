-- ============================================================
-- 사우나우(SAUNAU) — 네이버 상세 데이터 확장(편의시설·요금표)
-- PostgreSQL (Supabase). 0016 이후 적용.
-- 적용: Supabase Dashboard > SQL Editor 에 그대로 붙여넣기
-- ============================================================
-- 네이버 플레이스 /home 한 번에 영업시간(0014)·편의시설·요금표가 다 들어온다.
-- crawl:naver-hours 가 hours_json 과 함께 아래 컬럼도 채운다(있으면 넣고, 없으면 비움).

-- 1) 편의시설 — 네이버 conveniences 원문 배열(예: ["주차","무선 인터넷","남/녀 화장실 구분"]).
alter table public.saunas
  add column if not exists amenities text[];
comment on column public.saunas.amenities is
  '네이버 편의시설(conveniences) 원문 배열. 주차여부(has_parking)는 여기서 파생.';

-- 2) 요금표 — 네이버 Menu 노드 [{name, price|null, priceText|null}]. 대표 입장료는 price(int) 컬럼.
alter table public.saunas
  add column if not exists price_list jsonb;
comment on column public.saunas.price_list is
  '네이버 요금표(Menu): [{name, price, priceText}]. 가격 탭 미작성이면 빈 배열/NULL. 대표가는 price.';
