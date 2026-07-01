# 찜·메모 계정(DB) 동기화 — 설계

- 날짜: 2026-07-01
- 상태: 승인 대기(사용자 리뷰)

## 목표

로그인 사용자의 **찜(즐겨찾기)** 과 **비공개 메모**를 기기 로컬(localStorage)이 아니라
**계정(Supabase DB)** 에 저장해, 기기가 바뀌어도 유지되도록 한다.

## 결정 사항

1. **로그인 필수.** 찜·메모는 로그인 사용자만 사용한다. 로컬↔서버 병합 로직 없음.
2. **비로그인 UX:** 버튼은 그대로 노출하고, 누르면 기존 `LoginSheet`(하단 시트)를 띄워
   로그인을 유도한다. 로그인 성공 후 바로 찜·메모 가능.
3. **기존 로컬 데이터는 이관하지 않는다.** 로그인 필수 전환이므로 기존 localStorage
   찜/메모는 폐기된다(사용자 결정). 필요 시 추후 별도 1회 이관 작업으로 분리.
4. **찜 집계(추천순 정렬, `favorite_count`)는 이번 범위 밖.** 이 작업의 훅은
   `sauna_favorites`를 직접 조회하므로 `saunas_nearby_v2`/`favorite_count`에 의존하지 않는다.

## 현재 상태(전제)

- `sauna_favorites` 테이블: **DB에 적용됨**(마이그레이션 0019). RLS·복합 PK 존재.
  → 찜은 신규 마이그레이션 불필요.
- 메모용 테이블: **없음** → 신규 마이그레이션 필요.
- 로그인 게이팅 관례: 각 컴포넌트가 로컬 `loginOpen` state로 `<LoginSheet>`를 렌더
  (예: `PhotoReportButton`, `TempHero`, `UserPhotoUpload`, `VisitorReviews`).
- DB 훅 관례(`lib/reviews.ts`): `createSupabaseBrowserClient()` 사용, 마운트 +
  `onAuthStateChange`에서 데이터 로드, `userId`(null=비로그인)를 노출.

## 아키텍처

### 1. 마이그레이션 — `supabase/migrations/0022_memos.sql` (신규)

`public.sauna_memos` 테이블:

- 컬럼: `user_id uuid` (→ `auth.users(id)` on delete cascade),
  `sauna_id uuid` (→ `public.saunas(id)` on delete cascade),
  `note text not null`, `updated_at timestamptz not null default now()`,
  `created_at timestamptz not null default now()`
- PK: `(user_id, sauna_id)` — 사용자×매장 1행(upsert 대상).
- RLS(본인 행만): select/insert/update/delete — `auth.uid() = user_id`
  (reviews·favorites와 동일 패턴).
- 집계 컬럼/트리거 없음(비공개 메모, 노출·정렬 미사용).
- 적용은 사용자가 Supabase SQL Editor에 붙여넣기(0019 관례). 코드가 DB에 직접 실행하지 않음.

### 2. `lib/favorites.ts` — `useFavorites()` DB화

- 반환: `{ ids, toggle, isFavorite, userId, loading }` (기존 `ids/toggle/isFavorite` 유지 + 신규 2개).
- 로드: 마운트 + `onAuthStateChange`에서, 로그인 시 `sauna_favorites`에서 내 `sauna_id` 목록 조회.
  비로그인이면 `ids=[]`.
- `toggle(saunaId)`: 로그인 시 `sauna_favorites` insert(없으면)/delete(있으면). 낙관적 업데이트.
- **같은 탭 다중 인스턴스 동기화:** 카드마다 `FavoriteScrubber`가 있으므로, 모듈 레벨
  in-memory 캐시(`Set<string>`) + 커스텀 이벤트로 모든 인스턴스가 즉시 같은 상태를 읽게 한다
  (현재 localStorage 이벤트가 주던 즉각 반응을 대체·유지).
- `getDeviceId` export는 보존(외부 사용처는 없으나 안전하게 유지).

### 3. `lib/records.ts` — `useRecords()` DB화

- 반환: `{ records, setRecord, removeRecord, userId, loading }`.
- 로드: 마운트 + `onAuthStateChange`에서 `sauna_memos` 조회(최신 `updated_at` 순).
- `setRecord(saunaId, note)`: trim 후 빈값이면 delete, 아니면 `(user_id, sauna_id)` upsert.
- `removeRecord(saunaId)`: delete.
- `RecordNote` 형태(`saunaId/note/updatedAt`) 유지 — 소비자(`RecordsTab`) 무변경 최소화.

### 4. 컴포넌트

- **`FavoriteScrubber.tsx`**: `useFavorites()`에서 `userId` 받기. `loginOpen` state +
  `<LoginSheet>` 추가. onClick: `userId` 없으면 시트 오픈, 있으면 `toggle`.
- **`SaunaMemoCard.tsx`**: `useRecords()`에서 `userId` 받기. 편집 진입(`startEdit`)을
  로그인 게이트. 비로그인 시 `<LoginSheet>` 오픈.
- **`app/favorites/page.tsx`**: `userId` 없을 때 로그인 유도 상태(CTA + `<LoginSheet>`).
  로그인 상태에서는 기존 목록 UI 유지.
- **`components/my/RecordsTab.tsx`**: 비로그인 시 로그인 유도 상태 + 게이트. "새 기록 추가"/
  `RecordPicker`도 로그인 필요. `<LoginSheet>` 추가.

## 데이터 흐름

1. 비로그인 사용자가 하트/메모 탭 → 컴포넌트가 `userId===null` 확인 → `LoginSheet` 오픈.
2. 로그인 성공 → `onAuthStateChange` 발화 → 훅이 DB에서 내 찜/메모 로드 → UI 갱신.
3. 찜 토글/메모 저장 → DB write + 모듈 캐시/상태 낙관적 갱신 → 같은 탭 인스턴스 즉시 동기화.

## 에러 처리

- DB write 실패 시 낙관적 갱신을 롤백(이전 상태 복원)하고 조용히 무시(토스트 없음, 기존 톤 유지).
- 로드 실패 시 빈 목록으로 처리(reviews.ts와 동일).

## 테스트/검증

- 타입/린트: `pnpm lint`, `pnpm build`(또는 tsc)로 훅 시그니처 변경 소비자 무결성 확인.
- 수동: (a) 비로그인 하트→시트, (b) 로그인 후 찜 추가/해제가 새로고침·타기기에서 유지,
  (c) 메모 작성/수정/삭제 반영, (d) 찜 페이지/기록 탭 비로그인 상태 노출.

## 범위 밖(후속)

- 로컬→서버 1회 이관.
- `favorite_count` 기반 "추천순 정렬" 및 `saunas_nearby_v2`의 `favorite_count`+`is_sesin_shop`
  통합 정리(0019/0021 재정의 충돌 해소).
