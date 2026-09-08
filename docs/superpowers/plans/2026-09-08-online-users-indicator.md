# Online Users Indicator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a live "N online" indicator to the desktop sidebar's lower-left footer area, driven by a Supabase Realtime Presence channel.

**Architecture:** A new `useOnlinePresence()` client hook joins a Presence channel keyed by user id via the existing `getBrowserSupabase()` client, riding the existing socket suspend/resume lifecycle in `lib/realtime/lifecycle.ts` for free. A new `OnlineIndicator` component renders the count in `app/(dashboard)/layout.tsx`'s sidebar footer.

**Tech Stack:** Next.js 16 / React 19 / TypeScript, `@supabase/supabase-js` `^2.106.1` (already a dependency), Vitest.

## Global Constraints

- No new database writes, models, or API routes — this feature is 100% client + Supabase Realtime Presence.
- Count is per-person (keyed by `dbUser.id`), not per-tab/connection.
- Desktop sidebar only — no mobile placement in this pass.
- Count only — no popover, no list of who's online.
- Reuse the existing browser Supabase client (`lib/supabase/browserClient.ts`) and existing socket lifecycle (`lib/realtime/lifecycle.ts`) — do not open a second connection, do not add new lifecycle/suspend code.
- Visual: pulsing emerald dot + `"{count} online"`, `text-[11px] text-emerald-300/90` — reuses the emerald "success/live" semantic already used for the current-user status dot in the same footer. No new color introduced (design system: navy + emerald + neutral only).
- Render nothing while the count is unknown (`count === null`) — never show a misleading "0 online" during the connect window.

---

### Task 1: Presence roster → count helper

**Files:**
- Create: `lib/hooks/derivePresenceCount.ts`
- Test: `lib/hooks/derivePresenceCount.test.ts`

**Interfaces:**
- Produces: `derivePresenceCount(presenceState: Record<string, unknown[]>): number` — later tasks (Task 3) import this exact name/signature.

- [ ] **Step 1: Write the failing test**

```typescript
// lib/hooks/derivePresenceCount.test.ts
import { describe, it, expect } from "vitest";
import { derivePresenceCount } from "./derivePresenceCount";

describe("derivePresenceCount", () => {
  it("returns 0 for an empty roster", () => {
    expect(derivePresenceCount({})).toBe(0);
  });

  it("counts one entry per distinct presence key", () => {
    expect(derivePresenceCount({ "user-1": [{}], "user-2": [{}] })).toBe(2);
  });

  it("counts a key with multiple tracked entries (e.g. two tabs from one person) once", () => {
    expect(derivePresenceCount({ "user-1": [{}, {}] })).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- lib/hooks/derivePresenceCount.test.ts`
Expected: FAIL — `Cannot find module './derivePresenceCount'` (file doesn't exist yet)

- [ ] **Step 3: Write minimal implementation**

```typescript
// lib/hooks/derivePresenceCount.ts
/**
 * Pure roster -> count derivation for the online-users Presence channel.
 * Extracted from useOnlinePresence so it's unit-testable without a real
 * Supabase Realtime socket (Vitest's Node environment can't exercise one).
 */
export function derivePresenceCount(presenceState: Record<string, unknown[]>): number {
  return Object.keys(presenceState).length;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- lib/hooks/derivePresenceCount.test.ts`
Expected: PASS (3/3)

- [ ] **Step 5: Commit**

```bash
git add lib/hooks/derivePresenceCount.ts lib/hooks/derivePresenceCount.test.ts
git commit -m "feat: add presence roster to count helper"
```

---

### Task 2: Register the Presence topic

**Files:**
- Modify: `lib/realtime/topics.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `realtimeTopics.onlinePresence` (string constant `"presence:online-users"`) — Task 3 imports this.

- [ ] **Step 1: Add the constant**

In `lib/realtime/topics.ts`, add a new entry to the `realtimeTopics` object, after the existing `minigameStats: "minigames:stats",` line and before the function-based topics (`profile: (userId...`):

```typescript
  minigameStats: "minigames:stats",

  // Backs a Supabase Realtime *Presence* channel (a synced roster), not a
  // broadcast ping like every other topic above — see useOnlinePresence.
  onlinePresence: "presence:online-users",

  profile: (userId: string) => `profile:${userId}`,
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no new errors

- [ ] **Step 3: Commit**

```bash
git add lib/realtime/topics.ts
git commit -m "feat: register the online-presence realtime topic"
```

---

### Task 3: `useOnlinePresence` hook

**Files:**
- Create: `lib/hooks/useOnlinePresence.ts`

**Interfaces:**
- Consumes: `getBrowserSupabase` (`lib/supabase/browserClient.ts`), `realtimeTopics.onlinePresence` (`lib/realtime/topics.ts`, Task 2), `useAuth` (`lib/auth/AuthProvider.tsx`, exposes `dbUser: { id: string } | null`), `derivePresenceCount` (`lib/hooks/derivePresenceCount.ts`, Task 1).
- Produces: `useOnlinePresence(): { count: number | null }` — Task 4 calls this from `app/(dashboard)/layout.tsx`.

- [ ] **Step 1: Write the hook**

```typescript
// lib/hooks/useOnlinePresence.ts
"use client";

import { useEffect, useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase/browserClient";
import { realtimeTopics } from "@/lib/realtime/topics";
import { useAuth } from "@/lib/auth/AuthProvider";
import { derivePresenceCount } from "@/lib/hooks/derivePresenceCount";

/**
 * Live count of distinct people currently using the app, via a Supabase
 * Realtime Presence channel (a synced roster, not a broadcast ping — see
 * lib/realtime/topics.ts). Keyed by user id so multiple tabs from the same
 * person collapse to one roster entry.
 *
 * Rides the existing shared-socket lifecycle (lib/realtime/lifecycle.ts):
 * when a tab goes hidden past the idle grace period, the socket disconnects
 * and this user drops out of every other client's count automatically; on
 * reconnect the channel auto-rejoins and re-tracks. No new lifecycle code
 * needed — deliberately does NOT call pinRealtimeAlive().
 *
 * Returns null until the first presence sync arrives, so callers can avoid
 * rendering a misleading "0 online" during the brief connect window.
 */
export function useOnlinePresence(): { count: number | null } {
  const { dbUser } = useAuth();
  const userId = dbUser?.id;
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    if (!userId) return;

    const supabase = getBrowserSupabase();
    const channel = supabase.channel(realtimeTopics.onlinePresence, {
      config: { presence: { key: userId } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        setCount(derivePresenceCount(channel.presenceState()));
      })
      .subscribe((status) => {
        // Re-track on every (re)join, not just the first — this is what
        // survives the shared socket's idle-hidden suspend/resume cycle.
        // Mirrors lifecycle.ts's own "resync on wake" idiom for broadcast
        // channels; this is the Presence equivalent.
        if (status === "SUBSCRIBED") {
          channel.track({});
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return { count };
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no new errors

- [ ] **Step 3: Commit**

```bash
git add lib/hooks/useOnlinePresence.ts
git commit -m "feat: add useOnlinePresence hook"
```

---

### Task 4: Wire the indicator into the sidebar

**Files:**
- Modify: `app/(dashboard)/layout.tsx`

**Interfaces:**
- Consumes: `useOnlinePresence` (`lib/hooks/useOnlinePresence.ts`, Task 3).

- [ ] **Step 1: Import the hook**

In `app/(dashboard)/layout.tsx`, add to the existing import block (near the `NotificationsController` import):

```typescript
import { useOnlinePresence } from "@/lib/hooks/useOnlinePresence";
```

- [ ] **Step 2: Add the `OnlineIndicator` component**

Add this new component after `NavGroup` and before `export default function DashboardLayout`:

```typescript
function OnlineIndicator({ count }: { count: number | null }) {
  if (count === null) return null;
  return (
    <div className="px-4 py-2">
      <div className="flex items-center gap-1.5 text-[11px] text-emerald-300/90">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" aria-hidden="true" />
        <span>{count} online</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Call the hook and render the indicator**

In `DashboardLayout`, add alongside the other hook calls (after `const { user, dbUser } = useAuth();`):

```typescript
  const { count: onlineCount } = useOnlinePresence();
```

Then, inside `sidebarContent`, insert `<OnlineIndicator count={onlineCount} />` between the divider that follows `</nav>` and the `{/* User footer */}` block:

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
git commit -m "feat: show live online-users count in the sidebar footer"
```

---

### Task 5: Full regression + manual verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: all tests pass, including the 3 new `derivePresenceCount` tests

- [ ] **Step 2: Run lint and typecheck**

Run: `npm run lint && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Manual browser verification**

Per this project's local-dev-hits-production-Supabase constraint (see `CLAUDE.md`), use two already-existing real accounts rather than creating new test users:

1. Sign in as one real user in one browser session; confirm the sidebar footer shows `"1 online"` shortly after load (not `"0 online"`, not blank indefinitely).
2. Sign in as a second real user in a second, separate authenticated session (e.g. a second browser profile or an incognito window); confirm both sidebars now show `"2 online"`.
3. Open a third tab signed in as either of the same two users; confirm the count stays at `"2"` (per-person, not per-tab).
4. Close the third tab; confirm the count is unaffected (still `"2"`).
5. Close one of the two sessions' tab entirely; confirm the other session's count drops to `"1 online"`.
6. Check the browser console on both sessions for errors during the whole sequence — expect none.

No test data is created or left behind by this verification (no posts/comments/records — presence is ephemeral and clears itself on disconnect), so no cleanup step is required.
