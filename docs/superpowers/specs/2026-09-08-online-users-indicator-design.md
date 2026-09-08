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

- No mobile placement — the mobile layout has no equivalent "lower left" footer (top bar + bottom nav instead); out of scope for this pass.
- No list of *who* is online — count only (per the approved design decision), no popover/click interaction.
- No historical/analytics tracking of online activity — this is a live, ephemeral indicator, not a logged metric.
- No DB heartbeat mechanism — Presence is the sole source of truth for this feature.

## Architecture

A single client-side hook, `useOnlinePresence()`, joins a Supabase Realtime **Presence** channel via the existing browser Supabase client (`getBrowserSupabase()`). Presence is a different Realtime primitive from the broadcast "something changed" pings the rest of the app uses (`lib/realtime/broadcast.ts` / `useRealtimeChannel`): instead of one-off events, a Presence channel maintains a live, server-synced roster of who is currently joined, keyed however the client chooses.

Critically, this rides the *existing* socket lifecycle in `lib/realtime/lifecycle.ts` for free: that module already disconnects the shared Realtime socket after a tab has been hidden past `REALTIME_IDLE_GRACE_MS` (120s), and reconnects (with all channels auto-rejoining) when the tab is foregrounded again. Because Presence is tied to the socket's channel membership, a hidden-then-disconnected user is automatically removed from the roster (others see a "leave" event, count decrements), and a returning user is automatically re-added once they rejoin. No new lifecycle code is needed — this is a natural consequence of infrastructure that already exists for other realtime features.

## Components

- **`lib/realtime/topics.ts`** (modified) — add `onlinePresence: "presence:online-users"` to the `realtimeTopics` object, with a short comment clarifying it backs a Presence channel, not a broadcast topic (the file's header comment currently describes broadcast-only topics).
- **`lib/hooks/useOnlinePresence.ts`** (new) — the hook. No arguments; reads the current user from `useAuth()` internally. Returns `{ count: number | null }` — `null` until the first presence sync arrives, so the UI never renders a misleading "0 online" during the brief connect window.
- **`app/(dashboard)/layout.tsx`** (modified) — calls `useOnlinePresence()` once, renders a new small `OnlineIndicator` component (colocated alongside the existing `NavLink`/`NavGroup` helper components in the same file, matching how those are structured) in a new row between the nav's bottom divider and the existing "User footer" block. Renders nothing while `count === null`.

`OnlineIndicator` markup/styling: a pulsing emerald dot + `"{count} online"` text, `text-[11px] text-emerald-300/90` — reusing the emerald "success/live" semantic already used for the current-user status dot in the same footer, so no new color is introduced (design system constraint: 2-3 colors, navy + emerald + neutral).

## Data flow

1. `DashboardLayout` already has `dbUser` from `useAuth()`. `useOnlinePresence()` is called once there; its `count` is passed to `OnlineIndicator`.
2. Once `dbUser?.id` is available, the hook opens `supabase.channel(realtimeTopics.onlinePresence, { config: { presence: { key: dbUser.id } } })` — keyed by the user's id (not a random connection id), so multiple tabs from the same person collapse to one roster entry.
3. On every `SUBSCRIBED` status callback — both the initial join and any automatic rejoin after the shared socket reconnects from an idle-hidden suspend — the hook calls `channel.track({})`. Re-tracking on every (re)join, not just the first, is what makes this survive the app's existing suspend/resume cycle correctly; it mirrors the "resync on wake" idiom `lifecycle.ts` already uses for broadcast channels (see `subscribeResync`).
4. On `channel.on("presence", { event: "sync" }, ...)`, the hook reads `channel.presenceState()` and sets `count = Object.keys(state).length`.
5. On unmount, the hook calls `supabase.removeChannel(channel)`. This is safe here — unlike the broadcast channels in `lifecycle.ts`, which deliberately avoid `removeChannel` to survive idle-hidden *suspends*, this is a genuine component-unmount teardown, not a suspend/resume cycle.
6. The hook does **not** call `pinRealtimeAlive()` — the socket disconnecting on a hidden tab, and this user consequently dropping out of the online count, is the desired behavior, not something to prevent.

## Error handling

- If Realtime is unreachable (network issue, misconfigured env vars, Supabase outage), the hook simply never receives a `sync` event; `count` stays `null` and `OnlineIndicator` renders nothing. No error is surfaced to the user, no toast, no console noise beyond whatever the Supabase client already logs in dev via the existing `logger` config in `browserClient.ts`.
- This feature adds no new API route, no new Prisma model, and no new database writes — there is no new backend failure surface. The only new failure mode is "the live count doesn't render," which degrades to the pre-feature state (footer looks exactly as it does today).

## Testing

- **Unit test:** extract the roster→count derivation as a small pure function (e.g. `derivePresenceCount(state: Record<string, unknown[]>): number` returning `Object.keys(state).length`) so it's trivially unit-testable in isolation from the socket/channel wiring, which Vitest's Node environment cannot exercise realistically.
- **Manual verification (required before shipping, per this project's local-dev-hits-production-Supabase constraint):** open the app in two separate authenticated sessions (e.g. two browser profiles) as two different real users, confirm both sidebars show "2 online"; close one session's tab, confirm the other drops to "1 online" within the idle-hidden grace period (~120s) or immediately if the tab is closed outright (socket closes right away, no grace period needed for an actual close); open a third tab as one of the same two users and confirm the count does not increase (per-person, not per-tab).
