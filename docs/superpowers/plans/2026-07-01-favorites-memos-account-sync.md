# 찜·메모 계정(DB) 동기화 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 로그인 사용자의 찜(즐겨찾기)과 비공개 메모를 localStorage 대신 Supabase(계정)에 저장해 기기가 바뀌어도 유지되게 한다.

**Architecture:** `lib/favorites.ts`·`lib/records.ts`의 훅을 모듈 레벨 싱글턴 스토어로 재작성한다(한 번만 세션 감지+DB 로드+구독, 같은 탭의 여러 인스턴스가 즉시 동기화). 훅은 `reviews.ts` 패턴을 따라 `userId`(null=비로그인)를 노출하고, 소비 컴포넌트는 비로그인 시 기존 `LoginSheet`를 띄운다. 메모는 신규 테이블 `sauna_memos`, 찜은 이미 적용된 `sauna_favorites`를 사용한다.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Supabase(@supabase/ssr 브라우저 클라이언트), pnpm, Tailwind v4.

## Global Constraints

- 패키지 매니저는 **pnpm**. 명령은 `pnpm ...` / `pnpm exec ...`.
- **자동화 테스트 프레임워크가 없다.** 각 태스크 검증 = `pnpm exec tsc --noEmit`(타입) + `pnpm lint`(린트) + 명시된 수동 스모크. 새 테스트 러너를 도입하지 않는다(YAGNI, 기존 관례).
- 브라우저 인증 클라이언트는 `import { createSupabaseBrowserClient } from "@/lib/supabase/browser"` 만 사용(클라이언트 컴포넌트 전용).
- Supabase 클라이언트는 DB 타입 미생성 상태 → `reviews.ts`처럼 파일 상단에 `/* eslint-disable @typescript-eslint/no-explicit-any */`를 두고 응답 행을 `any`로 캐스팅.
- 마이그레이션 SQL은 **파일로만 추가**한다. DB 적용은 사용자가 Supabase SQL Editor에 붙여넣기(코드가 DB에 직접 실행하지 않음). 0019(`sauna_favorites`)는 이미 적용됨.
- 훅의 기존 반환 필드(`ids`/`toggle`/`isFavorite`, `records`/`setRecord`/`removeRecord`)는 **유지**하고 `userId`/`loading`만 **추가**한다(소비자 무변경 최소화).
- 범위 밖(구현하지 않음): 로컬→서버 1회 이관, `favorite_count` 추천순 정렬, `saunas_nearby_v2` 재정의.

---

### Task 1: 메모 테이블 마이그레이션 `0023_memos.sql`

**Files:**
- Create: `supabase/migrations/0023_memos.sql`

**Interfaces:**
- Produces: `public.sauna_memos (user_id uuid, sauna_id uuid, note text, created_at, updated_at)` PK `(user_id, sauna_id)`, RLS 본인 행 select/insert/update/delete. Task 3(`lib/records.ts`)이 이 테이블을 조회/upsert/삭제한다.

- [ ] **Step 1: 마이그레이션 파일 작성**

`supabase/migrations/0023_memos.sql`:

```sql
-- ============================================================
-- 0023_memos — 로그인 사용자 비공개 메모(사우나별)
-- 지금까지 메모는 브라우저 localStorage(lib/records.ts)에만 있었다.
-- 로그인(0011)이 붙었고 찜(0019)을 서버로 옮기는 것과 함께
-- 메모도 계정에 저장해 기기가 바뀌어도 유지되게 한다.
-- 후기(0013)와 달리 비공개(본인만) — 집계·노출 없음.
-- 적용: Supabase Dashboard > SQL Editor 에 그대로 붙여넣기
-- ============================================================

-- 사용자×매장 1행. 같은 사우나 메모는 upsert로 갱신 → 복합 PK.
create table public.sauna_memos (
  user_id    uuid not null references auth.users(id) on delete cascade,
  sauna_id   uuid not null references public.saunas(id) on delete cascade,
  note       text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, sauna_id)
);

comment on table public.sauna_memos is
  '로그인 사용자 비공개 메모. (user_id, sauna_id) 유일. 본인만 열람(RLS). 후기와 별개.';

-- "내 메모 목록"(user_id 선두)은 PK가 커버. 최신순 정렬용 보조 인덱스.
create index sauna_memos_user_updated_idx
  on public.sauna_memos (user_id, updated_at desc);

-- ---------- RLS: 본인 메모만 ----------
alter table public.sauna_memos enable row level security;

create policy "memos read own" on public.sauna_memos
  for select to authenticated using (auth.uid() = user_id);

create policy "memos insert own" on public.sauna_memos
  for insert to authenticated with check (auth.uid() = user_id);

create policy "memos update own" on public.sauna_memos
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "memos delete own" on public.sauna_memos
  for delete to authenticated using (auth.uid() = user_id);
```

- [ ] **Step 2: 형식 검증(파일 존재·번호 충돌 없음)**

Run: `ls supabase/migrations/0023_memos.sql`
Expected: 경로 출력. `0023_` 번호가 유일(직전 최신은 `0022_article_topics.sql`).

- [ ] **Step 3: 커밋**

```bash
git add supabase/migrations/0023_memos.sql
git commit -m "feat(db): sauna_memos 테이블(로그인 사용자 비공개 메모) 마이그레이션"
```

---

### Task 2: `lib/favorites.ts` — DB 기반 찜 훅

**Files:**
- Modify(전체 재작성): `lib/favorites.ts`

**Interfaces:**
- Consumes: `createSupabaseBrowserClient` from `@/lib/supabase/browser`; DB 테이블 `sauna_favorites`(0019, 적용됨).
- Produces: `useFavorites(): { ids: string[]; userId: string | null; loading: boolean; toggle: (saunaId: string) => void; isFavorite: (id: string) => boolean }` 및 `getDeviceId(): string`. Task 4·6 및 기존 `app/my/page.tsx`가 소비.

- [ ] **Step 1: 파일 전체 재작성**

`lib/favorites.ts` 전체를 아래로 교체:

```ts
"use client";

import { useCallback, useEffect, useReducer } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * 찜하기 — 로그인 사용자만 사용, Supabase(sauna_favorites)에 저장(기기 바뀌어도 유지).
 * 카드마다 하트가 있으므로 모듈 레벨 스토어로 한 번만 세션 감지·로드·구독하고,
 * 같은 탭의 모든 하트가 즉시 같은 상태를 읽는다. device_id는 익명 식별용으로 보존.
 */
const DEVICE_KEY = "saunau:device_id";

export function getDeviceId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

// ---- 모듈 레벨 싱글턴 스토어 ----
let ids: string[] = [];
let userId: string | null = null;
let loading = true;
let initialized = false;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

async function loadFor(uid: string | null) {
  userId = uid;
  if (!uid) {
    ids = [];
    loading = false;
    notify();
    return;
  }
  const supabase = createSupabaseBrowserClient();
  const { data } = await supabase
    .from("sauna_favorites")
    .select("sauna_id")
    .eq("user_id", uid);
  ids = (data ?? []).map((r: any) => r.sauna_id as string);
  loading = false;
  notify();
}

function ensureInit() {
  if (initialized) return;
  initialized = true;
  const supabase = createSupabaseBrowserClient();
  void (async () => {
    const { data } = await supabase.auth.getUser();
    await loadFor(data.user?.id ?? null);
  })();
  supabase.auth.onAuthStateChange((_e: any, session: any) => {
    void loadFor(session?.user?.id ?? null);
  });
}

/** 전체 찜 목록 + 토글. 로그인 사용자만 쓰기 가능(userId 없으면 toggle 무시). */
export function useFavorites() {
  const [, force] = useReducer((c: number) => c + 1, 0);

  useEffect(() => {
    ensureInit();
    listeners.add(force);
    return () => {
      listeners.delete(force);
    };
  }, []);

  const toggle = useCallback(async (saunaId: string) => {
    if (!userId) return;
    const supabase = createSupabaseBrowserClient();
    const has = ids.includes(saunaId);
    // 낙관적 업데이트.
    ids = has ? ids.filter((x) => x !== saunaId) : [...ids, saunaId];
    notify();
    const { error } = has
      ? await supabase
          .from("sauna_favorites")
          .delete()
          .eq("user_id", userId)
          .eq("sauna_id", saunaId)
      : await supabase
          .from("sauna_favorites")
          .insert({ user_id: userId, sauna_id: saunaId });
    if (error) {
      // 실패 시 롤백.
      ids = has ? [...ids, saunaId] : ids.filter((x) => x !== saunaId);
      notify();
    }
  }, []);

  return {
    ids,
    userId,
    loading,
    toggle,
    isFavorite: (id: string) => ids.includes(id),
  };
}
```

- [ ] **Step 2: 타입 체크**

Run: `pnpm exec tsc --noEmit`
Expected: 에러 없음(0 exit). 특히 `app/my/page.tsx`·`app/favorites/page.tsx`가 여전히 컴파일(반환 필드 유지).

- [ ] **Step 3: 린트**

Run: `pnpm lint`
Expected: `lib/favorites.ts` 관련 신규 에러 없음.

- [ ] **Step 4: 커밋**

```bash
git add lib/favorites.ts
git commit -m "feat(favorites): 찜을 Supabase(sauna_favorites) 계정 저장으로 전환"
```

---

### Task 3: `lib/records.ts` — DB 기반 메모 훅

**Files:**
- Modify(전체 재작성): `lib/records.ts`

**Interfaces:**
- Consumes: `createSupabaseBrowserClient`; DB 테이블 `sauna_memos`(Task 1).
- Produces: `useRecords(): { records: RecordNote[]; userId: string | null; loading: boolean; setRecord: (saunaId: string, note: string) => void; removeRecord: (saunaId: string) => void }` 및 `interface RecordNote { saunaId: string; note: string; updatedAt: string }`. Task 5·7 및 기존 `app/my/page.tsx`가 소비.

- [ ] **Step 1: 파일 전체 재작성**

`lib/records.ts` 전체를 아래로 교체:

```ts
"use client";

import { useCallback, useEffect, useReducer } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * 나의 기록 — 후기(공개)와 분리된, 나만 보는 사우나별 비공개 메모.
 * 로그인 사용자만 사용하며 Supabase(sauna_memos)에 저장한다(기기 바뀌어도 유지).
 * 모듈 레벨 스토어로 한 번만 로드/구독하고, 같은 탭의 여러 화면이 즉시 동기화된다.
 */
export interface RecordNote {
  saunaId: string;
  note: string;
  updatedAt: string; // ISO datetime
}

// ---- 모듈 레벨 싱글턴 스토어 ----
let records: RecordNote[] = [];
let userId: string | null = null;
let loading = true;
let initialized = false;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

async function loadFor(uid: string | null) {
  userId = uid;
  if (!uid) {
    records = [];
    loading = false;
    notify();
    return;
  }
  const supabase = createSupabaseBrowserClient();
  const { data } = await supabase
    .from("sauna_memos")
    .select("sauna_id, note, updated_at")
    .eq("user_id", uid)
    .order("updated_at", { ascending: false });
  records = (data ?? []).map((r: any) => ({
    saunaId: r.sauna_id,
    note: r.note ?? "",
    updatedAt: r.updated_at,
  }));
  loading = false;
  notify();
}

function ensureInit() {
  if (initialized) return;
  initialized = true;
  const supabase = createSupabaseBrowserClient();
  void (async () => {
    const { data } = await supabase.auth.getUser();
    await loadFor(data.user?.id ?? null);
  })();
  supabase.auth.onAuthStateChange((_e: any, session: any) => {
    void loadFor(session?.user?.id ?? null);
  });
}

/** 비공개 기록 목록(최신 수정순) + 저장/삭제. 같은 사우나는 1건으로 유지. */
export function useRecords() {
  const [, force] = useReducer((c: number) => c + 1, 0);

  useEffect(() => {
    ensureInit();
    listeners.add(force);
    return () => {
      listeners.delete(force);
    };
  }, []);

  // 빈 note 는 저장하지 않고 기존 기록을 삭제(빈 메모 카드 방지).
  const setRecord = useCallback(async (saunaId: string, note: string) => {
    if (!userId) return;
    const supabase = createSupabaseBrowserClient();
    const trimmed = note.trim();
    if (!trimmed) {
      records = records.filter((r) => r.saunaId !== saunaId);
      notify();
      await supabase
        .from("sauna_memos")
        .delete()
        .eq("user_id", userId)
        .eq("sauna_id", saunaId);
      return;
    }
    const nowIso = new Date().toISOString();
    // 낙관적: 최신순 유지 위해 맨 앞으로.
    records = [
      { saunaId, note: trimmed, updatedAt: nowIso },
      ...records.filter((r) => r.saunaId !== saunaId),
    ];
    notify();
    await supabase.from("sauna_memos").upsert(
      { user_id: userId, sauna_id: saunaId, note: trimmed, updated_at: nowIso },
      { onConflict: "user_id,sauna_id" },
    );
  }, []);

  const removeRecord = useCallback(async (saunaId: string) => {
    if (!userId) return;
    const supabase = createSupabaseBrowserClient();
    records = records.filter((r) => r.saunaId !== saunaId);
    notify();
    await supabase
      .from("sauna_memos")
      .delete()
      .eq("user_id", userId)
      .eq("sauna_id", saunaId);
  }, []);

  return { records, userId, loading, setRecord, removeRecord };
}
```

- [ ] **Step 2: 타입 체크**

Run: `pnpm exec tsc --noEmit`
Expected: 에러 없음. `app/my/page.tsx`(`useRecords`의 `records`)·`components/my/RecordsTab.tsx`가 여전히 컴파일.

- [ ] **Step 3: 린트**

Run: `pnpm lint`
Expected: `lib/records.ts` 관련 신규 에러 없음.

- [ ] **Step 4: 커밋**

```bash
git add lib/records.ts
git commit -m "feat(records): 메모를 Supabase(sauna_memos) 계정 저장으로 전환"
```

---

### Task 4: `FavoriteScrubber` 로그인 게이트

**Files:**
- Modify: `components/sauna/FavoriteScrubber.tsx`

**Interfaces:**
- Consumes: `useFavorites()`의 `isFavorite`/`toggle`/`userId`(Task 2); `LoginSheet`(`@/components/auth/LoginSheet`).

- [ ] **Step 1: 컴포넌트에 로그인 시트 추가**

`components/sauna/FavoriteScrubber.tsx` 전체를 아래로 교체:

```tsx
"use client";

import { useState } from "react";
import { ScrubberIcon } from "./ScrubberIcon";
import { useFavorites } from "@/lib/favorites";
import { LoginSheet } from "@/components/auth/LoginSheet";

/** 찜하기 — 하트 대신 때수건(이태리타올). 찜하면 초록+검정 줄무늬로 채워진다. 로그인 필요(비로그인은 LoginSheet). */
export function FavoriteScrubber({
  saunaId,
  size = 26,
  className = "",
  onLight = false,
}: {
  saunaId: string;
  size?: number;
  className?: string;
  /** true면 밝은 배경용(먹색 외곽선). false면 사진 위 오버레이용(흰 외곽선). */
  onLight?: boolean;
}) {
  const { isFavorite, toggle, userId } = useFavorites();
  const [loginOpen, setLoginOpen] = useState(false);
  const active = isFavorite(saunaId);

  const idleStroke = onLight ? "var(--color-ink)" : "#fff";

  return (
    <>
      <button
        type="button"
        aria-label={active ? "찜 해제" : "찜하기"}
        aria-pressed={active}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!userId) {
            setLoginOpen(true);
            return;
          }
          toggle(saunaId);
        }}
        className={`flex items-center justify-center ${className}`}
        style={{ color: idleStroke }}
      >
        <ScrubberIcon size={size} filled={active} strokeWidth={1.4} />
      </button>
      <LoginSheet open={loginOpen} onClose={() => setLoginOpen(false)} />
    </>
  );
}
```

- [ ] **Step 2: 타입 체크 + 린트**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: 에러 없음.

- [ ] **Step 3: 커밋**

```bash
git add components/sauna/FavoriteScrubber.tsx
git commit -m "feat(favorites): 비로그인 찜 클릭 시 LoginSheet 유도"
```

---

### Task 5: `SaunaMemoCard` 로그인 게이트

**Files:**
- Modify: `components/sauna/SaunaMemoCard.tsx`

**Interfaces:**
- Consumes: `useRecords()`의 `userId`(Task 3); `LoginSheet`.

- [ ] **Step 1: import에 LoginSheet 추가**

`components/sauna/SaunaMemoCard.tsx` 상단 import 블록에서 `useRecords` import 다음 줄에 추가:

```tsx
import { LoginSheet } from "@/components/auth/LoginSheet";
```

- [ ] **Step 2: 훅에서 userId 받고 loginOpen 상태 추가**

기존:

```tsx
  const { records, setRecord, removeRecord } = useRecords();
  const note = records.find((r) => r.saunaId === saunaId)?.note ?? "";
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note);

  const startEdit = () => {
    setDraft(note);
    setEditing(true);
  };
```

를 아래로 교체:

```tsx
  const { records, setRecord, removeRecord, userId } = useRecords();
  const note = records.find((r) => r.saunaId === saunaId)?.note ?? "";
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note);
  const [loginOpen, setLoginOpen] = useState(false);

  const startEdit = () => {
    if (!userId) {
      setLoginOpen(true);
      return;
    }
    setDraft(note);
    setEditing(true);
  };
```

- [ ] **Step 3: 비편집 return에 LoginSheet 마운트**

기존 비편집 `return (` 블록의 마지막 `</section>` 앞(닫는 태그 직전, `</p>` 다음)에 `LoginSheet`를 넣기 위해, 해당 return의 마지막 부분

```tsx
      <p className="mt-[7px] flex items-center gap-[5px] text-[11px] text-dot">
        <Lock size={11} />
        나에게만 보여요 · 후기와 별개예요
      </p>
    </section>
  );
```

를 아래로 교체:

```tsx
      <p className="mt-[7px] flex items-center gap-[5px] text-[11px] text-dot">
        <Lock size={11} />
        나에게만 보여요 · 후기와 별개예요
      </p>
      <LoginSheet open={loginOpen} onClose={() => setLoginOpen(false)} />
    </section>
  );
```

(참고: 편집 중 return은 로그인 상태에서만 진입하므로 LoginSheet 불필요.)

- [ ] **Step 4: 타입 체크 + 린트**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: 에러 없음.

- [ ] **Step 5: 커밋**

```bash
git add components/sauna/SaunaMemoCard.tsx
git commit -m "feat(records): 비로그인 메모 작성 시 LoginSheet 유도"
```

---

### Task 6: 찜 페이지 비로그인 UI (`app/favorites/page.tsx`)

**Files:**
- Modify: `app/favorites/page.tsx`

**Interfaces:**
- Consumes: `useFavorites()`의 `ids`/`userId`/`loading`(Task 2); `LoginSheet`.

- [ ] **Step 1: import 추가**

`app/favorites/page.tsx` 상단 import 블록에 추가(기존 `useFavorites` import 아래):

```tsx
import { useState } from "react";
import { Lock } from "lucide-react";
import { LoginSheet } from "@/components/auth/LoginSheet";
```

기존 `import { useEffect, useMemo, useState } from "react";` 가 이미 있으면 `useState` 중복 추가하지 말 것 — 현재 파일은 `import { useEffect, useMemo, useState } from "react";` 이므로 **`useState`는 이미 존재**한다. 따라서 실제로 추가할 import는 다음 2줄뿐:

```tsx
import { Lock } from "lucide-react";
import { LoginSheet } from "@/components/auth/LoginSheet";
```

- [ ] **Step 2: 훅에서 userId/loading 받기**

기존:

```tsx
  const { ids } = useFavorites();
```

를 아래로 교체:

```tsx
  const { ids, userId, loading } = useFavorites();
  const [loginOpen, setLoginOpen] = useState(false);
```

- [ ] **Step 3: 비로그인 분기 렌더**

기존 `return (` 블록에서 헤더 다음의 본문 조건

```tsx
      {saved.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="flex flex-col gap-[14px] px-[16px] pb-[20px]">
          {saved.map((s) => (
            <SaunaCard key={s.id} sauna={s} />
          ))}
        </div>
      )}
    </div>
  );
```

를 아래로 교체:

```tsx
      {loading ? null : !userId ? (
        <LoginPrompt onLogin={() => setLoginOpen(true)} />
      ) : saved.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="flex flex-col gap-[14px] px-[16px] pb-[20px]">
          {saved.map((s) => (
            <SaunaCard key={s.id} sauna={s} />
          ))}
        </div>
      )}
      <LoginSheet open={loginOpen} onClose={() => setLoginOpen(false)} />
    </div>
  );
```

- [ ] **Step 4: LoginPrompt 컴포넌트 추가**

파일 하단(`EmptyState` 함수 정의 다음)에 추가:

```tsx
function LoginPrompt({ onLogin }: { onLogin: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-[20px] py-[40px] text-center">
      <div className="flex h-[84px] w-[84px] items-center justify-center rounded-full bg-[#F4F2EF]">
        <Lock size={34} className="text-muted" />
      </div>
      <p className="mt-[18px] text-[15px] font-semibold text-ink">
        로그인하면 찜을 모아볼 수 있어요
      </p>
      <p className="mt-[6px] text-[13px] text-muted">
        찜한 사우나는 어디서 접속해도 그대로예요
      </p>
      <button
        type="button"
        onClick={onLogin}
        className="mt-[20px] rounded-full bg-brand px-[20px] py-[11px] text-[14px] font-semibold text-white"
      >
        로그인
      </button>
    </div>
  );
}
```

- [ ] **Step 5: 타입 체크 + 린트**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: 에러 없음.

- [ ] **Step 6: 커밋**

```bash
git add app/favorites/page.tsx
git commit -m "feat(favorites): 찜 페이지 비로그인 상태 로그인 유도 UI"
```

---

### Task 7: 기록 탭 비로그인 UI (`components/my/RecordsTab.tsx`)

**Files:**
- Modify: `components/my/RecordsTab.tsx`

**Interfaces:**
- Consumes: `useRecords()`의 `records`/`setRecord`/`removeRecord`/`userId`/`loading`(Task 3); `LoginSheet`.

- [ ] **Step 1: import 추가**

`components/my/RecordsTab.tsx` 상단 import 블록에 추가:

```tsx
import { LoginSheet } from "@/components/auth/LoginSheet";
```

(`Lock`은 이미 `lucide-react`에서 import 중이므로 재사용.)

- [ ] **Step 2: 훅에서 userId/loading 받고 비로그인 분기 추가**

기존:

```tsx
export function RecordsTab() {
  const { records, setRecord, removeRecord } = useRecords();
  const [byId, setById] = useState<Map<string, Sauna>>(new Map());
  const [picking, setPicking] = useState(false);
```

를 아래로 교체:

```tsx
export function RecordsTab() {
  const { records, setRecord, removeRecord, userId, loading } = useRecords();
  const [byId, setById] = useState<Map<string, Sauna>>(new Map());
  const [picking, setPicking] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
```

- [ ] **Step 3: 비로그인 early return 추가**

`const ids = useMemo(...)` 선언 다음, `useEffect(...)` 앞(또는 첫 `if (records.length === 0)` 앞이 아니라 훅 호출들 뒤)이 아니라 — 훅 규칙 위반을 피하기 위해 **모든 훅 호출(useMemo/useEffect) 다음, 첫 `return` 판단 직전**에 배치한다. 기존

```tsx
  if (records.length === 0) {
    return (
```

바로 위에 다음을 삽입:

```tsx
  if (loading) return null;

  if (!userId) {
    return (
      <>
        <div className="flex flex-col items-center justify-center px-[20px] py-[80px] text-center">
          <div className="flex h-[84px] w-[84px] items-center justify-center rounded-full bg-[#F2F1EF]">
            <Lock size={34} className="text-muted" />
          </div>
          <p className="mt-[18px] text-[15px] font-semibold text-ink">
            로그인하면 나만의 기록을 남길 수 있어요
          </p>
          <p className="mt-[6px] text-[13px] text-muted">
            남긴 메모는 어디서 접속해도 그대로예요
          </p>
          <button
            type="button"
            onClick={() => setLoginOpen(true)}
            className="mt-[20px] rounded-full bg-brand px-[20px] py-[11px] text-[14px] font-semibold text-white"
          >
            로그인
          </button>
        </div>
        <LoginSheet open={loginOpen} onClose={() => setLoginOpen(false)} />
      </>
    );
  }

```

(로그인 사용자만 이 지점을 지나므로 이후 `RecordPicker`/추가 버튼은 로그인 상태 보장.)

- [ ] **Step 4: 타입 체크 + 린트**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: 에러 없음. (`useMemo`/`useEffect`가 early return보다 앞에 있어 훅 순서 규칙 준수.)

- [ ] **Step 5: 커밋**

```bash
git add components/my/RecordsTab.tsx
git commit -m "feat(records): 기록 탭 비로그인 상태 로그인 유도 UI"
```

---

### Task 8: 통합 수동 검증 + 마이그레이션 적용

**Files:** (없음 — 검증 전용)

- [ ] **Step 1: 마이그레이션 적용(사용자)**

`supabase/migrations/0023_memos.sql` 내용을 Supabase Dashboard > SQL Editor에 붙여넣어 실행. `sauna_memos` 테이블과 4개 정책이 생성됐는지 확인.

- [ ] **Step 2: 빌드 통과 확인**

Run: `pnpm build`
Expected: 타입/빌드 에러 없이 완료.

- [ ] **Step 3: 개발 서버 스모크**

Run: `pnpm dev` 후 브라우저에서:
- (a) **비로그인** 상태로 매장 상세의 때수건(찜) 탭 → `LoginSheet` 뜸.
- (b) **비로그인** 상세의 "나만의 메모 남기기" 탭 → `LoginSheet` 뜸.
- (c) `/favorites` 탭·마이 '기록' 탭이 비로그인 시 "로그인" 유도 화면.
- (d) **로그인 후**: 찜 추가/해제가 새로고침 후에도 유지. 같은 매장이 목록/상세에서 동시에 채워짐(같은 탭 동기화).
- (e) 로그인 후 메모 작성→수정→삭제가 반영되고 새로고침 후 유지. 마이 '기록' 탭과 상세 카드가 일치.
- (f) 로그아웃 시 찜/메모 화면이 다시 로그인 유도로 전환.

- [ ] **Step 4: 최종 확인 커밋(변경 없으면 생략)**

검증 중 수정이 있었다면 해당 파일만 커밋. 없으면 이 단계 생략.

---

## Self-Review

**Spec coverage:**
- 로그인 필수 + 병합 없음 → Task 2·3(userId 게이트, 로컬 미사용). ✓
- 비로그인 시 LoginSheet → Task 4·5·6·7. ✓
- 메모 테이블 신규(0022), 찜 테이블 기존 → Task 1(메모만). ✓
- 훅 반환 필드 유지 + userId/loading 추가 → Task 2·3. ✓
- 마이그레이션 사용자 수동 적용 → Task 8 Step 1. ✓
- 범위 밖(이관·favorite_count·nearby_v2) → 계획에 미포함(명시). ✓

**Placeholder scan:** TBD/TODO/"적절히 처리" 없음. 모든 코드 블록은 실제 내용. ✓

**Type consistency:**
- `useFavorites` 반환 `{ ids, userId, loading, toggle, isFavorite }` — Task 4·6 소비와 일치. ✓
- `useRecords` 반환 `{ records, userId, loading, setRecord, removeRecord }` — Task 5·7·my page 소비와 일치. ✓
- `RecordNote { saunaId, note, updatedAt }` 형태 유지 — `RecordsTab`의 `record.updatedAt`/`record.note`/`r.saunaId` 사용과 일치. ✓
- 테이블/컬럼명 `sauna_memos(user_id, sauna_id, note, updated_at)` — Task 1 정의와 Task 3 쿼리 일치. ✓
