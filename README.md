# 사우나우 (SAUNAU)

전국의 목욕탕·찜질방·온천·사우나를 **사우나실/냉탕 온도까지** 구조화해 보여주는 디스커버리 웹앱.

> 네이버 지도에는 "사우나실이 몇 도인지", "세신이 되는지", "노천이 있는지"가 없다.
> 공공데이터(목욕장업 인허가)로 전국 커버리지를 깔고, 그 위에 마니아가 실제로 궁금해하는
> 축(온도·세신·24시·노천·가격)을 얹어 탐색 가능하게 만든 서비스.

**배포**: https://saunau.vercel.app · **기획**: [`사우나우_PRD_MVP.md`](./사우나우_PRD_MVP.md)

모바일 웹앱. 데스크톱에서는 화면 중앙에 430px 프레임으로 고정되고, 지도(`/map`)만 풀블리드로 열린다.

---

## 화면

| 경로 | 화면 |
|------|------|
| `/` | 홈 — 카테고리·테마 큐레이션, 새로 오픈, 읽을거리 |
| `/list` | 목록 — 유형 세그먼트 + 필터 시트(온도 범위·세신·24시·장소유형), 거리/온도/추천 정렬 |
| `/map` | 네이버 지도 — 상단 빠른필터 칩, 마커, 이 지역 재검색, 좌측 패널(데스크톱)/바텀시트(모바일) |
| `/search` | 상호·지역·주소 검색 |
| `/sauna/[시도]/[slug]` | 상세 — 온도, 영업시간, 가격, 사진, 후기, 위치 |
| `/feed`, `/feed/[slug]` | 읽을거리(매거진) |
| `/favorites` | 찜(때수건 토글) |
| `/my` | 마이 — 후기 / 기록 탭, 프로필 |

## 기술 스택

- **Next.js 16** (App Router, Turbopack) · React 19 · TypeScript
- **Tailwind CSS v4** — 팔레트는 `app/globals.css` 토큰 단일 출처
- **Supabase** — Postgres + PostGIS(주변 검색) · Auth(쿠키 세션) · Storage(사진)
- **네이버 지도 SDK** — 베이스맵만 사용(자산은 POI·후기 DB)
- **Vercel** — 호스팅 + Cron(공공데이터 동기화)

### 눈여겨볼 만한 부분

- **UI 일러스트를 직접 그림** — `components/illustrations/`. 목욕탕·찜질방·온천 같은 반복 용어마다
  전용 플랫 SVG를 두고, 대형 씬과 16~20px 칩을 짝으로 유지해 어느 화면에서든 같은 용어가 같게 읽히게 했다.
  범용 라인 아이콘(Lucide)은 임시 자리표시로만 쓴다. 규칙은 [`CLAUDE.md`](./CLAUDE.md).
- **OG 이미지·파비콘도 코드로 렌더** — `app/opengraph-image.tsx`, `app/icon.tsx` (`next/og` + Pretendard).
- **사진 무흔적 원칙** — 모든 이미지는 우리 Supabase Storage 에서만 서빙한다.
  `next.config.ts` 의 `remotePatterns` 에 제3자 호스트를 아예 등록하지 않아, 외부 이미지 핫링크가 **구조적으로 불가능**하다.
  출처·원본URL은 서버 전용이라 클라이언트로 내려가지 않는다.
- **런타임 킬스위치** — 재배포 없이 사진·후기 노출을 끌 수 있다(아래 참조).
- **업로드 파이프라인** — 인증 → 킬스위치 → 레이트리밋(1인 1일 10장) → 타입·크기 검증
  → EXIF 회전 반영·리사이즈·WebP 재인코딩(sharp) → 모더레이션(Vision) → 게시.
  insert 실패 시 Storage 객체를 롤백한다. `app/api/photos/route.ts`

---

## 로컬 실행

```bash
pnpm install
cp .env.example .env.local   # 값 채우기
pnpm dev                     # http://localhost:3000
```

> **Supabase 환경변수 없이는 빌드도 되지 않는다.** 홈·지도·읽을거리가 ISR 로 프리렌더되어
> 빌드 타임에 DB 를 조회하기 때문. 필요한 키는 [`.env.example`](./.env.example) 참조.
> 지도 키(`NEXT_PUBLIC_NAVER_MAP_CLIENT_ID`)가 없으면 앱은 뜨지만 `/map` 이 안내 상태로 표시된다.

스키마는 `supabase/migrations/` 를 순서대로 적용한다. 사진 기능은 `sauna-photos` 버킷이 필요하다.

## 데이터 파이프라인

전국 커버리지는 공공데이터로 깔고, 세부 정보는 별도 스크립트로 보강한다.
Cron(`vercel.json`, 매일 03:00 KST)이 `/api/cron/sync` 를 호출해 목욕장업·온천 데이터를 전수 upsert 한다.

```bash
pnpm load:initial              # 초기 적재(공공데이터 → saunas)
pnpm crawl:naver -- --limit 20 # 블로그 후기(네이버 공식 검색 API)
pnpm crawl:naver-info          # 영업시간·가격 등 기본정보 보강
pnpm derive:price              # 후기 텍스트에서 가격 추출
pnpm describe                  # 매장 소개문 생성
pnpm import:articles           # content/magazine/*.md → articles 테이블
pnpm merge:dupes               # 행정통합(전남·광주 등)으로 생긴 중복 매장 병합
pnpm audit:storage             # Storage ↔ DB 정합성 점검
```

### 런타임 킬스위치

재배포 없이 최대 30초 내 반영된다(`lib/config/contentPolicy.ts`).

```bash
pnpm flag images_enabled off        # 전 앱 사진 OFF → plain card
pnpm flag blog_reviews_enabled off  # 블로그 후기 섹션 OFF
pnpm flag list                      # 현재 플래그 값
```

비상 퍼지(크롤 자산만 영구 삭제, 우리 자산 owner/editor 는 보존):

```sql
delete from sauna_photos where source = 'naver_crawl';
update saunas set thumbnail_url = null, thumbnail_source = null
  where thumbnail_source = 'naver_crawl';
-- + Storage sauna-photos 버킷의 해당 객체 삭제
```

## 기타

```bash
pnpm lint        # 커밋 전 통과 필수
pnpm favicon     # app/icon.tsx 디자인 → app/favicon.ico 재생성(dev 서버 필요)
```
