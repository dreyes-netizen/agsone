# Top Performers Page — Two-Column Sidebar Design

## Goal

Replace the narrow single-column layout on the Top Performers page (`/leaderboard`) with a two-column layout that fills wide screens. The right sidebar surfaces four contextual widgets: Your Stats, Period Summary, Top Departments, and Recent Achievers.

## Architecture

Two files change:
- `app/(dashboard)/leaderboard/page.tsx` — layout restructure + new state + new fetches
- `app/api/leaderboard/achievers/route.ts` — new GET endpoint (created)

No schema changes. No existing API changes.

## Layout

Wrap the page body in a two-column grid matching the dashboard pattern:

```
grid-cols-1 lg:grid-cols-[1fr_300px] gap-6
```

**Left column:** Existing header, filters, and rankings list — no changes to their markup or logic.

**Right column:** Four stacked cards in a `sticky top-6 self-start` wrapper.

## Sidebar Cards

### Card 1 — Your Stats

**Data source:** `GET /api/me` — fetched once on mount alongside existing calls.

**Displays:**
- Avatar (or initials fallback), display name, department name
- Points balance (total)
- Level badge (e.g. "Lv 5")
- Streak (e.g. "12d streak")

**Behaviour:** Static — does not change when period or department filter changes.

---

### Card 2 — Period Summary

**Data source:** Derived client-side from the `entries` array already fetched for the rankings list.

**Displays:**
- Participant count: `entries.length` participants
- Total points: sum of all `entry.points`
- Average points: `Math.round(totalPoints / entries.length)` (hidden when entries is empty)

**Behaviour:** Reacts live to period (monthly / all-time) and department filter changes because it derives from `entries`.

---

### Card 3 — Top Departments

**Data source:** Derived client-side from `entries`.

**Logic:**
```
group entries by entry.department
sum points per group
sort desc by total points
take top 5
```

Entries with `department === null` are grouped under "Unknown" and shown last.

**Displays:** Up to 5 department rows. Each row: dept name, total points, a proportional fill bar (width = deptTotal / max deptTotal × 100%).

**Behaviour:** Reacts live to period and department filter changes (same derivation as Card 2). When a single department is selected via the filter, only that department shows — the card still renders with 1 row, which is fine.

---

### Card 4 — Recent Achievers

**Data source:** `GET /api/leaderboard/achievers` — fetched once on mount.

**Displays:** Up to 5 recent achievement events, sorted newest first. Each row: avatar, display name, achievement label, time-ago string (e.g. "3 days ago").

**Achievement types surfaced:**
- `UserBadge` records with `awardedAt` within the last 30 days → label = badge name
- `MilestoneAward` records with `awardedAt` within the last 30 days → label mapped from `MilestoneType`:
  - `BIRTHDAY` → "Birthday"
  - `WORK_ANNIVERSARY_1` → "1-Year Anniversary"
  - `WORK_ANNIVERSARY_3` → "3-Year Anniversary"
  - `WORK_ANNIVERSARY_5` → "5-Year Anniversary"
  - `WORK_ANNIVERSARY_10` → "10-Year Anniversary"

**Behaviour:** Static — does not react to period or department filter. Shows a "No recent achievements" empty state when the array is empty.

## New API Endpoint

### `GET /api/leaderboard/achievers`

**Auth:** `verifyAuth` — same pattern as all other leaderboard routes.

**Query:** No parameters.

**Logic:**
1. Query `UserBadge` where `awardedAt >= 30 days ago`, include `user` (id, displayName, avatarUrl) and `badge` (name). Take 20.
2. Query `MilestoneAward` where `awardedAt >= 30 days ago`, include `user` (id, displayName, avatarUrl). Take 20.
3. Map both to a common `Achiever` shape.
4. Merge, sort by `achievedAt` desc, take first 5.

**Response shape:**
```typescript
type Achiever = {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  label: string;       // badge name or milestone label
  achievedAt: string;  // ISO date string
};

{ data: Achiever[] }
```

## Loading States

All four sidebar cards show a skeleton (animated `bg-zinc-100` placeholder) while their data is loading. Cards 2 and 3 share the same loading flag as the main list (`loading`). Cards 1 and 4 have their own loading flags (`profileLoading`, `achieversLoading`).

## Empty States

| Card | Empty condition | Message |
|---|---|---|
| Your Stats | `/api/me` fails | "—" for each stat |
| Period Summary | `entries.length === 0` | Hidden (no data to summarise) |
| Top Departments | `entries.length === 0` | Hidden |
| Recent Achievers | `achievers.length === 0` | "No recent achievements" |
