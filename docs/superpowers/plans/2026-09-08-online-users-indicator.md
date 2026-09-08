# Online Users Indicator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a live "N online" indicator to the desktop sidebar's lower-left footer area, backed by a server-authoritative Redis heartbeat.

**Architecture:** A `verifyAuth`-gated heartbeat route records "this user is online" in Redis (TTL-based expiry); a client hook calls it on mount and on a visibility-aware interval, and listens for a broadcast ping (fired by any client's heartbeat) to refetch the count promptly on other open tabs. See `docs/superpowers/specs/2026-09-08-online-users-indicator-design.md` for the full "why", including the "Revision note" explaining why this replaces an earlier client-side Supabase Presence design that security review rejected.

**Tech Stack:** Next.js 16 / React 19 / TypeScript, `@upstash/redis` (already a dependency), Vitest.

## Global Constraints

- Count is per-person (keyed by the authenticated `user.id` from `verifyAuth`), not per-tab/connection.
- Desktop sidebar only — hidden inside the mobile hamburger drawer via `hidden lg:block` (the drawer reuses the same `sidebarContent` as the desktop sidebar, so placement alone does not exclude it).
- Count only — no popover, no list of who's online.
- Both new routes are `verifyAuth`-gated (no unauthenticated read or write path to the online count/heartbeat).
- Visual: pulsing emerald dot + `"{count} online"`, `text-[11px] text-emerald-300/90`, `px-3` (matching its immediate neighbors, not the brand header's `px-4`) — reuses the emerald "success/live" semantic already used for the current-user status dot in the same footer. No new color introduced (design system: navy + emerald + neutral only).
- Render nothing while the count is unknown (`count === null`) — never show a misleading "0 online" during the connect window.
- If this repo's installed `@upstash/redis` version's method signatures differ from the sketches below, follow the installed package's actual types (check `node_modules/@upstash/redis`) rather than the sketch — the sketch is illustrative of intent (`SET key val EX seconds`, `KEYS pattern`), not a guaranteed-exact API surface.

---

### Task 1: Presence roster → count helper

**Files:**
- Create: `lib/presence/deriveOnlineCount.ts`
- Test: `lib/presence/deriveOnlineCount.test.ts`

If `lib/hooks/derivePresenceCount.ts` and `lib/hooks/derivePresenceCount.test.ts` exist from a prior build attempt (the rejected client-Presence design), delete both — they are dead code under the new architecture.

**Interfaces:**
- Produces: `deriveOnlineCount(lastSeenByUser: Record<string, number>, nowMs: number, staleAfterMs: number): number` — Task 2 imports this exact name/signature.

- [ ] **Step 1: Write the failing test**

```typescript
// lib/presence/deriveOnlineCount.test.ts
import { describe, it, expect } from "vitest";
import { deriveOnlineCount } from "./deriveOnlineCount";

describe("deriveOnlineCount", () => {
  it("returns 0 for an empty map", () => {
    expect(deriveOnlineCount({}, 1_000_000, 90_000)).toBe(0);
  });

  it("counts a user seen within the staleness window", () => {
    const lastSeen = { "user-1": 999_000 };
    expect(deriveOnlineCount(lastSeen, 1_000_000, 90_000)).toBe(1);
  });

  it("excludes a user last seen beyond the staleness window", () => {
    const lastSeen = { "user-1": 900_000 };
    expect(deriveOnlineCount(lastSeen, 1_000_000, 90_000)).toBe(0);
  });

  it("counts each distinct user once", () => {
    const lastSeen = { "user-1": 999_000, "user-2": 995_000, "user-3": 999_500 };
    expect(deriveOnlineCount(lastSeen, 1_000_000, 90_000)).toBe(3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- lib/presence/deriveOnlineCount.test.ts`
Expected: FAIL — `Cannot find module './deriveOnlineCount'`

- [ ] **Step 3: Write minimal implementation**

```typescript
// lib/presence/deriveOnlineCount.ts
/**
 * Pure heartbeat-map -> online-count derivation. Shared by the in-memory dev
 * fallback in onlinePresence.ts; the Redis-backed path counts live keys
 * directly since Redis TTLs handle staleness there. Kept here, unit-tested
 * in isolation, so the counting rule has one definition regardless of which
 * store computes it.
 */
export function deriveOnlineCount(
  lastSeenByUser: Record<string, number>,
  nowMs: number,
  staleAfterMs: number,
): number {
  return Object.values(lastSeenByUser).filter((lastSeen) => nowMs - lastSeen <= staleAfterMs).length;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- lib/presence/deriveOnlineCount.test.ts`
Expected: PASS (4/4)

- [ ] **Step 5: Commit**

```bash
git add lib/presence/deriveOnlineCount.ts lib/presence/deriveOnlineCount.test.ts
git add -u lib/hooks/derivePresenceCount.ts lib/hooks/derivePresenceCount.test.ts
git commit -m "feat: add online-count derivation helper (replaces rejected Presence design)"
```

(The second `git add -u` stages the deletion of the two obsolete files if they exist; if they were never created in this working tree, drop that line.)

---

### Task 2: Redis-backed presence store

**Files:**
- Create: `lib/presence/onlinePresence.ts`

**Interfaces:**
- Consumes: `deriveOnlineCount` (`lib/presence/deriveOnlineCount.ts`, Task 1).
- Produces: `recordHeartbeat(userId: string): Promise<void>` and `getOnlineCount(): Promise<number>` — Task 3's routes import both.

- [ ] **Step 1: Write the module**

```typescript
// lib/presence/onlinePresence.ts
import { Redis } from "@upstash/redis";
import { deriveOnlineCount } from "@/lib/presence/deriveOnlineCount";

// A heartbeat older than this is treated as offline — 2x the client's
// HEARTBEAT_INTERVAL_MS (see lib/hooks/useOnlinePresence.ts) tolerates one
// missed beat (a slow network tick, a tab not yet paused) without flickering
// someone in and out of the count.
const STALE_AFTER_MS = 90_000;
const STALE_AFTER_SECONDS = STALE_AFTER_MS / 1000;
const REDIS_KEY_PREFIX = "ags_presence:";

// Mirrors lib/guardrails/rateLimiter.ts's existing Redis/in-memory fallback
// pattern exactly: Upstash in production, an in-memory Map in local dev when
// the env vars aren't configured.
let redis: Redis | null = null;
if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
}

const inMemoryHeartbeats = new Map<string, number>();

export async function recordHeartbeat(userId: string): Promise<void> {
  if (redis) {
    await redis.set(`${REDIS_KEY_PREFIX}${userId}`, 1, { ex: STALE_AFTER_SECONDS });
    return;
  }
  inMemoryHeartbeats.set(userId, Date.now());
}

export async function getOnlineCount(): Promise<number> {
  if (redis) {
    // KEYS is O(n) over the matched keyspace, which is fine at this app's
    // scale (one internal company's active employees, not a large
    // multi-tenant keyspace) — do not reuse this pattern for a larger one.
    const keys = await redis.keys(`${REDIS_KEY_PREFIX}*`);
    return keys.length;
  }
  const snapshot = Object.fromEntries(inMemoryHeartbeats);
  return deriveOnlineCount(snapshot, Date.now(), STALE_AFTER_MS);
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no new errors. If `redis.set`/`redis.keys` signatures differ from the installed `@upstash/redis` types, fix the call shape to match — see Global Constraints.

- [ ] **Step 3: Commit**

```bash
git add lib/presence/onlinePresence.ts
git commit -m "feat: add Redis-backed online presence store"
```

---

### Task 3: Heartbeat and count API routes

**Files:**
- Create: `app/api/presence/heartbeat/route.ts`
- Test: `app/api/presence/heartbeat/route.test.ts`
- Create: `app/api/presence/count/route.ts`
- Test: `app/api/presence/count/route.test.ts`

**Interfaces:**
- Consumes: `verifyAuth` (`lib/auth/verifyAuth.ts`), `recordHeartbeat`/`getOnlineCount` (`lib/presence/onlinePresence.ts`, Task 2), `scheduleBroadcast` (`lib/realtime/broadcast.ts`), `realtimeTopics.onlinePresence` (`lib/realtime/topics.ts`, Task 4 — implement Task 4 first, or add the constant inline now and let Task 4 be a no-op verification; either order is safe since it's a single string constant).
- Produces: `POST /api/presence/heartbeat` → `{ data: { count: number } }`; `GET /api/presence/count` → `{ data: { count: number } }` — Task 5's hook calls both.

- [ ] **Step 1: Write the heartbeat route**

```typescript
// app/api/presence/heartbeat/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verifyAuth";
import { recordHeartbeat, getOnlineCount } from "@/lib/presence/onlinePresence";
import { scheduleBroadcast } from "@/lib/realtime/broadcast";
import { realtimeTopics } from "@/lib/realtime/topics";

export async function POST(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await recordHeartbeat(user.id);
  const count = await getOnlineCount();
  scheduleBroadcast([{ topic: realtimeTopics.onlinePresence }]);

  return NextResponse.json({ data: { count } });
}
```

- [ ] **Step 2: Write the heartbeat route test**

```typescript
// app/api/presence/heartbeat/route.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const doubles = vi.hoisted(() => ({
  verifyAuth: vi.fn(),
  recordHeartbeat: vi.fn(),
  getOnlineCount: vi.fn(),
  scheduleBroadcast: vi.fn(),
}));

vi.mock("@/lib/auth/verifyAuth", () => ({ verifyAuth: doubles.verifyAuth }));
vi.mock("@/lib/presence/onlinePresence", () => ({
  recordHeartbeat: doubles.recordHeartbeat,
  getOnlineCount: doubles.getOnlineCount,
}));
vi.mock("@/lib/realtime/broadcast", () => ({ scheduleBroadcast: doubles.scheduleBroadcast }));

import { POST } from "./route";

const USER = {
  id: "u1",
  firebaseUid: "fb-1",
  email: "u1@ags.test",
  displayName: "U1",
  role: "EMPLOYEE" as const,
  departmentId: null,
};

function req() {
  return new Request("http://test/api/presence/heartbeat", { method: "POST" }) as unknown as Parameters<typeof POST>[0];
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/presence/heartbeat", () => {
  it("returns 401 for an unauthenticated caller", async () => {
    doubles.verifyAuth.mockResolvedValue(null);
    const res = await POST(req());
    expect(res.status).toBe(401);
    expect(doubles.recordHeartbeat).not.toHaveBeenCalled();
  });

  it("records a heartbeat, returns the fresh count, and broadcasts a ping", async () => {
    doubles.verifyAuth.mockResolvedValue(USER);
    doubles.getOnlineCount.mockResolvedValue(3);
    const res = await POST(req());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.count).toBe(3);
    expect(doubles.recordHeartbeat).toHaveBeenCalledWith("u1");
    expect(doubles.scheduleBroadcast).toHaveBeenCalledWith([{ topic: "presence:online-users" }]);
  });
});
```

- [ ] **Step 3: Write the count route**

```typescript
// app/api/presence/count/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verifyAuth";
import { getOnlineCount } from "@/lib/presence/onlinePresence";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const count = await getOnlineCount();
  return NextResponse.json({ data: { count } });
}
```

- [ ] **Step 4: Write the count route test**

```typescript
// app/api/presence/count/route.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const doubles = vi.hoisted(() => ({
  verifyAuth: vi.fn(),
  getOnlineCount: vi.fn(),
}));

vi.mock("@/lib/auth/verifyAuth", () => ({ verifyAuth: doubles.verifyAuth }));
vi.mock("@/lib/presence/onlinePresence", () => ({
  getOnlineCount: doubles.getOnlineCount,
}));

import { GET } from "./route";

const USER = {
  id: "u1",
  firebaseUid: "fb-1",
  email: "u1@ags.test",
  displayName: "U1",
  role: "EMPLOYEE" as const,
  departmentId: null,
};

function req() {
  return new Request("http://test/api/presence/count") as unknown as Parameters<typeof GET>[0];
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/presence/count", () => {
  it("returns 401 for an unauthenticated caller", async () => {
    doubles.verifyAuth.mockResolvedValue(null);
    const res = await GET(req());
    expect(res.status).toBe(401);
  });

  it("returns the current count for an authenticated caller", async () => {
    doubles.verifyAuth.mockResolvedValue(USER);
    doubles.getOnlineCount.mockResolvedValue(5);
    const res = await GET(req());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.count).toBe(5);
  });
});
```

- [ ] **Step 5: Run both route tests**

Run: `npm test -- app/api/presence`
Expected: PASS (4/4)

- [ ] **Step 6: Commit**

```bash
git add app/api/presence
git commit -m "feat: add presence heartbeat and count API routes"
```

---

### Task 4: Register the presence broadcast topic

**Files:**
- Modify: `lib/realtime/topics.ts`

**Interfaces:**
- Produces: `realtimeTopics.onlinePresence` (string constant `"presence:online-users"`) — consumed by Task 3 (already referenced there) and Task 5.

- [ ] **Step 1: Add the constant**

If Task 3 was implemented before this task and already relies on `realtimeTopics.onlinePresence`, this constant may already exist from an earlier build attempt — check first. Otherwise, add a new entry to the `realtimeTopics` object in `lib/realtime/topics.ts`, after the existing `minigameStats: "minigames:stats",` line and before the function-based topics (`profile: (userId...`):

```typescript
  minigameStats: "minigames:stats",
  onlinePresence: "presence:online-users",

  profile: (userId: string) => `profile:${userId}`,
```

This is a normal invalidation-ping topic like every other entry in the file — no special comment needed (a prior build attempt at this feature used a raw Supabase Presence channel here instead of a broadcast ping; that approach was rejected in security review, so this is back to the file's standard pattern).

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no new errors

- [ ] **Step 3: Commit**

```bash
git add lib/realtime/topics.ts
git commit -m "feat: register the online-presence broadcast topic"
```

---

### Task 5: `useOnlinePresence` hook

**Files:**
- Create: `lib/hooks/useOnlinePresence.ts` (overwrite if a prior build attempt left a Presence-channel version here — the whole implementation changes)

**Interfaces:**
- Consumes: `useAuth` (`lib/auth/AuthProvider.tsx`), `useApiClient`/`apiFetch` (`lib/hooks/useApiClient.ts`), `useRealtimeChannel` (`lib/hooks/useRealtimeChannel.ts`), `useVisibleInterval` (`lib/hooks/useVisibleInterval.ts`), `realtimeTopics.onlinePresence` (`lib/realtime/topics.ts`, Task 4).
- Produces: `useOnlinePresence(): { count: number | null }` — Task 6 calls this from `app/(dashboard)/layout.tsx`.

- [ ] **Step 1: Write the hook**

```typescript
// lib/hooks/useOnlinePresence.ts
"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useApiClient } from "@/lib/hooks/useApiClient";
import { useRealtimeChannel } from "@/lib/hooks/useRealtimeChannel";
import { useVisibleInterval } from "@/lib/hooks/useVisibleInterval";
import { realtimeTopics } from "@/lib/realtime/topics";

// Matches STALE_AFTER_MS / 2 in lib/presence/onlinePresence.ts — tolerates
// one missed beat before the server would consider this user offline.
const HEARTBEAT_INTERVAL_MS = 45_000;

type CountResponse = { data: { count: number } };

/**
 * Live count of distinct people currently using the app. Server-authoritative
 * (see lib/presence/onlinePresence.ts): a verifyAuth-gated heartbeat route
 * records this user as online in Redis with a TTL, and a broadcast ping (the
 * same "something changed, refetch" idiom every other realtime feature in
 * this app uses — see lib/realtime/broadcast.ts) tells other open tabs to
 * refetch the count via the count route.
 *
 * An earlier version of this hook used a raw client-side Supabase Realtime
 * Presence channel with no server involvement; security review rejected it
 * because this app has no Supabase-recognized identity (it authenticates via
 * Firebase) to gate a private/RLS-protected channel with, so an unauthenticated
 * third party holding only the public anon key could read or spoof it.
 *
 * Returns null until the first heartbeat response arrives, so callers can
 * avoid rendering a misleading "0 online" during the brief connect window.
 */
export function useOnlinePresence(): { count: number | null } {
  const { dbUser } = useAuth();
  const userId = dbUser?.id;
  const { apiFetch } = useApiClient();
  const [count, setCount] = useState<number | null>(null);

  const heartbeat = useCallback(async () => {
    const res = await apiFetch<CountResponse>("/api/presence/heartbeat", { method: "POST" });
    setCount(res.data.count);
  }, [apiFetch]);

  const refetchCount = useCallback(async () => {
    const res = await apiFetch<CountResponse>("/api/presence/count");
    setCount(res.data.count);
  }, [apiFetch]);

  useEffect(() => {
    if (!userId) return;
    heartbeat().catch((err) => console.error("[useOnlinePresence] heartbeat failed", err));
  }, [userId, heartbeat]);

  useVisibleInterval(
    () => {
      heartbeat().catch((err) => console.error("[useOnlinePresence] heartbeat failed", err));
    },
    HEARTBEAT_INTERVAL_MS,
    !!userId,
    { resumeHandledByRealtime: true },
  );

  useRealtimeChannel(userId ? realtimeTopics.onlinePresence : null, () => {
    refetchCount().catch((err) => console.error("[useOnlinePresence] refetch failed", err));
  });

  return { count };
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no new errors

- [ ] **Step 3: Commit**

```bash
git add lib/hooks/useOnlinePresence.ts
git commit -m "feat: add server-authoritative useOnlinePresence hook"
```

---

### Task 6: Wire the indicator into the sidebar

**Files:**
- Modify: `app/(dashboard)/layout.tsx` (if `useOnlinePresence` is already imported and an `OnlineIndicator` already rendered from a prior build attempt, this task is mostly a styling/scope fix — see Steps 2-3)

**Interfaces:**
- Consumes: `useOnlinePresence` (`lib/hooks/useOnlinePresence.ts`, Task 5).

- [ ] **Step 1: Import the hook**

In `app/(dashboard)/layout.tsx`, ensure the import block includes:

```typescript
import { useOnlinePresence } from "@/lib/hooks/useOnlinePresence";
```

- [ ] **Step 2: Add/fix the `OnlineIndicator` component**

Add (or replace an existing one from a prior build attempt with) this component, after `NavGroup` and before `export default function DashboardLayout`:

```typescript
function OnlineIndicator({ count }: { count: number | null }) {
  if (count === null) return null;
  return (
    <div className="hidden lg:block px-3 py-2">
      <div className="flex items-center gap-1.5 text-[11px] text-emerald-300/90">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" aria-hidden="true" />
        <span>{count} online</span>
      </div>
    </div>
  );
}
```

Two changes from a possible prior attempt, both required: `hidden lg:block` (the desktop sidebar and the mobile hamburger drawer both render `sidebarContent`, so without this wrapper the indicator would also appear in the mobile drawer — out of scope per the design's non-goals), and `px-3` instead of `px-4` (matches the `px-3` used by its immediate neighbors — the nav's `NavLink`s and the user footer's inner row — rather than the unrelated brand header's `px-4`).

- [ ] **Step 3: Call the hook and render the indicator**

In `DashboardLayout`, ensure this is present alongside the other hook calls (after `const { user, dbUser } = useAuth();`):

```typescript
  const { count: onlineCount } = useOnlinePresence();
```

And inside `sidebarContent`, ensure `<OnlineIndicator count={onlineCount} />` sits between the divider that follows `</nav>` and the `{/* User footer */}` block:

```typescript
      </nav>

      <div className="mx-4 border-t border-white/[0.07]" />

      <OnlineIndicator count={onlineCount} />

      {/* User footer */}
      <div className="p-3">
```

- [ ] **Step 4: Verify it compiles and lints**

Run: `npx tsc --noEmit && npm run lint`
Expected: no new errors or warnings

- [ ] **Step 5: Commit**

```bash
git add app/\(dashboard\)/layout.tsx
git commit -m "fix: scope online-users indicator to desktop sidebar only"
```

(Use this commit message if amending a prior attempt's placement; use `"feat: show live online-users count in the sidebar footer"` if this is the first time the indicator is wired in.)

---

### Task 7: Full regression + manual verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: all tests pass, including the 4 new `deriveOnlineCount` tests and 4 new route tests

- [ ] **Step 2: Run lint and typecheck**

Run: `npm run lint && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Manual browser verification**

Per this project's local-dev-hits-production-Supabase constraint (see `CLAUDE.md`), use two already-existing real accounts rather than creating new test users:

1. Sign in as one real user in one browser session; confirm the sidebar footer shows `"1 online"` shortly after load (not `"0 online"`, not blank indefinitely).
2. Sign in as a second real user in a second, separate authenticated session (e.g. a second browser profile or an incognito window); confirm both sidebars show `"2 online"` within one heartbeat/broadcast cycle (a few seconds).
3. Open a third tab signed in as either of the same two users; confirm the count stays at `"2"` (per-person, not per-tab).
4. Resize one session's viewport to a mobile width and open the hamburger drawer; confirm the indicator does **not** appear there.
5. Close one of the two sessions' tabs entirely; confirm the other session's count drops to `"1 online"` within the Redis TTL window (~90s).
6. Check the browser console and Network tab on both sessions for errors during the whole sequence — expect none, and confirm `/api/presence/heartbeat`/`/api/presence/count` calls carry the `Authorization: Bearer` header like every other authenticated request in this app.

No test data is created or left behind by this verification (presence entries expire via TTL on their own), so no cleanup step is required.
