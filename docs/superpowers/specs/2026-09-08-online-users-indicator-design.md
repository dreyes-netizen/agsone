# Online Users Indicator — Design

**Date:** 2026-09-08
**Status:** Approved

## Summary

Add a small, real-time indicator to the desktop sidebar's lower-left footer area showing how many people are currently online and using AGS One (e.g. "14 online"). Built on Supabase Realtime Presence — a roster primitive distinct from the invalidation-ping broadcasts the app already uses elsewhere — so the count updates live with no new database writes and no polling.

## Goals

- Show a live count of distinct people currently using the app, visible in the desktop sidebar's lower-left footer area.
- Count is per-person, not per-tab/connection (a user with two tabs open counts once).
- "Online" naturally means "has the app open and the tab is visible/foregrounded" — a backgrounded tab should drop out of the count after the app's existing idle-hidden grace period, and rejoin automatically when the tab is foregrounded again.
- Reuse the existing Realtime socket/lifecycle infrastructure (`lib/realtime/lifecycle.ts`, `lib/supabase/browserClient.ts`) rather than introducing a second connection or a new backend surface.

## Non-goals

- No mobile placement — the mobile layout has no equivalent "lower left" footer (top bar + bottom nav instead); out of scope for this pass. (The desktop sidebar's `sidebarContent` is also reused verbatim inside the mobile hamburger drawer, so the indicator is explicitly hidden there with a `hidden lg:block` wrapper rather than relying on placement alone.)
- No list of *who* is online — count only (per the approved design decision), no popover/click interaction.
- No historical/analytics tracking of online activity — this is a live, ephemeral indicator, not a logged metric.

## Revision note (post-security-review)

The original design used a client-side Supabase Realtime **Presence** channel with no server involvement. Security review (`sentinal`) found this insecure in this app's specific setup: this app authenticates with Firebase, not Supabase Auth, so there is no Supabase-recognized identity to gate a `private`/RLS-protected channel with, and an ungated channel is reachable by anyone holding the public anon key — no AGS One login required — to read real employee IDs' online status or spoof presence. Fixing this properly (Supabase Realtime Authorization: mint a Supabase JWT from the verified Firebase user, `private: true` channel, RLS policy) would introduce a JWT/RLS trust mechanism this app has never used anywhere else, with real risk of a subtly wrong policy.

The design below replaces client Presence with a **server-authoritative heartbeat**, matching this codebase's own established realtime idiom (see `lib/realtime/broadcast.ts`'s file comment: an authenticated API route is the source of every payload; Realtime only ever carries an empty "something changed" ping) instead of introducing a new trust mechanism. This does add two small new API routes and a Redis write, which the original design deliberately avoided — accepted as the smaller risk once the alternative (open Presence) turned out to be a real vulnerability, not a hypothetical one.

## Architecture

A verifyAuth-gated API route records "this user is online" with a TTL in Redis (via `@upstash/redis`, already a dependency — see `lib/guardrails/rateLimiter.ts` for the existing usage/fallback pattern) every time a client calls it. A client-side hook, `useOnlinePresence()`, calls that route on mount and on a visibility-aware interval while the tab is foregrounded (via the existing `useVisibleInterval` hook), and also listens for a broadcast ping (the existing `useRealtimeChannel` / `scheduleBroadcast` idiom) so *other* already-open tabs refresh their count promptly instead of waiting for their own next heartbeat tick.

Because each Redis entry has a TTL, a user who stops heartbeating (tab closed, or backgrounded past `useVisibleInterval`'s pause) ages out of the count automatically with no cleanup job needed — the same self-expiring semantic the original Presence-based design had, achieved server-side instead of via the Realtime socket's own connection lifecycle.

## Components

- **`lib/presence/deriveOnlineCount.ts`** (new) — pure function `deriveOnlineCount(lastSeenByUser: Record<string, number>, nowMs: number, staleAfterMs: number): number`, counting entries seen within the staleness window. Backs the in-memory dev fallback and is directly unit-testable.
- **`lib/presence/onlinePresence.ts`** (new) — `recordHeartbeat(userId: string): Promise<void>` and `getOnlineCount(): Promise<number>`. Uses Redis `SET ... EX` (TTL-based expiry, one key per user) when `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` are configured, an in-memory `Map` fallback otherwise — mirroring `lib/guardrails/rateLimiter.ts`'s existing fallback pattern exactly.
- **`app/api/presence/heartbeat/route.ts`** (new) — `POST`, `verifyAuth`-gated (any authenticated employee, no role restriction). Records the heartbeat, returns the fresh count, and fires `scheduleBroadcast([{ topic: realtimeTopics.onlinePresence }])` so other open tabs know to refetch.
- **`app/api/presence/count/route.ts`** (new) — `GET`, `verifyAuth`-gated. Returns the current count only; this is what a broadcast ping triggers other tabs to call.
- **`lib/realtime/topics.ts`** (modified) — add `onlinePresence: "presence:online-users"`, a normal broadcast-ping topic like every other entry in the file (no special-casing needed now that Presence is gone).
- **`lib/hooks/useOnlinePresence.ts`** (new) — the hook. No arguments; reads the current user from `useAuth()` internally. Returns `{ count: number | null }` — `null` until the first heartbeat response arrives, so the UI never renders a misleading "0 online" during the brief connect window.
- **`app/(dashboard)/layout.tsx`** (modified) — calls `useOnlinePresence()` once, renders a new small `OnlineIndicator` component (colocated alongside the existing `NavLink`/`NavGroup` helper components) in a new row between the nav's bottom divider and the existing "User footer" block. Renders nothing while `count === null`; wrapped `hidden lg:block` so it does not render inside the mobile drawer that reuses the same `sidebarContent`.

`OnlineIndicator` markup/styling: a pulsing emerald dot + `"{count} online"` text, `text-[11px] text-emerald-300/90`, `px-3` (matching the `px-3` used by its immediate neighbors — the nav's `NavLink`s and the user footer's inner row — rather than the `px-4` used by the unrelated brand header) — reusing the emerald "success/live" semantic already used for the current-user status dot in the same footer, so no new color is introduced (design system constraint: 2-3 colors, navy + emerald + neutral).

## Data flow

1. `DashboardLayout` already has `dbUser` from `useAuth()`. `useOnlinePresence()` is called once there; its `count` is passed to `OnlineIndicator`.
2. Once `dbUser?.id` is available, the hook immediately `POST`s `/api/presence/heartbeat` and sets `count` from the response.
3. `useVisibleInterval` re-runs that same heartbeat every 45s while the tab is visible (paused while hidden — a backgrounded tab has no reason to keep marking itself online).
4. `useRealtimeChannel(realtimeTopics.onlinePresence, ...)` listens for the ping any client's heartbeat broadcasts; on receipt, it `GET`s `/api/presence/count` and updates `count` — this is what makes *other* open tabs' counts update promptly rather than drifting for up to 45s.
5. Server side: `recordHeartbeat` writes a TTL'd Redis key (or in-memory entry in dev); `getOnlineCount` counts live keys (Redis `KEYS ags_presence:*` — acceptable at this app's scale, an internal single-company platform, not a large multi-tenant keyspace) or, in the fallback path, calls `deriveOnlineCount` against the in-memory map.

## Error handling

- If a heartbeat or count fetch fails (network issue, Redis outage), the hook logs via `console.error` and leaves `count` at its last known value — no error is surfaced to the user, no toast. This matches the codebase's existing realtime philosophy ("Realtime is a freshness accelerator, never a mutation dependency," `lib/realtime/broadcast.ts`) extended to this feature's own heartbeat.
- `scheduleBroadcast` already never throws (existing guarantee) — a failed broadcast just means other tabs wait for their own next 45s heartbeat tick instead of updating instantly; never a hard failure.
- The two new routes are the only new backend failure surface. Both are simple, single-purpose, `verifyAuth`-gated reads/writes against Redis (or the in-memory fallback) — no Prisma/Postgres involvement at all.

## Testing

- **Unit test:** `deriveOnlineCount` (pure, in `lib/presence/deriveOnlineCount.ts`) — trivially testable in isolation.
- **Route tests:** `app/api/presence/heartbeat/route.test.ts` and `app/api/presence/count/route.test.ts`, mirroring the existing `vi.hoisted` + `vi.mock` convention used throughout `app/api/**/route.test.ts` (e.g. `app/api/admin/accounts/route.test.ts`) — mock `verifyAuth`, `lib/presence/onlinePresence`, and `scheduleBroadcast`.
- **Manual verification (required before shipping, per this project's local-dev-hits-production-Supabase constraint):** open the app in two separate authenticated sessions (e.g. two browser profiles) as two different real users, confirm both sidebars show "2 online" within one heartbeat/broadcast cycle; close one session's tab, confirm the other drops to "1 online" within the Redis TTL window; open a third tab as one of the same two users and confirm the count does not increase (per-person, not per-tab); confirm the indicator does **not** appear in the mobile hamburger drawer at a narrow viewport.
