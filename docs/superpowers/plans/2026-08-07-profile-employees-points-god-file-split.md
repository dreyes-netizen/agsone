# Split profile, admin/employees & admin/points god-files Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split `app/(dashboard)/profile/page.tsx` (1025 lines), `app/admin/employees/page.tsx` (867 lines), and `app/admin/points/page.tsx` (847 lines) into smaller, single-responsibility files with zero behavior change, closing **AGSON-39** (the three remaining god-files after AGSON-31's food/medicine split, tracked in `docs/superpowers/plans/2026-08-06-food-medicine-god-file-split.md`).

**Architecture:** Presentational extraction, not a state-ownership rewrite — same approach as AGSON-31. Rule for every task unless explicitly stated otherwise: **state, effects, and handlers stay declared in the parent `page.tsx` exactly as they are today (same variable names, same `setState` calls, same effect dependency arrays) — only JSX (render output) moves into new child components, which receive the state values, setters, and handlers they need as explicit props.** The only sanctioned exceptions (each called out explicitly in its task, each verified via full-file read that the slice has zero external readers/writers) are: `MinigamesStatsCard` and `PlayerAvatar` (Task 2), `NotificationsTab` (Task 11), and the `showUploadGuide` toggle owned locally by `EmployeeToolbar` (Task 17).

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, Tailwind v4. No test runner exists in this repo (`AGSON-20 — Add automated test coverage` is a separate, not-yet-started backlog item) — every task's verification step uses `npx tsc --noEmit`, `npm run lint`, and a manual click-through in the dev server instead of automated tests, matching AGSON-31.

## Global Constraints

- Every extracted component file starts with `"use client";`? No — only the top-level `page.tsx` files need `"use client"` (App Router convention: a Client Component's imported children inherit client-ness without their own directive). Do not add `"use client"` to files under `components/`, except `MinigamesStatsCard.tsx` and `PlayerAvatar.tsx` in Task 2, which own their own hooks and therefore do need it.
- Every new component is a plain named export (`export function Foo(props: FooProps) { ... }`), not `export default`.
- Never rename an existing state variable, setter, or handler while moving it — each task's diff should be "code moved + import/prop wiring added," not "code moved and renamed."
- No `<img>` → `next/image` conversions, no Tailwind class changes, no aria-label additions, no new error handling — this is a pure structural refactor. Two sanctioned behavior-level changes exist in this whole plan, both dead-code removals, both called out explicitly where they occur: the unused `Lock` import in `profile/page.tsx` (Task 13) and the unused `deleteConfirmId`/`setDeleteConfirmId` state in `admin/employees/page.tsx` (Task 21). Leave every other oddity you notice — don't fix it here.
- After EVERY task: run `npx tsc --noEmit` (must be clean) and `npm run lint` (same warning count as before the task, zero new errors) before committing.
- Commit after each task with a `refactor:` prefix.
- For JSX-heavy tasks below, steps say "paste `page.tsx` lines X–Y verbatim, replacing: ..." — do the literal copy-paste from the *current* file (line numbers may drift slightly across tasks within the same Part since earlier tasks delete lines; re-locate the block by the surrounding code shown, not by a stale absolute number, if a task starts more than 2-3 tasks after the one that cited it).

---

## Part A — `app/(dashboard)/profile/page.tsx`

### Task 1: Extract shared types and pure helpers

**Files:**
- Create: `app/(dashboard)/profile/types.ts`
- Create: `app/(dashboard)/profile/utils.ts`
- Modify: `app/(dashboard)/profile/page.tsx:12-127` (remove, replace with imports)

**Interfaces:**
- Produces from `types.ts`: `UserBadge`, `ShoutoutEntry`, `UserProfile`, `PointTx`, `RedemptionTx`, `PointsData`, `TimelineEntry` (all exported types).
- Produces from `utils.ts`: `getDaysUntil(isoDate: string): number`, `getAnniversaryYear(hireDate: string): number`, `ordinal(n: number): string`, `getTenure(hireDate: string): string`, `txTypeLabel: Record<string, {label,color}>`, `CATEGORY_BADGE: Record<string, {label,style}>` (all exported).

- [ ] **Step 1: Create `types.ts`**

Move lines 12–77 of `page.tsx` verbatim, adding `export` to each:

```ts
export type UserBadge = {
  id: string;
  awardedAt: string;
  badge: { name: string; description: string | null };
};

export type ShoutoutEntry = {
  id: string;
  post: {
    id: string;
    content: string;
    createdAt: string;
    author: {
      id: string;
      displayName: string;
      avatarUrl: string | null;
      department: { name: string } | null;
    };
  };
};

export type UserProfile = {
  id: string;
  displayName: string;
  email: string;
  avatarUrl: string | null;
  role: string;
  pointsBalance: number;
  level: number;
  birthday: string | null;
  hireDate: string | null;
  bio: string | null;
  skills: string[];
  department: { id: string; name: string } | null;
  userBadges: UserBadge[];
};

export type PointTx = {
  id: string;
  amount: number;
  type: string;
  note: string | null;
  category: string | null;
  activity: string | null;
  createdAt: string;
  fromUser: { displayName: string } | null;
};

export type RedemptionTx = {
  id: string;
  pointsSpent: number;
  createdAt: string;
  reward: { name: string };
};

export type PointsData = {
  balance: number;
  level: number;
  totalEarned: number;
  transactions: PointTx[];
  redemptions: RedemptionTx[];
};

export type TimelineEntry =
  | { kind: "earn"; data: PointTx }
  | { kind: "redeem"; data: RedemptionTx };
```

- [ ] **Step 2: Create `utils.ts`**

Move lines 79–127 of `page.tsx` verbatim, adding `export` to each:

```ts
export function getDaysUntil(isoDate: string): number {
  const now = new Date();
  const d = new Date(isoDate);
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const next = new Date(now.getFullYear(), d.getMonth(), d.getDate());
  if (next.getTime() < todayMidnight.getTime()) next.setFullYear(now.getFullYear() + 1);
  return Math.round((next.getTime() - todayMidnight.getTime()) / (1000 * 60 * 60 * 24));
}

export function getAnniversaryYear(hireDate: string): number {
  const now = new Date();
  const hire = new Date(hireDate);
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const thisYearDate = new Date(now.getFullYear(), hire.getMonth(), hire.getDate());
  return thisYearDate.getTime() < todayMidnight.getTime()
    ? now.getFullYear() + 1 - hire.getFullYear()
    : now.getFullYear() - hire.getFullYear();
}

export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function getTenure(hireDate: string): string {
  const years = Math.floor((Date.now() - new Date(hireDate).getTime()) / (1000 * 60 * 60 * 24 * 365));
  if (years < 1) return "< 1 yr at AGS";
  return `${years} yr${years > 1 ? "s" : ""} at AGS`;
}

export const txTypeLabel: Record<string, { label: string; color: string }> = {
  MANUAL_AWARD: { label: "Award",      color: "text-emerald-600" },
  KPI:          { label: "KPI",        color: "text-navy-600" },
  CONTEST:      { label: "Contest",    color: "text-yellow-600" },
  REDEMPTION:   { label: "Redemption", color: "text-rose-500" },
  GAME_WIN:     { label: "Game Win",   color: "text-emerald-500" },
  GAME_SPEND:   { label: "Game",       color: "text-orange-500" },
  REFUND:       { label: "Refund",     color: "text-teal-600" },
  MILESTONE:    { label: "Milestone",  color: "text-amber-600" },
  DEDUCTION:    { label: "Violation Deduction", color: "text-red-600" },
};

export const CATEGORY_BADGE: Record<string, { label: string; style: string }> = {
  PERFORMANCE: { label: "Performance", style: "bg-violet-50 text-violet-700" },
  TEAMWORK:    { label: "Teamwork",    style: "bg-blue-50 text-blue-700" },
  INNOVATION:  { label: "Innovation",  style: "bg-amber-50 text-amber-700" },
  LEADERSHIP:  { label: "Leadership",  style: "bg-emerald-50 text-emerald-700" },
};
```

- [ ] **Step 3: Update `page.tsx`**

Delete lines 12–127. Add after the existing `import { RoleBadge } from "@/components/RoleBadge";` line:

```ts
import type { UserBadge, ShoutoutEntry, UserProfile, PointTx, RedemptionTx, PointsData, TimelineEntry } from "./types";
import { getDaysUntil, getAnniversaryYear, ordinal, getTenure, txTypeLabel, CATEGORY_BADGE } from "./utils";
```

- [ ] **Step 4: Verify**

Run `npx tsc --noEmit` — expect clean (no errors referencing `profile/page.tsx`; the three local components `CompletenessBar`/`MinigamesStatsCard`/`PlayerAvatar`, still in `page.tsx` at this point, must still resolve `UserProfile` via the new import). Run `npm run lint` — no new errors. Pure code motion, no visual check needed.

- [ ] **Step 5: Commit**

```bash
git add "app/(dashboard)/profile/types.ts" "app/(dashboard)/profile/utils.ts" "app/(dashboard)/profile/page.tsx"
git commit -m "refactor: extract profile page types and helpers to sibling files"
```

---

### Task 2: Extract self-contained widgets — `CompletenessBar`, `MinigamesStatsCard`, `PlayerAvatar`

**Files:**
- Create: `app/(dashboard)/profile/components/CompletenessBar.tsx`
- Create: `app/(dashboard)/profile/components/MinigamesStatsCard.tsx`
- Create: `app/(dashboard)/profile/components/PlayerAvatar.tsx`
- Modify: `app/(dashboard)/profile/page.tsx:129-227` (remove all three, replace usages with imports)

**Interfaces:**
- `CompletenessBar({ profile }: { profile: UserProfile })` — pure, no exception.
- `MinigamesStatsCard()` — **exception**: owns its own `useState`/`useEffect`/`useApiClient`/`useRouter`; verified via Task 1's full-file read that `s` (its local state) has zero readers/writers outside lines 183–215 of the original file. Takes no props.
- `PlayerAvatar({ name, url }: { name: string; url: string | null })` — **exception**: owns its own `errored` `useState`, used only for its own `onError` fallback, zero external readers/writers. Takes `name`/`url` as props (unchanged from today — it's already called with props at its usage site).

- [ ] **Step 1: Create `CompletenessBar.tsx`**

Move lines 129–181 verbatim, adding `export` and importing the type:

```tsx
import type { UserProfile } from "../types";

export function CompletenessBar({ profile }: { profile: UserProfile }) {
  const items = [
    { label: "Display name", done: !!profile.displayName },
    { label: "Profile photo", done: !!profile.avatarUrl },
    { label: "Birthday", done: !!profile.birthday, hint: "Set it on this page" },
    { label: "Department", done: !!profile.department, hint: "Contact HR to assign" },
  ];
  const doneCount = items.filter((i) => i.done).length;
  const pct = Math.round((doneCount / items.length) * 100);
  if (pct === 100) return null;

  return (
    <div className="bg-white rounded-card border border-table-border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-700">Profile completeness</p>
        <span className="text-sm font-bold text-navy-600">{pct}%</span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-1.5">
        <div
          className="bg-navy-500 h-1.5 rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <span
            key={item.label}
            className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border font-medium ${
              item.done
                ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                : "bg-gray-50 border-gray-200 text-gray-500"
            }`}
            title={!item.done && item.hint ? item.hint : undefined}
          >
            {item.done ? (
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
            {item.label}
          </span>
        ))}
      </div>
      <p className="text-xs text-gray-500">
        Complete your profile to unlock features like milestone rewards and birthday bonuses.
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Create `MinigamesStatsCard.tsx`**

Move lines 183–215 verbatim, adding `"use client";` at the top (it owns hooks) and `export`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useApiClient } from "@/lib/hooks/useApiClient";

export function MinigamesStatsCard() {
  const { apiFetch } = useApiClient();
  const router = useRouter();
  const [s, setS] = useState<{ wins: number; losses: number; draws: number; winRate: number; currentStreak: number; total: number } | null>(null);

  useEffect(() => {
    apiFetch<{ data: typeof s }>("/api/minigames/stats").then((r) => setS(r.data)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!s || s.total === 0) return null;

  return (
    <button
      onClick={() => router.push("/minigames/stats")}
      className="w-full text-left bg-white rounded-card border border-table-border px-5 py-4 hover:border-gray-300 transition-colors"
    >
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-gray-800 flex items-center gap-2"><span aria-hidden="true">🎮</span> Minigames</p>
        <span className="text-xs text-indigo-600 font-medium">View stats →</span>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-sm"><span className="font-bold text-emerald-600">{s.wins}</span> <span className="text-gray-500">W</span></span>
        <span className="text-sm"><span className="font-bold text-rose-500">{s.losses}</span> <span className="text-gray-500">L</span></span>
        <span className="text-sm"><span className="font-bold text-gray-500">{s.draws}</span> <span className="text-gray-500">D</span></span>
        <span className="text-sm"><span className="font-bold text-indigo-600">{s.winRate}%</span> <span className="text-gray-500">win rate</span></span>
        {s.currentStreak > 0 && (
          <span className="text-xs font-semibold text-orange-600 bg-orange-50 rounded-full px-2 py-0.5"><span aria-hidden="true">🔥</span> {s.currentStreak}-win streak</span>
        )}
      </div>
    </button>
  );
}
```

- [ ] **Step 3: Create `PlayerAvatar.tsx`**

Move lines 217–227 verbatim, adding `"use client";` and `export`:

```tsx
"use client";

import { useState } from "react";

export function PlayerAvatar({ name, url }: { name: string; url: string | null }) {
  const [errored, setErrored] = useState(false);
  if (url && !errored) {
    return <img src={url} alt={name} className="w-24 h-24 rounded-full object-cover ring-4 ring-white shadow-md" onError={() => setErrored(true)} />;
  }
  return (
    <div className="w-24 h-24 rounded-full bg-navy-500 flex items-center justify-center text-white font-bold text-3xl ring-4 ring-white shadow-md">
      {name.charAt(0).toUpperCase()}
    </div>
  );
}
```

- [ ] **Step 4: Update `page.tsx`**

Delete lines 129–227 (all three function declarations). Add:

```ts
import { CompletenessBar } from "./components/CompletenessBar";
import { MinigamesStatsCard } from "./components/MinigamesStatsCard";
import { PlayerAvatar } from "./components/PlayerAvatar";
```

The two existing usages (`<CompletenessBar profile={profile} />` at the former line 448, `<MinigamesStatsCard />` at the former line 468, and every `<PlayerAvatar name=... url=... />` call site) need no changes to their call sites — only the declaration moved, the JSX invocation is untouched.

- [ ] **Step 5: Verify**

`npx tsc --noEmit`, `npm run lint` — clean. Manual check: `npm run dev`, open `/profile`. Completeness bar shows/hides correctly based on profile fields. Minigames card shows stats if you've played a game, hidden otherwise. Avatar renders your photo (or falls back to initials if the image 404s — test by temporarily breaking a URL if convenient, otherwise just confirm the initials fallback renders when `avatarUrl` is null).

- [ ] **Step 6: Commit**

```bash
git add "app/(dashboard)/profile/components/CompletenessBar.tsx" "app/(dashboard)/profile/components/MinigamesStatsCard.tsx" "app/(dashboard)/profile/components/PlayerAvatar.tsx" "app/(dashboard)/profile/page.tsx"
git commit -m "refactor: extract CompletenessBar, MinigamesStatsCard, PlayerAvatar from profile page"
```

---

### Task 3: Extract `ProfileHeaderCard`

**Files:**
- Create: `app/(dashboard)/profile/components/ProfileHeaderCard.tsx`
- Modify: `app/(dashboard)/profile/page.tsx:364-416` (replace with component usage)

**Interfaces:**
- Consumes: `UserProfile` from `../types`, `getTenure` from `../utils`, `PlayerAvatar` from `./PlayerAvatar`, `RoleBadge` from `@/components/RoleBadge`.
- Produces: `ProfileHeaderCard` component.

- [ ] **Step 1: Create the component**

```tsx
import { Pencil } from "lucide-react";
import type { UserProfile } from "../types";
import { getTenure } from "../utils";
import { PlayerAvatar } from "./PlayerAvatar";
import { RoleBadge } from "@/components/RoleBadge";

interface ProfileHeaderCardProps {
  profile: UserProfile;
  activeTab: string;
  isEditing: boolean;
  onEditClick: () => void;
  levelPct: number;
  pointsIntoLevel: number;
  pointsNeededForLevel: number;
}

export function ProfileHeaderCard(props: ProfileHeaderCardProps) {
  const { profile, activeTab, isEditing, onEditClick, levelPct, pointsIntoLevel, pointsNeededForLevel } = props;

  return (
    <div className="bg-white rounded-card border border-table-border p-6">
      {/* paste page.tsx:364-416 verbatim here, replacing: */}
      {/* <PlayerAvatar name={profile.displayName} url={profile.avatarUrl} /> -> unchanged, already reads from the profile prop */}
      {/* profile.displayName, profile.email, profile.role, profile.department, profile.hireDate -> unchanged (read from the profile prop) */}
      {/* getTenure(profile.hireDate) -> unchanged (imported directly, not a prop) */}
      {/* the Edit-Profile button's onClick={() => setIsEditing(true)} -> onClick={onEditClick} */}
      {/* the Edit-Profile button's visibility check (activeTab === "overview" && !isEditing, or however it's gated) -> reads activeTab/isEditing props, unchanged logic */}
      {/* levelPct, pointsIntoLevel, pointsNeededForLevel (the progress bar width/labels) -> unchanged (read from props) */}
    </div>
  );
}
```

Do the actual paste-and-replace now: copy `page.tsx` lines 364–416 into the JSX body above, applying the substitutions listed in the comments, then delete the comment block.

- [ ] **Step 2: Update `page.tsx`**

Replace lines 364–416 with:

```tsx
<ProfileHeaderCard
  profile={profile}
  activeTab={activeTab}
  isEditing={isEditing}
  onEditClick={() => setIsEditing(true)}
  levelPct={levelPct}
  pointsIntoLevel={pointsIntoLevel}
  pointsNeededForLevel={pointsNeededForLevel}
/>
```

Add the import: `import { ProfileHeaderCard } from "./components/ProfileHeaderCard";`. Remove the now-redundant `import { RoleBadge } from "@/components/RoleBadge";` and `import { PlayerAvatar } from "./components/PlayerAvatar";` from `page.tsx` **only if** `npm run lint` flags them unused after this step (both may still be needed elsewhere — check before deleting).

- [ ] **Step 3: Verify**

`npx tsc --noEmit`, `npm run lint` — clean. Manual check: `/profile` header shows avatar, name, email, role badge, department chip, tenure chip, level progress bar, and the "Edit Profile" button (only when on the Overview tab and not already editing) — clicking it enters edit mode.

- [ ] **Step 4: Commit**

```bash
git add "app/(dashboard)/profile/components/ProfileHeaderCard.tsx" "app/(dashboard)/profile/page.tsx"
git commit -m "refactor: extract ProfileHeaderCard from profile page"
```

---

### Task 4: Extract `ProfileTabBar`

**Files:**
- Create: `app/(dashboard)/profile/components/ProfileTabBar.tsx`
- Modify: `app/(dashboard)/profile/page.tsx:418-437` (replace with component usage)

**Interfaces:**
- Produces: `ProfileTabBar` component, `type ProfileTab = "overview" | "points" | "badges" | "notifications"` (define locally in the component file, or import if you'd rather add it to `types.ts` — either is fine since nothing else needs it yet; this plan defines it locally in the component file to avoid touching `types.ts` again).

- [ ] **Step 1: Create the component**

```tsx
export type ProfileTab = "overview" | "points" | "badges" | "notifications";

interface ProfileTabBarProps {
  activeTab: ProfileTab;
  onTabChange: (tab: ProfileTab) => void;
}

export function ProfileTabBar({ activeTab, onTabChange }: ProfileTabBarProps) {
  return (
    <div className="flex gap-1 border-b border-table-border">
      {/* paste page.tsx:418-437 verbatim here, replacing: */}
      {/* activeTab -> activeTab (prop, unchanged reference) */}
      {/* onClick={() => { setActiveTab(tab); setVisibleCount(10); }} -> onClick={() => onTabChange(tab)} */}
    </div>
  );
}
```

Do the paste-and-replace now.

- [ ] **Step 2: Update `page.tsx`**

Replace lines 418–437 with:

```tsx
<ProfileTabBar activeTab={activeTab} onTabChange={(tab) => { setActiveTab(tab); setVisibleCount(10); }} />
```

Add the import: `import { ProfileTabBar } from "./components/ProfileTabBar";`.

- [ ] **Step 3: Verify**

`npx tsc --noEmit`, `npm run lint` — clean. Manual check: clicking each of the 4 tabs switches the panel below and resets the Points tab's "Load more" count back to 10 (verify by loading more on Points, switching to another tab, then back to Points — should show only 10 again).

- [ ] **Step 4: Commit**

```bash
git add "app/(dashboard)/profile/components/ProfileTabBar.tsx" "app/(dashboard)/profile/page.tsx"
git commit -m "refactor: extract ProfileTabBar from profile page"
```

---

### Task 5: Extract `ProfileOverviewCards` and `ShoutoutsCard`

**Files:**
- Create: `app/(dashboard)/profile/components/ProfileOverviewCards.tsx`
- Create: `app/(dashboard)/profile/components/ShoutoutsCard.tsx`
- Modify: `app/(dashboard)/profile/page.tsx:449-498` and `:584-617` (replace with component usage)

**Interfaces:**
- `ProfileOverviewCards({ profile }: { profile: UserProfile })` — bundles the stats grid (points/level/badges) and the birthday/hire-date card; both are pure `profile`-only displays with no edit-mode coupling, low enough coupling to combine into one file.
- `ShoutoutsCard({ shoutouts }: { shoutouts: ShoutoutEntry[] | null })`.

- [ ] **Step 1: Create `ProfileOverviewCards.tsx`**

```tsx
import { Star, Medal, Coins, CalendarDays, Trophy } from "lucide-react";
import type { UserProfile } from "../types";
import { getDaysUntil, getAnniversaryYear, ordinal } from "../utils";

interface ProfileOverviewCardsProps {
  profile: UserProfile;
}

export function ProfileOverviewCards({ profile }: ProfileOverviewCardsProps) {
  return (
    <>
      {/* paste page.tsx:449-465 verbatim here (the 3-card stats grid) — pure reads of profile.pointsBalance, profile.level, profile.userBadges.length, no substitutions needed */}
      {/* paste page.tsx:470-498 verbatim here (the birthday/hire-date two-column card) — pure reads of profile.birthday, profile.hireDate via getDaysUntil/getAnniversaryYear/ordinal, no substitutions needed */}
    </>
  );
}
```

Do the paste-and-replace: copy both blocks verbatim (no variable renames needed — everything reads `profile.*` already), wrap in the fragment shown, delete the comments.

- [ ] **Step 2: Create `ShoutoutsCard.tsx`**

```tsx
import { Megaphone } from "lucide-react";
import Link from "next/link";
import type { ShoutoutEntry } from "../types";

interface ShoutoutsCardProps {
  shoutouts: ShoutoutEntry[] | null;
}

export function ShoutoutsCard({ shoutouts }: ShoutoutsCardProps) {
  return (
    <div className="bg-white rounded-card border border-table-border p-5 space-y-4">
      {/* paste page.tsx:584-617 verbatim here — reads only the shoutouts prop (already named `shoutouts` in the original, no rename needed) plus the "See all" Link and Megaphone empty-state icon */}
    </div>
  );
}
```

Do the paste-and-replace now.

- [ ] **Step 3: Update `page.tsx`**

Replace lines 449–498 with:

```tsx
<ProfileOverviewCards profile={profile} />
```

Replace lines 584–617 with:

```tsx
<ShoutoutsCard shoutouts={shoutouts} />
```

Add imports:

```ts
import { ProfileOverviewCards } from "./components/ProfileOverviewCards";
import { ShoutoutsCard } from "./components/ShoutoutsCard";
```

- [ ] **Step 4: Verify**

`npx tsc --noEmit`, `npm run lint` — clean. Manual check: Overview tab shows the 3 stat cards with correct numbers, the birthday/hire-date card with correct countdowns, and either a list of received shoutouts or the "no shoutouts yet" empty state.

- [ ] **Step 5: Commit**

```bash
git add "app/(dashboard)/profile/components/ProfileOverviewCards.tsx" "app/(dashboard)/profile/components/ShoutoutsCard.tsx" "app/(dashboard)/profile/page.tsx"
git commit -m "refactor: extract ProfileOverviewCards and ShoutoutsCard from profile page"
```

---

### Task 6: Extract `BioSection`

**Files:**
- Create: `app/(dashboard)/profile/components/BioSection.tsx`
- Modify: `app/(dashboard)/profile/page.tsx:500-527` (replace with component usage)

**Interfaces:**
- Produces: `BioSection` component.

- [ ] **Step 1: Create the component**

```tsx
import { FileText } from "lucide-react";

interface BioSectionProps {
  bio: string | null;
  isEditing: boolean;
  bioEdit: string;
  onBioChange: (value: string) => void;
}

export function BioSection({ bio, isEditing, bioEdit, onBioChange }: BioSectionProps) {
  return (
    <div className="bg-white rounded-card border border-table-border p-5 space-y-3">
      {/* paste page.tsx:500-527 verbatim here, replacing: */}
      {/* profile.bio -> bio (prop) */}
      {/* bioEdit -> bioEdit (prop, unchanged reference), onChange={(e) => setBioEdit(e.target.value)} -> onChange={(e) => onBioChange(e.target.value)} */}
      {/* isEditing -> isEditing (prop, unchanged reference) */}
      {/* FileText icon import stays local to this file */}
    </div>
  );
}
```

Do the paste-and-replace now.

- [ ] **Step 2: Update `page.tsx`**

Replace lines 500–527 with:

```tsx
<BioSection bio={profile.bio} isEditing={isEditing} bioEdit={bioEdit} onBioChange={setBioEdit} />
```

Add the import: `import { BioSection } from "./components/BioSection";`

- [ ] **Step 3: Verify**

`npx tsc --noEmit`, `npm run lint` — clean. Manual check: Overview tab shows bio text (or empty placeholder) in view mode; entering edit mode (via the header's Edit button) turns it into an editable textarea that updates as you type.

- [ ] **Step 4: Commit**

```bash
git add "app/(dashboard)/profile/components/BioSection.tsx" "app/(dashboard)/profile/page.tsx"
git commit -m "refactor: extract BioSection from profile page"
```

---

### Task 7: Extract `SkillsSection`

**Files:**
- Create: `app/(dashboard)/profile/components/SkillsSection.tsx`
- Modify: `app/(dashboard)/profile/page.tsx:529-582` (replace with component usage)

**Interfaces:**
- Produces: `SkillsSection` component.
- `handleSkillKeyDown` stays in the parent (it mutates `skillsEdit`, which — per the header analysis — is also reset by `handleProfileSave`/`handleCancelEdit`, both parent-owned handlers).

- [ ] **Step 1: Create the component**

```tsx
import { Tag, X } from "lucide-react";

interface SkillsSectionProps {
  skills: string[];
  isEditing: boolean;
  skillsEdit: string[];
  skillInput: string;
  onSkillInputChange: (value: string) => void;
  onSkillKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onRemoveSkill: (index: number) => void;
}

export function SkillsSection(props: SkillsSectionProps) {
  const { skills, isEditing, skillsEdit, skillInput, onSkillInputChange, onSkillKeyDown, onRemoveSkill } = props;

  return (
    <div className="bg-white rounded-card border border-table-border p-5 space-y-3">
      {/* paste page.tsx:529-582 verbatim here, replacing: */}
      {/* profile.skills -> skills (prop, view-mode list) */}
      {/* skillsEdit -> skillsEdit (prop, unchanged reference, edit-mode chip list) */}
      {/* the remove-chip button's onClick (removes skillsEdit[i], originally something like setSkillsEdit((prev) => prev.filter((_, idx) => idx !== i))) -> onClick={() => onRemoveSkill(i)} */}
      {/* skillInput -> skillInput (prop), onChange={(e) => setSkillInput(e.target.value)} -> onChange={(e) => onSkillInputChange(e.target.value)} */}
      {/* onKeyDown={handleSkillKeyDown} -> onKeyDown={onSkillKeyDown} */}
      {/* isEditing -> isEditing (prop, unchanged reference) */}
    </div>
  );
}
```

Do the paste-and-replace now.

- [ ] **Step 2: Update `page.tsx`**

Replace lines 529–582 with:

```tsx
<SkillsSection
  skills={profile.skills}
  isEditing={isEditing}
  skillsEdit={skillsEdit}
  skillInput={skillInput}
  onSkillInputChange={setSkillInput}
  onSkillKeyDown={handleSkillKeyDown}
  onRemoveSkill={(index) => setSkillsEdit((prev) => prev.filter((_, i) => i !== index))}
/>
```

Add the import: `import { SkillsSection } from "./components/SkillsSection";`

- [ ] **Step 3: Verify**

`npx tsc --noEmit`, `npm run lint` — clean. Manual check: Overview tab shows skill chips in view mode; edit mode lets you type a skill and press Enter or comma to add it, Backspace on an empty input removes the last chip, and clicking a chip's X removes that specific skill.

- [ ] **Step 4: Commit**

```bash
git add "app/(dashboard)/profile/components/SkillsSection.tsx" "app/(dashboard)/profile/page.tsx"
git commit -m "refactor: extract SkillsSection from profile page"
```

---

### Task 8: Extract `ProfileEditActions`

**Files:**
- Create: `app/(dashboard)/profile/components/ProfileEditActions.tsx`
- Modify: `app/(dashboard)/profile/page.tsx:619-646` (replace with component usage)

**Interfaces:**
- Produces: `ProfileEditActions` component, rendered only when `isEditing` is true (parent keeps that gate, matching how `ListingFormPanel` was gated in the AGSON-31 plan).

- [ ] **Step 1: Create the component**

```tsx
import { AlertCircle, Loader2 } from "lucide-react";

interface ProfileEditActionsProps {
  profileError: string;
  profileSaving: boolean;
  onSave: () => void;
  onCancel: () => void;
}

export function ProfileEditActions({ profileError, profileSaving, onSave, onCancel }: ProfileEditActionsProps) {
  return (
    <div className="flex items-center justify-end gap-3 pt-2">
      {/* paste page.tsx:619-646 verbatim here, replacing: */}
      {/* profileError -> profileError (prop, unchanged reference), AlertCircle icon stays local */}
      {/* onClick={handleProfileSave} -> onClick={onSave} */}
      {/* onClick={handleCancelEdit} -> onClick={onCancel} */}
      {/* profileSaving -> profileSaving (prop, unchanged reference) — disables the Save button and swaps its label/spinner (Loader2) */}
    </div>
  );
}
```

Do the paste-and-replace now.

- [ ] **Step 2: Update `page.tsx`**

Replace lines 619–646 with:

```tsx
{isEditing && (
  <ProfileEditActions
    profileError={profileError}
    profileSaving={profileSaving}
    onSave={handleProfileSave}
    onCancel={handleCancelEdit}
  />
)}
```

Confirm against the original whether the `isEditing &&` gate already wraps this block or whether it's unconditionally rendered with internal visibility logic — if the original already has the gate at a slightly wider scope (e.g. wrapping Bio+Skills+this block together), keep the gate exactly where it was and just swap in `<ProfileEditActions .../>` for this specific sub-range. Add the import: `import { ProfileEditActions } from "./components/ProfileEditActions";`

- [ ] **Step 3: Verify**

`npx tsc --noEmit`, `npm run lint` — clean. Manual check: entering edit mode reveals the Save/Cancel bar; typing an invalid bio/skills state and submitting shows the error banner; Cancel reverts fields and exits edit mode without saving; Save persists and exits edit mode.

- [ ] **Step 4: Commit**

```bash
git add "app/(dashboard)/profile/components/ProfileEditActions.tsx" "app/(dashboard)/profile/page.tsx"
git commit -m "refactor: extract ProfileEditActions from profile page"
```

---

### Task 9: Extract `PointsTab`

**Files:**
- Create: `app/(dashboard)/profile/components/PointsTab.tsx`
- Modify: `app/(dashboard)/profile/page.tsx:651-768` (replace with component usage)

**Interfaces:**
- Consumes: `PointsData`, `TimelineEntry` types, `txTypeLabel`, `CATEGORY_BADGE` from `../utils`/`../types`.
- Produces: `PointsTab` component, rendered only when `activeTab === "points"` (parent keeps that gate).

- [ ] **Step 1: Create the component**

```tsx
import { History, Trophy } from "lucide-react";
import type { PointsData, TimelineEntry } from "../types";
import { txTypeLabel, CATEGORY_BADGE } from "../utils";

interface PointsTabProps {
  pointsData: PointsData;
  visibleCount: number;
  onLoadMore: () => void;
}

export function PointsTab({ pointsData, visibleCount, onLoadMore }: PointsTabProps) {
  return (
    <div className="space-y-4">
      {/* paste page.tsx:651-768 verbatim here, replacing: */}
      {/* pointsData -> pointsData (prop, unchanged reference — balance card + transactions/redemptions merge-into-timeline logic) */}
      {/* visibleCount -> visibleCount (prop, unchanged reference — controls how many timeline entries render) */}
      {/* onClick={() => setVisibleCount((c) => c + 10)} (the "Load more" button) -> onClick={onLoadMore} */}
      {/* txTypeLabel, CATEGORY_BADGE -> imported directly, not props */}
      {/* History icon (tab/section header) and Trophy icon (empty-state) stay as local imports */}
    </div>
  );
}
```

Do the paste-and-replace now.

- [ ] **Step 2: Update `page.tsx`**

Replace lines 651–768 with:

```tsx
{activeTab === "points" && pointsData && (
  <PointsTab pointsData={pointsData} visibleCount={visibleCount} onLoadMore={() => setVisibleCount((c) => c + 10)} />
)}
```

Confirm the exact original gating condition (it may already check `pointsData &&` before rendering, or handle `null` inside the JSX itself) and preserve it exactly — don't introduce a new null-check pattern if the original didn't have one. Add the import: `import { PointsTab } from "./components/PointsTab";`

- [ ] **Step 3: Verify**

`npx tsc --noEmit`, `npm run lint` — clean. Manual check: Points tab shows balance, total earned, and the merged earn/redeem timeline; "Load more" reveals 10 more entries each click; entries render with correct type labels/colors and category badges.

- [ ] **Step 4: Commit**

```bash
git add "app/(dashboard)/profile/components/PointsTab.tsx" "app/(dashboard)/profile/page.tsx"
git commit -m "refactor: extract PointsTab from profile page"
```

---

### Task 10: Extract `BadgesTab`

**Files:**
- Create: `app/(dashboard)/profile/components/BadgesTab.tsx`
- Modify: `app/(dashboard)/profile/page.tsx:770-805` (replace with component usage)

**Interfaces:**
- Consumes: `UserBadge` type from `../types`.
- Produces: `BadgesTab` component, rendered only when `activeTab === "badges"`.

- [ ] **Step 1: Create the component**

```tsx
import { Medal, Award } from "lucide-react";
import type { UserBadge } from "../types";

interface BadgesTabProps {
  userBadges: UserBadge[];
}

export function BadgesTab({ userBadges }: BadgesTabProps) {
  return (
    <div className="space-y-4">
      {/* paste page.tsx:770-805 verbatim here, replacing: */}
      {/* profile.userBadges -> userBadges (prop) */}
      {/* Medal icon (header), Award icon (grid item + empty state) stay as local imports */}
    </div>
  );
}
```

Do the paste-and-replace now.

- [ ] **Step 2: Update `page.tsx`**

Replace lines 770–805 with:

```tsx
{activeTab === "badges" && <BadgesTab userBadges={profile.userBadges} />}
```

Add the import: `import { BadgesTab } from "./components/BadgesTab";`

- [ ] **Step 3: Verify**

`npx tsc --noEmit`, `npm run lint` — clean. Manual check: Badges tab shows the earned-badges grid with names/descriptions/dates, or the empty state if none earned yet.

- [ ] **Step 4: Commit**

```bash
git add "app/(dashboard)/profile/components/BadgesTab.tsx" "app/(dashboard)/profile/page.tsx"
git commit -m "refactor: extract BadgesTab from profile page"
```

---

### Task 11: Extract `NotificationsTab` (self-contained exception — state, effect, and handler all move)

**Files:**
- Create: `app/(dashboard)/profile/components/NotificationsTab.tsx`
- Modify: `app/(dashboard)/profile/page.tsx` — remove `notifPrefs`/`notifLoading`/`notifSaving`/`notifError` state (lines 236–239), remove the notification-preferences effect (lines 320–328), remove `handleNotifToggle` (lines 330–347), replace JSX at lines 807–886

**Interfaces:**
- Produces: `NotificationsTab` component, taking no props except nothing — it self-fetches via `useApiClient`.

**Exception to the global "no state moves" rule, verified safe:** `notifPrefs`, `notifLoading`, `notifSaving`, `notifError` are read/written ONLY within the Notifications tab JSX (807–886), the fetch effect (320–328), and `handleNotifToggle` (330–347) — confirmed via the full-file structural read: no other section references any of the four. `handleNotifToggle`'s only external effect is the PUT request itself; it never touches `profile`, `pointsData`, or any other shared state. This mirrors the `AddMedicineForm` exception from the AGSON-31 plan.

One wrinkle: the original effect at lines 320–328 is lazy — it only fetches when `activeTab === "notifications"` and `notifPrefs` is still `null`, i.e. it depends on the *parent's* `activeTab` state to know when to fire. Since the component now owns this fetch entirely, replace that lazy gate with a plain "fetch on mount" effect — the component only mounts (or, if you keep it always-mounted-but-hidden per the tab-switch pattern used elsewhere in this file, only becomes visible) when the Notifications tab is selected, so "fetch on mount" is behavior-equivalent to "fetch the first time this tab is opened." Verify the parent's tab-switching JSX doesn't keep all 4 tab panels mounted simultaneously (check: does `page.tsx` use `{activeTab === "x" && <Panel/>}` conditional rendering, or CSS `display:none` toggling? Every other tab extracted so far in this plan used the `{activeTab === "x" && ...}` pattern, so `NotificationsTab` mounting is gated the same way — confirm this before assuming "on mount" is equivalent to "first time opened").

- [ ] **Step 1: Create the component**

```tsx
"use client";

import { useEffect, useState } from "react";
import { useApiClient } from "@/lib/hooks/useApiClient";
import { Bell, Loader2 } from "lucide-react";

export function NotificationsTab() {
  const { apiFetch } = useApiClient();
  const [notifPrefs, setNotifPrefs] = useState<Record<string, boolean> | null>(null);
  const [notifLoading, setNotifLoading] = useState(true);
  const [notifSaving, setNotifSaving] = useState<string | null>(null);
  const [notifError, setNotifError] = useState("");

  useEffect(() => {
    // paste the body of page.tsx:320-328 verbatim here (minus the `if (activeTab !== "notifications" || notifPrefs) return;` guard,
    // which is no longer needed — this effect now only runs once, on mount, since the component itself only mounts when the tab is opened)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleNotifToggle(key: string, value: boolean) {
    // paste page.tsx:330-347 verbatim here — every reference to notifPrefs/setNotifPrefs/setNotifSaving/setNotifError
    // is already correct as-is since this component now owns them locally
  }

  return (
    <div className="space-y-4">
      {/* paste page.tsx:807-886 verbatim here — notifPrefs, notifLoading, notifSaving, notifError, handleNotifToggle
          are all already correct as-is (now locally scoped); Bell icon (header) and Loader2 (loading state) stay as local imports */}
    </div>
  );
}
```

Do the actual paste-and-replace now, following the two inline instructions.

- [ ] **Step 2: Update `page.tsx`**

Delete the `notifPrefs`/`notifLoading`/`notifSaving`/`notifError` state (lines 236–239), the notification-preferences effect (lines 320–328), and `handleNotifToggle` (lines 330–347) entirely. Replace lines 807–886 with:

```tsx
{activeTab === "notifications" && <NotificationsTab />}
```

Add the import: `import { NotificationsTab } from "./components/NotificationsTab";`

- [ ] **Step 3: Verify**

`npx tsc --noEmit`, `npm run lint` — clean (watch for `Bell` becoming unused in `page.tsx` — remove it from the top-level import if so). Manual check: open the Notifications tab fresh (first time this session) — loading spinner then preferences list appears. Toggle an in-app/email preference — optimistic update happens immediately, persists after a page refresh. Switch away and back to the tab — preferences don't re-fetch/flicker (still cached in the component's own state as long as it stays mounted — if `page.tsx` unmounts inactive tab panels rather than hiding them, this SHOULD refetch each time, which is fine and matches "first time opened" per-mount).

- [ ] **Step 4: Commit**

```bash
git add "app/(dashboard)/profile/components/NotificationsTab.tsx" "app/(dashboard)/profile/page.tsx"
git commit -m "refactor: extract self-contained NotificationsTab from profile page"
```

---

### Task 12: Extract sidebar widgets

**Files:**
- Create: `app/(dashboard)/profile/components/UpcomingMilestoneWidget.tsx`
- Create: `app/(dashboard)/profile/components/DepartmentRankWidget.tsx`
- Create: `app/(dashboard)/profile/components/RecentActivityWidget.tsx`
- Create: `app/(dashboard)/profile/components/QuickActionsWidget.tsx`
- Create: `app/(dashboard)/profile/components/RecentBadgesWidget.tsx`
- Modify: `app/(dashboard)/profile/page.tsx:893-1018` (replace with component usages)

**Interfaces:**
- `UpcomingMilestoneWidget({ profile }: { profile: UserProfile })` — reads `profile.birthday`/`profile.hireDate` via `getDaysUntil`/`getAnniversaryYear`/`ordinal`.
- `DepartmentRankWidget({ department, deptRank }: { department: UserProfile["department"]; deptRank: {rank: number; total: number} | null })`.
- `RecentActivityWidget({ pointsData, onViewAll }: { pointsData: PointsData | null; onViewAll: () => void })`.
- `QuickActionsWidget()` — no props, fully static (3 nav links).
- `RecentBadgesWidget({ userBadges, onSeeAll }: { userBadges: UserBadge[]; onSeeAll: () => void })`.

- [ ] **Step 1: Create `UpcomingMilestoneWidget.tsx`**

```tsx
import type { UserProfile } from "../types";
import { getDaysUntil, getAnniversaryYear, ordinal } from "../utils";

interface UpcomingMilestoneWidgetProps {
  profile: UserProfile;
}

export function UpcomingMilestoneWidget({ profile }: UpcomingMilestoneWidgetProps) {
  // paste the IIFE logic and JSX from page.tsx:893-919 verbatim here — profile.birthday/profile.hireDate
  // reads are already correct since this component receives the same `profile` shape as a prop
  return null;
}
```

Do the paste-and-replace: copy the full IIFE-computed banner block (893–919) into the component body, keeping its `(() => { ... })()` structure or converting it to plain component-body logic (either is fine — this is a pure display computation with no hooks).

- [ ] **Step 2: Create `DepartmentRankWidget.tsx`**

```tsx
import Link from "next/link";
import type { UserProfile } from "../types";

interface DepartmentRankWidgetProps {
  department: UserProfile["department"];
  deptRank: { rank: number; total: number } | null;
}

export function DepartmentRankWidget({ department, deptRank }: DepartmentRankWidgetProps) {
  return (
    <div className="bg-white rounded-card border border-table-border p-4">
      {/* paste page.tsx:921-936 verbatim here, replacing: */}
      {/* profile.department -> department (prop) */}
      {/* deptRank -> deptRank (prop, unchanged reference) */}
      {/* the Link to /leaderboard stays as-is (static href, no prop needed) */}
    </div>
  );
}
```

Do the paste-and-replace now.

- [ ] **Step 3: Create `RecentActivityWidget.tsx`**

```tsx
import type { PointsData } from "../types";
import { txTypeLabel } from "../utils";

interface RecentActivityWidgetProps {
  pointsData: PointsData | null;
  onViewAll: () => void;
}

export function RecentActivityWidget({ pointsData, onViewAll }: RecentActivityWidgetProps) {
  return (
    <div className="bg-white rounded-card border border-table-border p-4">
      {/* paste page.tsx:938-978 verbatim here, replacing: */}
      {/* pointsData -> pointsData (prop) */}
      {/* txTypeLabel -> imported directly, not a prop */}
      {/* the "View all" button's onClick={() => setActiveTab("points")} -> onClick={onViewAll} */}
    </div>
  );
}
```

Do the paste-and-replace now.

- [ ] **Step 4: Create `QuickActionsWidget.tsx`**

```tsx
import Link from "next/link";
import { ShoppingBag, Gamepad2, Megaphone } from "lucide-react";

export function QuickActionsWidget() {
  return (
    <div className="bg-white rounded-card border border-table-border p-4">
      {/* paste page.tsx:980-995 verbatim here — fully static, no substitutions needed */}
    </div>
  );
}
```

Do the paste-and-replace now.

- [ ] **Step 5: Create `RecentBadgesWidget.tsx`**

```tsx
import { Award } from "lucide-react";
import type { UserBadge } from "../types";

interface RecentBadgesWidgetProps {
  userBadges: UserBadge[];
  onSeeAll: () => void;
}

export function RecentBadgesWidget({ userBadges, onSeeAll }: RecentBadgesWidgetProps) {
  return (
    <div className="bg-white rounded-card border border-table-border p-4">
      {/* paste page.tsx:997-1018 verbatim here, replacing: */}
      {/* profile.userBadges -> userBadges (prop) */}
      {/* the "See all" button's onClick={() => setActiveTab("badges")} -> onClick={onSeeAll} */}
    </div>
  );
}
```

Do the paste-and-replace now.

- [ ] **Step 6: Update `page.tsx`**

Replace lines 893–1018 with:

```tsx
<UpcomingMilestoneWidget profile={profile} />
<DepartmentRankWidget department={profile.department} deptRank={deptRank} />
<RecentActivityWidget pointsData={pointsData} onViewAll={() => setActiveTab("points")} />
<QuickActionsWidget />
<RecentBadgesWidget userBadges={profile.userBadges} onSeeAll={() => setActiveTab("badges")} />
```

Add the 5 imports:

```ts
import { UpcomingMilestoneWidget } from "./components/UpcomingMilestoneWidget";
import { DepartmentRankWidget } from "./components/DepartmentRankWidget";
import { RecentActivityWidget } from "./components/RecentActivityWidget";
import { QuickActionsWidget } from "./components/QuickActionsWidget";
import { RecentBadgesWidget } from "./components/RecentBadgesWidget";
```

- [ ] **Step 7: Verify**

`npx tsc --noEmit`, `npm run lint` — clean. Manual check: sidebar shows (as applicable) the upcoming-milestone banner, department rank card with working "View leaderboard" link, recent-activity preview with a working "View all" that switches to the Points tab, the 3 static quick-action links, and a recent-badges preview with a working "See all" that switches to the Badges tab.

- [ ] **Step 8: Commit**

```bash
git add "app/(dashboard)/profile/components/UpcomingMilestoneWidget.tsx" "app/(dashboard)/profile/components/DepartmentRankWidget.tsx" "app/(dashboard)/profile/components/RecentActivityWidget.tsx" "app/(dashboard)/profile/components/QuickActionsWidget.tsx" "app/(dashboard)/profile/components/RecentBadgesWidget.tsx" "app/(dashboard)/profile/page.tsx"
git commit -m "refactor: extract sidebar widgets from profile page"
```

---

### Task 13: Final profile page cleanup + full verification

**Files:**
- Modify: `app/(dashboard)/profile/page.tsx` (import cleanup + dead-code removal only)

- [ ] **Step 1: Remove the dead `Lock` import**

`Lock` (imported at the original line 8) is never referenced anywhere in the file — confirmed via Task 1's structural read. Delete it from the lucide-react import line. This is the one sanctioned behavior-level change for this Part (a no-op deletion — `Lock` renders nothing today since it's never used).

- [ ] **Step 2: Remove other now-unused imports**

After Tasks 2–12, `page.tsx` no longer renders most of the JSX that used icons directly. Run `npx tsc --noEmit` and `npm run lint` — ESLint's `no-unused-vars` will flag exactly which lucide-react imports, `Link`, `RoleBadge`, `getLevelProgress` (still needed — the `levelPct` derivation stays in the parent), and type imports are no longer used in `page.tsx`; delete those from the top-level import lines. Do NOT remove `useEffect`/`useState`/`useRouter`/`useAuth`/`useApiClient` — those are still used by the parent's own state/effects.

- [ ] **Step 3: Confirm final line count**

Run `wc -l "app/(dashboard)/profile/page.tsx"` — expect roughly 250–350 lines (down from 1025), holding: imports, type/util re-imports, the `authUser`/`apiFetch` hooks, all remaining `useState` declarations, the 2 remaining effects (main fetch + dept-rank fetch), the 4 remaining handlers (`handleProfileSave`, `handleCancelEdit`, `handleSkillKeyDown`, plus whatever the "Load more"/tab-switch inline arrows collapse to), the loading guard, the `levelPct` derivation, and a JSX tree that's just composition of the 15 extracted components.

- [ ] **Step 4: Full verification pass**

```bash
npx tsc --noEmit
npm run lint
npm run build
```

All three must succeed with the lint warning count unchanged from before Task 1. Then `npm run dev` and re-run a full manual click-through: header edit flow (edit → change bio/skills → save/cancel), all 4 tabs, both modals-that-aren't-modals (Notifications first-open fetch), all 5 sidebar widgets' links.

- [ ] **Step 5: Commit**

```bash
git add "app/(dashboard)/profile/page.tsx"
git commit -m "refactor: clean up unused imports and dead Lock import after profile page split"
```

---

## Part B — `app/admin/employees/page.tsx`

### Task 14: Extract shared types and pure helpers

**Files:**
- Create: `app/admin/employees/types.ts`
- Create: `app/admin/employees/utils.ts`
- Modify: `app/admin/employees/page.tsx:12-55` (remove, replace with imports), `:72` (use `SyncResult` type), `:280-286` (use util imports)

**Interfaces:**
- Produces from `types.ts`: `Employee`, `Department`, `EditForm`, `AddForm`, `SyncResult` (all exported types — `SyncResult` is newly promoted from the inline shape currently at line 72).
- Produces from `utils.ts`: `EMPTY_ADD_FORM: AddForm`, `formatDate(value: string | null): string | null`, `getDeptOptions(departments: Department[]): string[]`, `selectClass: string` (all exported).

- [ ] **Step 1: Create `types.ts`**

Move lines 12–45 verbatim, adding `export`, plus a newly-named `SyncResult` type:

```ts
export type Employee = {
  id: string;
  employeeId: string | null;
  displayName: string;
  email: string;
  role: "EMPLOYEE" | "MANAGER" | "HR_ADMIN" | "SUPER_ADMIN";
  pointsBalance: number;
  isActive: boolean;
  hireDate: string | null;
  birthday: string | null;
  department: { id: string; name: string } | null;
};

export type Department = { id: string; name: string };

export type EditForm = {
  displayName: string;
  email: string;
  departmentId: string | null;
  role: Employee["role"];
  isActive: boolean;
  birthday: string | null;
  hireDate: string | null;
};

export type AddForm = {
  displayName: string;
  email: string;
  departmentId: string;
  role: Employee["role"];
  employeeId: string;
  hireDate: string;
  birthday: string;
};

export type SyncResult = {
  deactivated: number;
  reactivated: number;
  imported: number;
  birthdaysUpdated: number;
  activeInFile: number;
  resignedInFile: number;
  failedImports: number;
  failedEmails: string[];
};
```

- [ ] **Step 2: Create `utils.ts`**

Move `EMPTY_ADD_FORM` (lines 47–55) verbatim adding `export`, plus new pure functions refactored from the inline derived-value expressions at lines 276, 280–286:

```ts
import type { AddForm, Department } from "./types";

export const EMPTY_ADD_FORM: AddForm = {
  displayName: "",
  email: "",
  departmentId: "",
  role: "EMPLOYEE",
  employeeId: "",
  hireDate: "",
  birthday: "",
};

export function getDeptOptions(departments: Department[]): string[] {
  return departments.map((d) => d.name).sort();
}

export const selectClass =
  "text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-navy-500/30 bg-white disabled:opacity-50";

export function formatDate(value: string | null) {
  return value
    ? new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : null;
}
```

- [ ] **Step 3: Update `page.tsx`**

Delete lines 12–55. Add after the existing `import { RoleBadge } from "@/components/RoleBadge";` line:

```ts
import type { Employee, Department, EditForm, AddForm, SyncResult } from "./types";
import { EMPTY_ADD_FORM, getDeptOptions, selectClass, formatDate } from "./utils";
```

At the (now-shifted) line declaring `syncResult`, change the inline type to use `SyncResult`:

```ts
const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
```

At the (now-shifted) derived-value block that previously read:

```ts
const deptOptions = departments.map((d) => d.name).sort();
const hasActiveFilters = filterDept || filterRole || filterStatus;
const selectClass = "text-sm border ...";
const formatDate = (value: string | null) => value ? ... : null;
```

replace with:

```ts
const deptOptions = getDeptOptions(departments);
const hasActiveFilters = filterDept || filterRole || filterStatus;
```

(drop the local `selectClass` and `formatDate` const declarations entirely — they're now imported from `utils.ts`; `hasActiveFilters` stays as a local derived value, it's trivial and used nowhere else).

- [ ] **Step 4: Verify**

`npx tsc --noEmit` — expect clean. `npm run lint` — no new errors. Pure code motion, no visual check needed.

- [ ] **Step 5: Commit**

```bash
git add "app/admin/employees/types.ts" "app/admin/employees/utils.ts" "app/admin/employees/page.tsx"
git commit -m "refactor: extract admin employees page types and helpers to sibling files"
```

---

### Task 15: Extract `SyncBanners`

**Files:**
- Create: `app/admin/employees/components/SyncBanners.tsx`
- Modify: `app/admin/employees/page.tsx:297-325` (replace with component usage)

**Interfaces:**
- Consumes: `SyncResult` type from `../types`.
- Produces: `SyncBanners` component.

- [ ] **Step 1: Create the component**

```tsx
import type { SyncResult } from "../types";

interface SyncBannersProps {
  syncResult: SyncResult | null;
  syncError: string;
  onDismissResult: () => void;
  onDismissError: () => void;
}

export function SyncBanners({ syncResult, syncError, onDismissResult, onDismissError }: SyncBannersProps) {
  return (
    <>
      {/* paste page.tsx:297-318 verbatim here (success banner), replacing: */}
      {/* syncResult -> syncResult (prop, unchanged reference) */}
      {/* the dismiss button's onClick={() => setSyncResult(null)} -> onClick={onDismissResult} */}

      {/* paste page.tsx:320-325 verbatim here (error banner), replacing: */}
      {/* syncError -> syncError (prop, unchanged reference) */}
      {/* the dismiss button's onClick={() => setSyncError("")} -> onClick={onDismissError} */}
    </>
  );
}
```

Do the paste-and-replace now.

- [ ] **Step 2: Update `page.tsx`**

Replace lines 297–325 with:

```tsx
<SyncBanners
  syncResult={syncResult}
  syncError={syncError}
  onDismissResult={() => setSyncResult(null)}
  onDismissError={() => setSyncError("")}
/>
```

Add the import: `import { SyncBanners } from "./components/SyncBanners";`

- [ ] **Step 3: Verify**

`npx tsc --noEmit`, `npm run lint` — clean. Manual check: `/admin/employees`, upload a Sprout HR export file — success banner shows counts and (if any) failed-imports list, dismissible via its X. Upload an invalid file — error banner shows, dismissible.

- [ ] **Step 4: Commit**

```bash
git add "app/admin/employees/components/SyncBanners.tsx" "app/admin/employees/page.tsx"
git commit -m "refactor: extract SyncBanners from admin employees page"
```

---

### Task 16: Extract `EmployeeFilterBar`

**Files:**
- Create: `app/admin/employees/components/EmployeeFilterBar.tsx`
- Modify: `app/admin/employees/page.tsx:327-380` (replace with component usage)

**Interfaces:**
- Produces: `EmployeeFilterBar` component (also owns the hidden file `<input>` at lines 374–380 since it's tightly coupled to the toolbar's Upload button visually adjacent to the filter row — if your read of the current file shows the hidden input further from the filter bar than the toolbar, move it into Task 17's `EmployeeToolbar` instead; verify by re-reading the current line range before starting).

- [ ] **Step 1: Create the component**

```tsx
interface EmployeeFilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  filterDept: string;
  onDeptChange: (value: string) => void;
  filterRole: string;
  onRoleChange: (value: string) => void;
  filterStatus: string;
  onStatusChange: (value: string) => void;
  deptOptions: string[];
  isSuperAdmin: boolean;
  onClearFilters: () => void;
}

export function EmployeeFilterBar(props: EmployeeFilterBarProps) {
  const {
    search, onSearchChange, filterDept, onDeptChange, filterRole, onRoleChange,
    filterStatus, onStatusChange, deptOptions, isSuperAdmin, onClearFilters,
  } = props;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* paste page.tsx:327-372 verbatim here, replacing: */}
      {/* search -> search (prop), onChange={(e) => setSearch(e.target.value)} -> onChange={(e) => onSearchChange(e.target.value)} */}
      {/* filterDept -> filterDept (prop), onChange={(e) => setFilterDept(e.target.value)} -> onChange={(e) => onDeptChange(e.target.value)} */}
      {/* filterRole -> filterRole (prop), onChange={(e) => setFilterRole(e.target.value)} -> onChange={(e) => onRoleChange(e.target.value)} */}
      {/* filterStatus -> filterStatus (prop), onChange={(e) => setFilterStatus(e.target.value)} -> onChange={(e) => onStatusChange(e.target.value)} */}
      {/* deptOptions -> deptOptions (prop) */}
      {/* isSuperAdmin -> isSuperAdmin (prop) — gates whether the role filter includes Manager/HR Admin/Super Admin options */}
      {/* the "Clear filters" button's onClick (resets search/filterDept/filterRole/filterStatus) -> onClick={onClearFilters} */}
    </div>
  );
}
```

Do the paste-and-replace now.

- [ ] **Step 2: Update `page.tsx`**

Replace lines 327–372 with:

```tsx
<EmployeeFilterBar
  search={search}
  onSearchChange={setSearch}
  filterDept={filterDept}
  onDeptChange={setFilterDept}
  filterRole={filterRole}
  onRoleChange={setFilterRole}
  filterStatus={filterStatus}
  onStatusChange={setFilterStatus}
  deptOptions={deptOptions}
  isSuperAdmin={isSuperAdmin}
  onClearFilters={() => { setSearch(""); setFilterDept(""); setFilterRole(""); setFilterStatus(""); }}
/>
```

Add the import: `import { EmployeeFilterBar } from "./components/EmployeeFilterBar";`

- [ ] **Step 3: Verify**

`npx tsc --noEmit`, `npm run lint` — clean. Manual check: typing in search filters the list (debounced re-fetch via the existing effect), each select filters correctly, "Clear filters" resets all four and the "active filters" indicator disappears.

- [ ] **Step 4: Commit**

```bash
git add "app/admin/employees/components/EmployeeFilterBar.tsx" "app/admin/employees/page.tsx"
git commit -m "refactor: extract EmployeeFilterBar from admin employees page"
```

---

### Task 17: Extract `EmployeeToolbar` (upload instructions + action buttons)

**Files:**
- Create: `app/admin/employees/components/EmployeeToolbar.tsx`
- Modify: `app/admin/employees/page.tsx:374-466` (replace with component usage), name the inline export handler

**Interfaces:**
- Produces: `EmployeeToolbar` component. `showUploadGuide` (the Upload Instructions collapsible toggle) is a legitimate self-contained exception — confirmed via Task 14's structural read that it has zero readers/writers outside this JSX block — so this component owns that one piece of state itself rather than receiving it as a prop.

**Naming note (do this in Step 0, before extracting):** the Export CSV button's `onClick` (lines 436–458 of the original) is an inline anonymous handler. Lift it into a named `handleExport` function in the parent, right after `handleSave`, with the exact same body — this is required so the extracted toolbar component has a named callback to receive as a prop instead of needing the whole inline closure duplicated.

- [ ] **Step 1: Name the export handler in `page.tsx`**

Before line 436 (or wherever the Export CSV button currently sits), add a new function alongside the other handlers:

```ts
async function handleExport() {
  setExporting(true);
  try {
    // paste the body of the original inline onClick handler (page.tsx:436-458) here verbatim —
    // it already reads search/filterDept/filterRole/filterStatus and writes exporting correctly
  } finally {
    setExporting(false);
  }
}
```

Then replace the button's `onClick={...inline handler...}` with `onClick={handleExport}` at its original call site (this is still inside `page.tsx` at this point — the extraction into the toolbar component happens in Step 3).

- [ ] **Step 2: Create the component**

```tsx
"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Download, Upload, UserPlus } from "lucide-react";

interface EmployeeToolbarProps {
  employeeCount: number;
  totalEmployees: number;
  syncing: boolean;
  exporting: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onAddClick: () => void;
  onUploadClick: () => void;
  onExportClick: () => void;
}

export function EmployeeToolbar(props: EmployeeToolbarProps) {
  const { employeeCount, totalEmployees, syncing, exporting, fileInputRef, onAddClick, onUploadClick, onExportClick } = props;
  const [showUploadGuide, setShowUploadGuide] = useState(false);

  return (
    <>
      {/* paste page.tsx:382-411 verbatim here (Upload Instructions collapsible), replacing: */}
      {/* showUploadGuide -> showUploadGuide (now local state, unchanged reference) */}
      {/* onClick={() => setShowUploadGuide(!showUploadGuide)} -> unchanged, since setShowUploadGuide is now local */}
      {/* ChevronDown/ChevronUp icons stay as local imports */}

      {/* paste page.tsx:374-380 verbatim here (hidden file input), replacing: */}
      {/* fileInputRef -> fileInputRef (prop, unchanged reference) */}
      {/* onChange={handleSyncFile} -> stays wired to a prop — add an onFileSelected prop if the file input's onChange isn't already covered by onUploadClick; re-check the original: the hidden input's onChange calls handleSyncFile directly (not the visible Upload button's onClick, which just calls fileInputRef.current?.click()) — so this component needs a separate onFileSelected: (e: React.ChangeEvent<HTMLInputElement>) => void prop wired to the input's onChange, distinct from onUploadClick which wires only the visible button */}

      {/* paste page.tsx:413-466 verbatim here (toolbar buttons), replacing: */}
      {/* employees.length, totalEmployees -> employeeCount, totalEmployees (props) */}
      {/* onClick={() => { setAddModalOpen(true); setAddForm(EMPTY_ADD_FORM); setAddError(""); }} (Add Employee button) -> onClick={onAddClick} */}
      {/* onClick={() => fileInputRef.current?.click()} (Upload button) -> onClick={onUploadClick} */}
      {/* syncing -> syncing (prop) */}
      {/* onClick={handleExport} (Export CSV button, now named per Step 1) -> onClick={onExportClick} */}
      {/* exporting -> exporting (prop) */}
      {/* UserPlus, Upload, Download icons stay as local imports */}
    </>
  );
}
```

Fix the prop list to include `onFileSelected: (e: React.ChangeEvent<HTMLInputElement>) => void` per the inline note above, and wire the hidden input's `onChange={onFileSelected}`. Do the actual paste-and-replace now.

- [ ] **Step 3: Update `page.tsx`**

Replace lines 374–466 with:

```tsx
<EmployeeToolbar
  employeeCount={employees.length}
  totalEmployees={totalEmployees}
  syncing={syncing}
  exporting={exporting}
  fileInputRef={fileInputRef}
  onAddClick={() => { setAddModalOpen(true); setAddForm(EMPTY_ADD_FORM); setAddError(""); }}
  onUploadClick={() => fileInputRef.current?.click()}
  onFileSelected={handleSyncFile}
  onExportClick={handleExport}
/>
```

Add the import: `import { EmployeeToolbar } from "./components/EmployeeToolbar";`

- [ ] **Step 4: Verify**

`npx tsc --noEmit`, `npm run lint` — clean. Manual check: Upload Instructions toggle expands/collapses. "Add Employee" opens the Add modal with a clean form. "Upload" opens the file picker; selecting a valid Sprout export triggers the sync flow (banners from Task 15 show results). "Export CSV" downloads a file reflecting current filters, spinner shows while exporting.

- [ ] **Step 5: Commit**

```bash
git add "app/admin/employees/components/EmployeeToolbar.tsx" "app/admin/employees/page.tsx"
git commit -m "refactor: extract EmployeeToolbar, name handleExport, from admin employees page"
```

---

### Task 18: Extract `EmployeeTable`

**Files:**
- Create: `app/admin/employees/components/EmployeeTable.tsx`
- Modify: `app/admin/employees/page.tsx:468-630` (replace with component usage)

**Interfaces:**
- Consumes: `Employee` type from `../types`, `formatDate`/`selectClass` from `../utils`, `Pagination` from `@/components/ui/pagination`, `RoleBadge` from `@/components/RoleBadge`.
- Produces: `EmployeeTable` component covering loading/empty states, mobile card list, desktop table, and pagination as one cohesive unit.

- [ ] **Step 1: Create the component**

```tsx
import { Loader2, Pencil, Users } from "lucide-react";
import { Pagination } from "@/components/ui/pagination";
import { RoleBadge } from "@/components/RoleBadge";
import type { Employee } from "../types";
import { formatDate, selectClass } from "../utils";

interface EmployeeTableProps {
  employees: Employee[];
  loading: boolean;
  isSuperAdmin: boolean;
  updatingId: string | null;
  page: number;
  pages: number;
  totalEmployees: number;
  onPageChange: (page: number) => void;
  onRoleChange: (employeeId: string, role: Employee["role"]) => void;
  onEdit: (employee: Employee) => void;
  onBootstrap: () => void;
}

export function EmployeeTable(props: EmployeeTableProps) {
  const { employees, loading, isSuperAdmin, updatingId, page, pages, totalEmployees, onPageChange, onRoleChange, onEdit, onBootstrap } = props;

  return (
    <>
      {/* paste page.tsx:468-483 verbatim here (loading/empty/bootstrap states), replacing: */}
      {/* loading -> loading (prop) */}
      {/* employees.length -> employees.length (prop, unchanged reference — employees is now a prop) */}
      {/* onClick={handleBootstrap} (the "Make me HR Admin" button) -> onClick={onBootstrap} */}

      {/* paste page.tsx:486-538 verbatim here (mobile card list), replacing: */}
      {/* employees.map(...) -> employees.map(...) (prop, unchanged reference) */}
      {/* isSuperAdmin -> isSuperAdmin (prop) */}
      {/* updatingId -> updatingId (prop) */}
      {/* onChange={(e) => handleRoleChange(emp.id, e.target.value)} (role select) -> onChange={(e) => onRoleChange(emp.id, e.target.value as Employee["role"])} */}
      {/* onClick={() => handleEdit(emp)} (edit button) -> onClick={() => onEdit(emp)} */}
      {/* formatDate(emp.hireDate) -> unchanged (imported directly, not a prop) */}
      {/* RoleBadge, Pencil, Users icons stay as local imports */}

      {/* paste page.tsx:540-622 verbatim here (desktop table), replacing: */}
      {/* same substitutions as the mobile card list above */}
      {/* selectClass -> unchanged (imported directly, not a prop) */}

      {/* paste page.tsx:626-630 verbatim here (pagination footer), replacing: */}
      {/* page, pages, totalEmployees -> page, pages, totalEmployees (props) */}
      {/* onPageChange={setPage} -> onPageChange={onPageChange} */}
    </>
  );
}
```

Do the actual paste-and-replace now, following every substitution comment.

- [ ] **Step 2: Update `page.tsx`**

Replace lines 468–630 with:

```tsx
<EmployeeTable
  employees={employees}
  loading={loading}
  isSuperAdmin={isSuperAdmin}
  updatingId={updatingId}
  page={page}
  pages={pages}
  totalEmployees={totalEmployees}
  onPageChange={setPage}
  onRoleChange={handleRoleChange}
  onEdit={handleEdit}
  onBootstrap={handleBootstrap}
/>
```

Add the import: `import { EmployeeTable } from "./components/EmployeeTable";`

- [ ] **Step 3: Verify**

`npx tsc --noEmit`, `npm run lint` — clean. Manual check: table/cards render correctly at desktop and mobile widths, loading spinner shows during fetch, empty state + bootstrap button show for a fresh workspace, role dropdown updates optimistically (disabled while `updatingId` matches), Edit button opens the Edit modal, pagination navigates pages correctly.

- [ ] **Step 4: Commit**

```bash
git add "app/admin/employees/components/EmployeeTable.tsx" "app/admin/employees/page.tsx"
git commit -m "refactor: extract EmployeeTable from admin employees page"
```

---

### Task 19: Extract `AddEmployeeModal`

**Files:**
- Create: `app/admin/employees/components/AddEmployeeModal.tsx`
- Modify: `app/admin/employees/page.tsx:633-741` (replace with component usage)

**Interfaces:**
- Consumes: `AddForm`, `Department`, `Employee` types from `../types`.
- Produces: `AddEmployeeModal` component. State (`addModalOpen`, `addForm`, `addError`, `adding`) and `handleAddEmployee` stay in the parent per the global rule — `addModalOpen` is toggled from `EmployeeToolbar`'s "Add Employee" button (Task 17), a different component, so this modal can't own its own open/closed state.

- [ ] **Step 1: Create the component**

```tsx
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import type { AddForm, Department, Employee } from "../types";

interface AddEmployeeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: AddForm;
  onFormChange: (updater: (prev: AddForm) => AddForm) => void;
  error: string;
  submitting: boolean;
  onSubmit: (e: React.FormEvent) => void;
  departments: Department[];
  isSuperAdmin: boolean;
}

export function AddEmployeeModal(props: AddEmployeeModalProps) {
  const { open, onOpenChange, form, onFormChange, error, submitting, onSubmit, departments, isSuperAdmin } = props;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-6">
        <DialogHeader>
          <DialogTitle>Add Employee</DialogTitle>
        </DialogHeader>
        {/* paste page.tsx:640-741 verbatim here (the <form onSubmit={handleAddEmployee}> through its closing tag), replacing: */}
        {/* onSubmit={handleAddEmployee} -> onSubmit={onSubmit} */}
        {/* addForm -> form (prop) everywhere it's read */}
        {/* setAddForm((f) => ({...f, displayName: e.target.value})) (and every other field setter) -> onFormChange((f) => ({...f, displayName: e.target.value})) */}
        {/* addError -> error (prop) */}
        {/* adding -> submitting (prop) — disables the submit button and swaps its label/spinner (Loader2) */}
        {/* departments -> departments (prop) */}
        {/* isSuperAdmin -> isSuperAdmin (prop) — gates whether the role select includes Manager/HR Admin/Super Admin options */}
        {/* the Cancel button's onClick={() => setAddModalOpen(false)} -> onClick={() => onOpenChange(false)} */}
      </DialogContent>
    </Dialog>
  );
}
```

Do the paste-and-replace now.

- [ ] **Step 2: Update `page.tsx`**

Replace lines 633–741 with:

```tsx
<AddEmployeeModal
  open={addModalOpen}
  onOpenChange={setAddModalOpen}
  form={addForm}
  onFormChange={setAddForm}
  error={addError}
  submitting={adding}
  onSubmit={handleAddEmployee}
  departments={departments}
  isSuperAdmin={isSuperAdmin}
/>
```

Add the import: `import { AddEmployeeModal } from "./components/AddEmployeeModal";`

- [ ] **Step 3: Verify**

`npx tsc --noEmit`, `npm run lint` — clean. Manual check: "Add Employee" opens the modal with a clean form; filling required fields and submitting adds the employee to the list and closes the modal; submitting with missing/invalid fields shows the error message; Cancel closes without adding.

- [ ] **Step 4: Commit**

```bash
git add "app/admin/employees/components/AddEmployeeModal.tsx" "app/admin/employees/page.tsx"
git commit -m "refactor: extract AddEmployeeModal from admin employees page"
```

---

### Task 20: Extract `EditEmployeeModal`

**Files:**
- Create: `app/admin/employees/components/EditEmployeeModal.tsx`
- Modify: `app/admin/employees/page.tsx:743-864` (replace with component usage)

**Interfaces:**
- Consumes: `Employee`, `EditForm`, `Department` types from `../types`.
- Produces: `EditEmployeeModal` component. State (`editingEmployee`, `editForm`, `saving`) and `handleSave` stay in the parent — `editingEmployee` is populated from `EmployeeTable`'s Edit buttons (Task 18), a different component.

- [ ] **Step 1: Create the component**

```tsx
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import type { Employee, EditForm, Department } from "../types";

interface EditEmployeeModalProps {
  employee: Employee | null;
  form: EditForm;
  onFormChange: (updater: (prev: EditForm) => EditForm) => void;
  saving: boolean;
  onSave: () => void;
  onCancel: () => void;
  departments: Department[];
}

export function EditEmployeeModal(props: EditEmployeeModalProps) {
  const { employee, form, onFormChange, saving, onSave, onCancel, departments } = props;

  return (
    <Dialog open={!!employee} onOpenChange={(open) => { if (!open) onCancel(); }}>
      <DialogContent className="max-w-md p-6">
        <DialogHeader>
          <DialogTitle>Edit Employee</DialogTitle>
        </DialogHeader>
        {/* paste page.tsx:754-843 verbatim here (the fields block), replacing: */}
        {/* editForm -> form (prop) everywhere it's read */}
        {/* setEditForm((f) => ({...f, displayName: e.target.value})) (and every other field setter) -> onFormChange((f) => ({...f, displayName: e.target.value})) */}
        {/* departments -> departments (prop) */}
        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-gray-900"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-command-black rounded-xl hover:bg-gray-800 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-gray-900"
          >
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Saving…</> : "Save Changes"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

Note the closing action buttons are already written out above with `onCancel`/`onSave`/`saving` wired — only paste the fields block (754–843) into the marked spot.

- [ ] **Step 2: Update `page.tsx`**

Replace lines 743–864 with:

```tsx
<EditEmployeeModal
  employee={editingEmployee}
  form={editForm}
  onFormChange={setEditForm}
  saving={saving}
  onSave={handleSave}
  onCancel={() => setEditingEmployee(null)}
  departments={departments}
/>
```

Add the import: `import { EditEmployeeModal } from "./components/EditEmployeeModal";`

- [ ] **Step 3: Verify**

`npx tsc --noEmit`, `npm run lint` — clean. Manual check: clicking Edit on any employee opens the modal pre-filled with their data; changing fields and clicking Save Changes persists and closes the modal, updating the table; Cancel closes without saving.

- [ ] **Step 4: Commit**

```bash
git add "app/admin/employees/components/EditEmployeeModal.tsx" "app/admin/employees/page.tsx"
git commit -m "refactor: extract EditEmployeeModal from admin employees page"
```

---

### Task 21: Final admin/employees cleanup + full verification

**Files:**
- Modify: `app/admin/employees/page.tsx` (dead-code removal + import cleanup only)

- [ ] **Step 1: Remove the dead `deleteConfirmId` state**

`deleteConfirmId`/`setDeleteConfirmId` (declared at the original line 84) is never read or written anywhere else in the file — no deactivation-confirmation dialog actually exists in this component's JSX. Delete the `useState` declaration entirely. This is the one sanctioned behavior-level change for this Part (removing genuinely dead state — nothing currently reads it, so nothing changes at runtime).

- [ ] **Step 2: Remove other now-unused imports**

After Tasks 15–20, run `npx tsc --noEmit` and `npm run lint` to find which of `ChevronDown`/`ChevronUp`/`Download`/`Pencil`/`Upload`/`UserPlus`/`Users`/`Loader2`/`RoleBadge`/`Pagination`/`Dialog`/`DialogContent`/`DialogHeader`/`DialogTitle`/`toast` are no longer referenced directly in `page.tsx` (most moved into the new component files; `toast` almost certainly stays, since `handleRoleChange`/`handleSave`/`handleAddEmployee`/export handler all call it). Delete only what lint actually flags as unused.

- [ ] **Step 3: Confirm final line count**

Run `wc -l "app/admin/employees/page.tsx"` — expect roughly 180–250 lines (down from 867), holding: imports, type/util re-imports, the `useAuth`/`useApiClient` hooks, all remaining `useState` declarations (minus `deleteConfirmId`), both effects, all 8 handler functions (`loadEmployees`, `handleRoleChange`, `handleBootstrap`, `handleSyncFile`, `handleAddEmployee`, `handleEdit`, `handleSave`, `handleExport`), the `deptOptions`/`hasActiveFilters`/`isSuperAdmin` derived consts, and a JSX tree that composes the 7 extracted components.

- [ ] **Step 4: Full verification pass**

```bash
npx tsc --noEmit
npm run lint
npm run build
```

All three must succeed with the lint warning count unchanged from before Task 14. Then `npm run dev` and re-run a full manual click-through: filter bar, upload sync flow, export, table role changes, Add modal, Edit modal, pagination, bootstrap empty state (if testable in your environment).

- [ ] **Step 5: Commit**

```bash
git add "app/admin/employees/page.tsx"
git commit -m "refactor: clean up unused imports and dead deleteConfirmId state after admin employees page split"
```

---

## Part C — `app/admin/points/page.tsx`

### Task 22: Extract shared types and pure helpers

**Files:**
- Create: `app/admin/points/types.ts`
- Create: `app/admin/points/utils.ts`
- Modify: `app/admin/points/page.tsx:10-34` (remove, replace with imports), `:113-119` (use `AttendanceResult` type), `:149-150` (use `EmployeesPage` type), `:306-355` (use util imports)

**Interfaces:**
- Produces from `types.ts`: `Department`, `Employee`, `Transaction`, `Budget`, `AttendanceResult`, `EmployeesPage` (all exported types — `AttendanceResult` and `EmployeesPage` are newly promoted from inline shapes currently at lines 113–117 and 150).
- Produces from `utils.ts`: `CATEGORY_BADGE`, `getDepartmentsFromEmployees(employees: Employee[]): Department[]`, `filterEmployeesForBulk(employees: Employee[], currentUserId: string | undefined, deptFilter: string, selected: Set<string>): { selectableEmployees: Employee[]; filteredForBulk: Employee[]; allFilteredSelected: boolean }`, `inputClass`, `thClass`, `tdClass` (all exported).

- [ ] **Step 1: Create `types.ts`**

Move lines 10–27 verbatim, adding `export`, plus two newly-named types:

```ts
export type Department = { id: string; name: string };

export type Employee = {
  id: string;
  displayName: string;
  email: string;
  pointsBalance: number;
  department?: { id: string; name: string } | null;
};

export type Transaction = {
  id: string;
  amount: number;
  note: string | null;
  category: string | null;
  createdAt: string;
  toUser?: { displayName: string };
  fromUser: { displayName: string } | null;
};

export type Budget = { isExempt: boolean; used: number; remaining: number; total: number };

export type AttendanceResult = {
  awarded: number;
  awardedNames?: string[];
  skipped: { notFound: string[]; alreadyAwarded: string[] };
};

export type EmployeesPage = { data: (Employee & { role: string })[]; page: number; pages: number };
```

- [ ] **Step 2: Create `utils.ts`**

Move `CATEGORY_BADGE` (lines 29–34) verbatim adding `export`, plus new pure functions refactored from the inline derived-value expressions at lines 306–324, plus the style constants at lines 351–355:

```ts
import type { Employee, Department } from "./types";

export const CATEGORY_BADGE: Record<string, { label: string; style: string }> = {
  PERFORMANCE: { label: "Performance", style: "bg-violet-50 text-violet-700" },
  TEAMWORK:    { label: "Teamwork",    style: "bg-blue-50 text-blue-700" },
  INNOVATION:  { label: "Innovation",  style: "bg-amber-50 text-amber-700" },
  LEADERSHIP:  { label: "Leadership",  style: "bg-emerald-50 text-emerald-700" },
};

export function getDepartmentsFromEmployees(employees: Employee[]): Department[] {
  return Array.from(
    new Map(
      employees
        .filter((e) => e.department)
        .map((e) => [e.department!.id, e.department!])
    ).values()
  ).sort((a, b) => a.name.localeCompare(b.name));
}

export function filterEmployeesForBulk(
  employees: Employee[],
  currentUserId: string | undefined,
  deptFilter: string,
  selected: Set<string>
) {
  const selectableEmployees = employees.filter((e) => e.id !== currentUserId);
  const filteredForBulk =
    deptFilter === "all"
      ? selectableEmployees
      : selectableEmployees.filter((e) => e.department?.id === deptFilter);
  const allFilteredSelected =
    filteredForBulk.length > 0 && filteredForBulk.every((e) => selected.has(e.id));
  return { selectableEmployees, filteredForBulk, allFilteredSelected };
}

export const inputClass =
  "w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-navy-500/30 focus:border-navy-400 bg-white";
export const thClass =
  "text-left px-3.5 py-2.5 font-mono text-[10px] tracking-[0.09em] uppercase text-table-muted first:pl-5 last:pr-5";
export const tdClass = "px-3.5 py-[11px] text-[13px] first:pl-5 last:pr-5";
```

- [ ] **Step 3: Update `page.tsx`**

Delete lines 10–34. Add after the existing `import { Pagination } from "@/components/ui/pagination";` line:

```ts
import type { Department, Employee, Transaction, Budget, AttendanceResult, EmployeesPage } from "./types";
import { CATEGORY_BADGE, getDepartmentsFromEmployees, filterEmployeesForBulk, inputClass, thClass, tdClass } from "./utils";
```

At the `attendanceResult` state declaration (lines 113–117), change to:

```ts
const [attendanceResult, setAttendanceResult] = useState<AttendanceResult | null>(null);
```

Inside `loadAllEmployees` (line 150), change the local `type Page = ...` declaration to use the imported type instead — delete the local `type Page = ...` line and change both `apiFetch<Page>(...)` calls to `apiFetch<EmployeesPage>(...)`.

At the derived-value block (lines 306–324), replace:

```ts
const departments: Department[] = Array.from(new Map(...).values()).sort(...);
const selectableEmployees = employees.filter((e) => e.id !== dbUser?.id);
const filteredForBulk = bulkDeptFilter === "all" ? selectableEmployees : selectableEmployees.filter(...);
const allFilteredSelected = filteredForBulk.length > 0 && filteredForBulk.every(...);
```

with:

```ts
const departments = getDepartmentsFromEmployees(employees);
const { selectableEmployees, filteredForBulk, allFilteredSelected } = filterEmployeesForBulk(employees, dbUser?.id, bulkDeptFilter, bulkSelected);
```

`toggleEmployee`/`toggleSelectAll` (lines 326–349) stay exactly as they are — they're handlers, not pure derivations. Delete the local `inputClass`/`thClass`/`tdClass` const declarations (lines 351–355) — now imported from `utils.ts`.

- [ ] **Step 4: Verify**

`npx tsc --noEmit` — expect clean (pay attention to `EmployeesPage`'s generic used at both `apiFetch<EmployeesPage>` call sites in `loadAllEmployees`). `npm run lint` — no new errors. Pure code motion, no visual check needed beyond confirming the Bulk tab's employee list and select-all checkbox still work (since `filterEmployeesForBulk` changed from 3 separate `const` lines to 1 destructured call — logically identical, but double-check with a quick manual load of the Bulk tab).

- [ ] **Step 5: Commit**

```bash
git add "app/admin/points/types.ts" "app/admin/points/utils.ts" "app/admin/points/page.tsx"
git commit -m "refactor: extract admin points page types and helpers to sibling files"
```

---

### Task 23: Extract `ActivitySelect` (pure move)

**Files:**
- Create: `app/admin/points/components/ActivitySelect.tsx`
- Modify: `app/admin/points/page.tsx:37-56` (remove, replace with import)

**Interfaces:**
- Produces: `ActivitySelect` component — zero coupling, no substitutions needed, this is a byte-for-byte relocation.

- [ ] **Step 1: Create the component**

Move lines 37–56 verbatim, adding `export`:

```tsx
import { AWARD_ACTIVITIES, AWARD_CATEGORIES, type AwardCategory } from "@/lib/constants/awardActivities";

export function ActivitySelect({ value, onChange }: { value: string; onChange: (key: string) => void }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-navy-500/30 bg-white"
    >
      <option value="">Custom amount…</option>
      {(Object.keys(AWARD_CATEGORIES) as AwardCategory[]).map((cat) => (
        <optgroup key={cat} label={AWARD_CATEGORIES[cat]}>
          {AWARD_ACTIVITIES.filter((a) => a.category === cat).map((a) => (
            <option key={a.key} value={a.key}>
              {a.label} ({a.points} pts)
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
```

- [ ] **Step 2: Update `page.tsx`**

Delete lines 37–56. Add the import: `import { ActivitySelect } from "./components/ActivitySelect";`. Remove `AWARD_CATEGORIES`, `AwardCategory` from the existing `@/lib/constants/awardActivities` import line in `page.tsx` if `npm run lint` flags them unused (the page still needs `AWARD_ACTIVITIES`, `VIOLATION_TYPES`, `findActivity` for the inline `onChange` handlers in Single/Bulk forms — keep those).

- [ ] **Step 3: Verify**

`npx tsc --noEmit`, `npm run lint` — clean. Manual check: Single and Bulk tabs' activity dropdowns still show category-grouped options and update the amount field when a preset is picked.

- [ ] **Step 4: Commit**

```bash
git add "app/admin/points/components/ActivitySelect.tsx" "app/admin/points/page.tsx"
git commit -m "refactor: extract ActivitySelect from admin points page"
```

---

### Task 24: Extract `BudgetBar` (pure move)

**Files:**
- Create: `app/admin/points/components/BudgetBar.tsx`
- Modify: `app/admin/points/page.tsx:58-75` (remove, replace with import)

**Interfaces:**
- Produces: `BudgetBar` component — zero coupling, byte-for-byte relocation.

- [ ] **Step 1: Create the component**

Move lines 58–75 verbatim, adding `export`:

```tsx
import type { Budget } from "../types";

export function BudgetBar({ budget }: { budget: Budget | null }) {
  if (!budget || budget.isExempt) return null;
  const pct = Math.min(100, (budget.used / budget.total) * 100);
  const barColor = budget.remaining === 0 ? "bg-red-500" : budget.remaining < 100 ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div className="mb-4 bg-gray-50 border border-table-border rounded-card px-4 py-3">
      <div className="flex items-center justify-between text-xs mb-1.5">
        <span className="font-medium text-gray-600">Monthly recognition budget</span>
        <span className={`font-semibold ${budget.remaining === 0 ? "text-red-600" : "text-gray-700"}`}>
          {budget.used} / {budget.total} pts used — {budget.remaining} remaining
        </span>
      </div>
      <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update `page.tsx`**

Delete lines 58–75. Add the import: `import { BudgetBar } from "./components/BudgetBar";`

- [ ] **Step 3: Verify**

`npx tsc --noEmit`, `npm run lint` — clean. Manual check: on Single/Bulk tabs, the monthly budget bar shows correct used/remaining values (or is hidden entirely if the current user is budget-exempt).

- [ ] **Step 4: Commit**

```bash
git add "app/admin/points/components/BudgetBar.tsx" "app/admin/points/page.tsx"
git commit -m "refactor: extract BudgetBar from admin points page"
```

---

### Task 25: Extract `AttendanceAwardPanel`

**Files:**
- Create: `app/admin/points/components/AttendanceAwardPanel.tsx`
- Modify: `app/admin/points/page.tsx:390-464` (replace with component usage)

**Interfaces:**
- Consumes: `AttendanceResult` type from `../types`.
- Produces: `AttendanceAwardPanel` component, rendered only when `tab === "attendance"`.

- [ ] **Step 1: Create the component**

```tsx
import { Upload, Loader2, CheckCircle, AlertCircle, XCircle } from "lucide-react";
import type { AttendanceResult } from "../types";

interface AttendanceAwardPanelProps {
  attendanceMonth: string;
  onMonthChange: (value: string) => void;
  attendanceUploading: boolean;
  attendanceResult: AttendanceResult | null;
  attendanceError: string;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  inputClass: string;
}

export function AttendanceAwardPanel(props: AttendanceAwardPanelProps) {
  const { attendanceMonth, onMonthChange, attendanceUploading, attendanceResult, attendanceError, fileInputRef, onFileChange, inputClass } = props;

  return (
    <div className="space-y-4">
      {/* paste page.tsx:390-464 verbatim here, replacing: */}
      {/* attendanceMonth -> attendanceMonth (prop), onChange={(e) => setAttendanceMonth(e.target.value)} -> onChange={(e) => onMonthChange(e.target.value)} */}
      {/* attendanceUploading -> attendanceUploading (prop) */}
      {/* attendanceFileRef -> fileInputRef (prop) */}
      {/* onChange={handleAttendanceFile} (hidden file input) -> onChange={onFileChange} */}
      {/* attendanceResult -> attendanceResult (prop, unchanged reference) */}
      {/* attendanceError -> attendanceError (prop) */}
      {/* inputClass -> inputClass (prop) */}
      {/* Upload, Loader2, CheckCircle, AlertCircle, XCircle icons stay as local imports */}
    </div>
  );
}
```

Do the paste-and-replace now.

- [ ] **Step 2: Update `page.tsx`**

Replace lines 390–464 with:

```tsx
{tab === "attendance" && (
  <AttendanceAwardPanel
    attendanceMonth={attendanceMonth}
    onMonthChange={setAttendanceMonth}
    attendanceUploading={attendanceUploading}
    attendanceResult={attendanceResult}
    attendanceError={attendanceError}
    fileInputRef={attendanceFileRef}
    onFileChange={handleAttendanceFile}
    inputClass={inputClass}
  />
)}
```

Add the import: `import { AttendanceAwardPanel } from "./components/AttendanceAwardPanel";`

- [ ] **Step 3: Verify**

`npx tsc --noEmit`, `npm run lint` — clean. Manual check: Attendance tab shows the month picker, uploading a valid `.xlsx` shows a success breakdown (awarded/already-awarded/not-found), uploading an invalid file shows the error message.

- [ ] **Step 4: Commit**

```bash
git add "app/admin/points/components/AttendanceAwardPanel.tsx" "app/admin/points/page.tsx"
git commit -m "refactor: extract AttendanceAwardPanel from admin points page"
```

---

### Task 26: Extract `DeductPointsForm`

**Files:**
- Create: `app/admin/points/components/DeductPointsForm.tsx`
- Modify: `app/admin/points/page.tsx:465-555` (replace with component usage)

**Interfaces:**
- Consumes: `Employee` type from `../types`, `VIOLATION_TYPES` from `@/lib/constants/awardActivities`.
- Produces: `DeductPointsForm` component, rendered only when `tab === "deduct"`.

- [ ] **Step 1: Create the component**

```tsx
import { Loader2 } from "lucide-react";
import { VIOLATION_TYPES } from "@/lib/constants/awardActivities";
import type { Employee } from "../types";

interface DeductPointsFormProps {
  employees: Employee[];
  deductUserId: string;
  onUserChange: (value: string) => void;
  deductViolation: string;
  onViolationChange: (value: string) => void;
  deductCustomAmount: string;
  onCustomAmountChange: (value: string) => void;
  deductReason: string;
  onReasonChange: (value: string) => void;
  deductSubmitting: boolean;
  deductSuccess: string;
  deductError: string;
  onSubmit: (e: React.FormEvent) => void;
  inputClass: string;
}

export function DeductPointsForm(props: DeductPointsFormProps) {
  const {
    employees, deductUserId, onUserChange, deductViolation, onViolationChange,
    deductCustomAmount, onCustomAmountChange, deductReason, onReasonChange,
    deductSubmitting, deductSuccess, deductError, onSubmit, inputClass,
  } = props;

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {/* paste page.tsx:470-555 verbatim here (the employee select through the submit button), replacing: */}
      {/* employees -> employees (prop, unchanged reference) */}
      {/* deductUserId -> deductUserId (prop), onChange={(e) => setDeductUserId(e.target.value)} -> onChange={(e) => onUserChange(e.target.value)} */}
      {/* deductViolation -> deductViolation (prop), onChange={(e) => setDeductViolation(e.target.value)} -> onChange={(e) => onViolationChange(e.target.value)} */}
      {/* deductCustomAmount -> deductCustomAmount (prop), onChange={(e) => setDeductCustomAmount(e.target.value)} -> onChange={(e) => onCustomAmountChange(e.target.value)} */}
      {/* deductReason -> deductReason (prop), onChange={(e) => setDeductReason(e.target.value)} -> onChange={(e) => onReasonChange(e.target.value)} */}
      {/* the live deduction-preview line (reads deductUserId/employees for name lookup, deductViolation/VIOLATION_TYPES/deductCustomAmount for the amount) -> unchanged logic, just reading from props/imports instead of closure state */}
      {/* deductSubmitting -> deductSubmitting (prop) */}
      {/* deductSuccess, deductError -> props */}
      {/* inputClass -> inputClass (prop) */}
      {/* VIOLATION_TYPES -> imported directly, not a prop */}
      {/* Loader2 stays as a local import */}
    </form>
  );
}
```

Do the paste-and-replace now. Note the original wraps this in `<form onSubmit={handleDeductSubmit}>` at line 466 — the component itself is the `<form>` element (not wrapped again by the parent), so the parent's usage in Step 2 does NOT add another `<form>` around it.

- [ ] **Step 2: Update `page.tsx`**

Replace lines 465–555 with:

```tsx
{tab === "deduct" && (
  <DeductPointsForm
    employees={employees}
    deductUserId={deductUserId}
    onUserChange={setDeductUserId}
    deductViolation={deductViolation}
    onViolationChange={setDeductViolation}
    deductCustomAmount={deductCustomAmount}
    onCustomAmountChange={setDeductCustomAmount}
    deductReason={deductReason}
    onReasonChange={setDeductReason}
    deductSubmitting={deductSubmitting}
    deductSuccess={deductSuccess}
    deductError={deductError}
    onSubmit={handleDeductSubmit}
    inputClass={inputClass}
  />
)}
```

Add the import: `import { DeductPointsForm } from "./components/DeductPointsForm";`

- [ ] **Step 3: Verify**

`npx tsc --noEmit`, `npm run lint` — clean. Manual check: Deduct tab lets you pick an employee, a violation type (or custom amount), enter a reason, see the live deduction preview, and submit — success message shows, employee's balance-floor-at-0 messaging works correctly if applicable.

- [ ] **Step 4: Commit**

```bash
git add "app/admin/points/components/DeductPointsForm.tsx" "app/admin/points/page.tsx"
git commit -m "refactor: extract DeductPointsForm from admin points page"
```

---

### Task 27: Extract `SingleAwardForm`

**Files:**
- Create: `app/admin/points/components/SingleAwardForm.tsx`
- Modify: `app/admin/points/page.tsx:556-634` (replace with component usage)

**Interfaces:**
- Consumes: `Employee` type from `../types`, `findActivity` from `@/lib/constants/awardActivities`, `ActivitySelect` from `./ActivitySelect`.
- Produces: `SingleAwardForm` component, rendered only when `tab === "single"`.

- [ ] **Step 1: Create the component**

```tsx
import { Loader2 } from "lucide-react";
import { findActivity } from "@/lib/constants/awardActivities";
import type { Employee } from "../types";
import { ActivitySelect } from "./ActivitySelect";

interface SingleAwardFormProps {
  employees: Employee[];
  currentUserId: string | undefined;
  toUserId: string;
  onToUserChange: (value: string) => void;
  amount: string;
  onAmountChange: (value: string) => void;
  note: string;
  onNoteChange: (value: string) => void;
  activity: string;
  onActivityChange: (key: string) => void;
  submitting: boolean;
  success: string;
  error: string;
  onSubmit: (e: React.FormEvent) => void;
  inputClass: string;
}

export function SingleAwardForm(props: SingleAwardFormProps) {
  const {
    employees, currentUserId, toUserId, onToUserChange, amount, onAmountChange,
    note, onNoteChange, activity, onActivityChange, submitting, success, error, onSubmit, inputClass,
  } = props;

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {/* paste page.tsx:557-634 verbatim here, replacing: */}
      {/* employees.filter((e) => e.id !== dbUser?.id) (employee select options) -> employees.filter((e) => e.id !== currentUserId) */}
      {/* toUserId -> toUserId (prop), onChange={(e) => setToUserId(e.target.value)} -> onChange={(e) => onToUserChange(e.target.value)} */}
      {/* <ActivitySelect value={activity} onChange={(key) => { setActivity(key); const a = findActivity(key); if (a) setAmount(String(a.points)); }} /> */}
      {/*   -> <ActivitySelect value={activity} onChange={onActivityChange} /> */}
      {/*   (the findActivity-driven amount side effect moves INTO onActivityChange's implementation at the call site in page.tsx, not inside this component — see Step 2) */}
      {/* amount -> amount (prop), onChange={(e) => setAmount(e.target.value)} -> onChange={(e) => onAmountChange(e.target.value)}; the field's read-only-when-activity-chosen behavior (if present in the original) stays keyed off the activity prop */}
      {/* note -> note (prop), onChange={(e) => setNote(e.target.value)} -> onChange={(e) => onNoteChange(e.target.value)} */}
      {/* success, error -> props */}
      {/* submitting -> submitting (prop) */}
      {/* inputClass -> inputClass (prop) */}
      {/* Loader2 stays as a local import */}
    </form>
  );
}
```

Do the paste-and-replace now, following the `ActivitySelect` substitution note carefully — the `findActivity` lookup logic must be preserved but relocated to the parent's callback (Step 2), since the component now only forwards the selected key via `onActivityChange`.

- [ ] **Step 2: Update `page.tsx`**

Replace lines 556–634 with:

```tsx
{tab === "single" && (
  <SingleAwardForm
    employees={employees}
    currentUserId={dbUser?.id}
    toUserId={toUserId}
    onToUserChange={setToUserId}
    amount={amount}
    onAmountChange={setAmount}
    note={note}
    onNoteChange={setNote}
    activity={activity}
    onActivityChange={(key) => {
      setActivity(key);
      const a = findActivity(key);
      if (a) setAmount(String(a.points));
    }}
    submitting={submitting}
    success={success}
    error={error}
    onSubmit={handleSingleSubmit}
    inputClass={inputClass}
  />
)}
```

Add the import: `import { SingleAwardForm } from "./components/SingleAwardForm";`. Confirm `findActivity` stays imported in `page.tsx` (it's used here) — do not remove it from the `@/lib/constants/awardActivities` import line.

- [ ] **Step 3: Verify**

`npx tsc --noEmit`, `npm run lint` — clean. Manual check: Single tab — pick an employee, pick an activity preset (amount auto-fills), or type a custom amount; add a note; submit — success message shows, budget bar updates, transaction appears in history.

- [ ] **Step 4: Commit**

```bash
git add "app/admin/points/components/SingleAwardForm.tsx" "app/admin/points/page.tsx"
git commit -m "refactor: extract SingleAwardForm from admin points page"
```

---

### Task 28: Extract `BulkAwardForm`

**Files:**
- Create: `app/admin/points/components/BulkAwardForm.tsx`
- Modify: `app/admin/points/page.tsx:635-759` (replace with component usage)

**Interfaces:**
- Consumes: `Department`, `Employee` types from `../types`, `findActivity` from `@/lib/constants/awardActivities`, `ActivitySelect` from `./ActivitySelect`.
- Produces: `BulkAwardForm` component, rendered only when `tab === "bulk"`.

- [ ] **Step 1: Create the component**

```tsx
import { Loader2 } from "lucide-react";
import { findActivity } from "@/lib/constants/awardActivities";
import type { Department, Employee } from "../types";
import { ActivitySelect } from "./ActivitySelect";

interface BulkAwardFormProps {
  departments: Department[];
  filteredForBulk: Employee[];
  bulkSelected: Set<string>;
  allFilteredSelected: boolean;
  bulkDeptFilter: string;
  onDeptFilterChange: (value: string) => void;
  bulkAmount: string;
  onAmountChange: (value: string) => void;
  bulkNote: string;
  onNoteChange: (value: string) => void;
  bulkActivity: string;
  onActivityChange: (key: string) => void;
  bulkSubmitting: boolean;
  bulkSuccess: string;
  bulkError: string;
  onToggleEmployee: (id: string) => void;
  onToggleSelectAll: () => void;
  onSubmit: (e: React.FormEvent) => void;
  inputClass: string;
}

export function BulkAwardForm(props: BulkAwardFormProps) {
  const {
    departments, filteredForBulk, bulkSelected, allFilteredSelected, bulkDeptFilter, onDeptFilterChange,
    bulkAmount, onAmountChange, bulkNote, onNoteChange, bulkActivity, onActivityChange,
    bulkSubmitting, bulkSuccess, bulkError, onToggleEmployee, onToggleSelectAll, onSubmit, inputClass,
  } = props;

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {/* paste page.tsx:636-759 verbatim here, replacing: */}
      {/* departments -> departments (prop, dept filter select options) */}
      {/* bulkDeptFilter -> bulkDeptFilter (prop), onChange={(e) => setBulkDeptFilter(e.target.value)} -> onChange={(e) => onDeptFilterChange(e.target.value)} */}
      {/* filteredForBulk -> filteredForBulk (prop, employee checklist source) */}
      {/* bulkSelected -> bulkSelected (prop, checkbox checked state via .has(e.id)) */}
      {/* onChange={() => toggleEmployee(e.id)} (per-row checkbox) -> onChange={() => onToggleEmployee(e.id)} */}
      {/* allFilteredSelected -> allFilteredSelected (prop, select-all button label/state) */}
      {/* onClick={toggleSelectAll} (select-all button) -> onClick={onToggleSelectAll} */}
      {/* <ActivitySelect value={bulkActivity} onChange={(key) => { setBulkActivity(key); const a = findActivity(key); if (a) setBulkAmount(String(a.points)); }} /> */}
      {/*   -> <ActivitySelect value={bulkActivity} onChange={onActivityChange} /> */}
      {/*   (the findActivity-driven amount side effect moves INTO onActivityChange's implementation at the call site in page.tsx — see Step 2) */}
      {/* bulkAmount -> bulkAmount (prop), onChange={(e) => setBulkAmount(e.target.value)} -> onChange={(e) => onAmountChange(e.target.value)} */}
      {/* bulkNote -> bulkNote (prop), onChange={(e) => setBulkNote(e.target.value)} -> onChange={(e) => onNoteChange(e.target.value)} */}
      {/* bulkSuccess, bulkError -> props */}
      {/* bulkSubmitting -> bulkSubmitting (prop) — also drives the submit button's dynamic label (e.g. "Award N employees") via bulkSelected.size, which is still readable from the bulkSelected prop */}
      {/* inputClass -> inputClass (prop) */}
      {/* Loader2 stays as a local import */}
    </form>
  );
}
```

Do the paste-and-replace now, following the `ActivitySelect` substitution note carefully, same pattern as Task 27.

- [ ] **Step 2: Update `page.tsx`**

Replace lines 635–759 with:

```tsx
{tab === "bulk" && (
  <BulkAwardForm
    departments={departments}
    filteredForBulk={filteredForBulk}
    bulkSelected={bulkSelected}
    allFilteredSelected={allFilteredSelected}
    bulkDeptFilter={bulkDeptFilter}
    onDeptFilterChange={setBulkDeptFilter}
    bulkAmount={bulkAmount}
    onAmountChange={setBulkAmount}
    bulkNote={bulkNote}
    onNoteChange={setBulkNote}
    bulkActivity={bulkActivity}
    onActivityChange={(key) => {
      setBulkActivity(key);
      const a = findActivity(key);
      if (a) setBulkAmount(String(a.points));
    }}
    bulkSubmitting={bulkSubmitting}
    bulkSuccess={bulkSuccess}
    bulkError={bulkError}
    onToggleEmployee={toggleEmployee}
    onToggleSelectAll={toggleSelectAll}
    onSubmit={handleBulkSubmit}
    inputClass={inputClass}
  />
)}
```

Add the import: `import { BulkAwardForm } from "./components/BulkAwardForm";`

- [ ] **Step 3: Verify**

`npx tsc --noEmit`, `npm run lint` — clean. Manual check: Bulk tab — filter by department, select individual employees and "Select All"/"Deselect All", pick an activity preset or custom amount, add a note, submit — success message shows the count awarded, budget bar updates, transactions appear in history for each recipient.

- [ ] **Step 4: Commit**

```bash
git add "app/admin/points/components/BulkAwardForm.tsx" "app/admin/points/page.tsx"
git commit -m "refactor: extract BulkAwardForm from admin points page"
```

---

### Task 29: Extract `TransactionHistoryTable`

**Files:**
- Create: `app/admin/points/components/TransactionHistoryTable.tsx`
- Modify: `app/admin/points/page.tsx:764-844` (replace with component usage)

**Interfaces:**
- Consumes: `Transaction` type from `../types`, `CATEGORY_BADGE`/`thClass`/`tdClass` from `../utils`, `Pagination` from `@/components/ui/pagination`.
- Produces: `TransactionHistoryTable` component, always rendered (not gated by `tab`, per the original — confirm this against the current file before assuming; if it IS gated by `tab !== "attendance"` or similar, preserve that exact gate at the call site in Step 2).

- [ ] **Step 1: Create the component**

```tsx
import { History, Loader2 } from "lucide-react";
import { Pagination } from "@/components/ui/pagination";
import type { Transaction } from "../types";
import { CATEGORY_BADGE, thClass, tdClass } from "../utils";

interface TransactionHistoryTableProps {
  transactions: Transaction[];
  loading: boolean;
  error: string | null;
  page: number;
  pages: number;
  onRetry: () => void;
  onPageChange: (page: number) => void;
}

export function TransactionHistoryTable(props: TransactionHistoryTableProps) {
  const { transactions, loading, error, page, pages, onRetry, onPageChange } = props;

  return (
    <div className="bg-white rounded-card border border-table-border">
      {/* paste page.tsx:764-844 verbatim here, replacing: */}
      {/* txError -> error (prop), onClick={() => loadHistory(txPage)} (Retry button) -> onClick={onRetry} */}
      {/* txLoading -> loading (prop) */}
      {/* transactions -> transactions (prop, unchanged reference) */}
      {/* CATEGORY_BADGE -> imported directly, not a prop */}
      {/* thClass, tdClass -> imported directly, not props */}
      {/* txPage, txPages -> page, pages (props) */}
      {/* onPageChange={setTxPage} -> onPageChange={onPageChange} */}
      {/* History, Loader2 icons stay as local imports */}
    </div>
  );
}
```

Do the paste-and-replace now.

- [ ] **Step 2: Update `page.tsx`**

Replace lines 764–844 with:

```tsx
<TransactionHistoryTable
  transactions={transactions}
  loading={txLoading}
  error={txError}
  page={txPage}
  pages={txPages}
  onRetry={() => loadHistory(txPage)}
  onPageChange={setTxPage}
/>
```

Preserve whatever conditional wrapper (if any) the original had around this block — check the current file before assuming it's unconditional. Add the import: `import { TransactionHistoryTable } from "./components/TransactionHistoryTable";`

- [ ] **Step 3: Verify**

`npx tsc --noEmit`, `npm run lint` — clean. Manual check: transactions table shows recipient/awarded-by/points/category badge/note/date columns, loading spinner during fetch, error banner with working Retry on fetch failure, empty state when no transactions exist, pagination navigates correctly and stays in sync after a new award/deduction resets it to page 1.

- [ ] **Step 4: Commit**

```bash
git add "app/admin/points/components/TransactionHistoryTable.tsx" "app/admin/points/page.tsx"
git commit -m "refactor: extract TransactionHistoryTable from admin points page"
```

---

### Task 30: Final admin/points cleanup + full verification

**Files:**
- Modify: `app/admin/points/page.tsx` (import cleanup only)

- [ ] **Step 1: Remove now-unused imports**

After Tasks 23–29, run `npx tsc --noEmit` and `npm run lint` to find which of `AWARD_CATEGORIES`/`AwardCategory` (moved with `ActivitySelect` in Task 23 — confirm these are fully gone from `page.tsx`), `Upload`/`CheckCircle`/`AlertCircle`/`XCircle`/`History` (moved into `AttendanceAwardPanel`/`TransactionHistoryTable`), and `Pagination`/`Loader2` (check carefully — `Loader2` is used by multiple extracted components AND may still be referenced in `page.tsx` if any inline loading state remains at the top level; only remove what lint actually flags) are no longer needed in `page.tsx`. Delete only what's flagged.

- [ ] **Step 2: Confirm final line count**

Run `wc -l "app/admin/points/page.tsx"` — expect roughly 220–300 lines (down from 847), holding: imports, type/util re-imports, the `useAuth`/`useApiClient` hooks, all remaining `useState` declarations, both effects, all 9 handler functions (`loadBudget`, `loadAllEmployees`, `loadHistory`, `handleAttendanceFile`, `handleSingleSubmit`, `handleDeductSubmit`, `handleBulkSubmit`, `toggleEmployee`, `toggleSelectAll`), the `departments`/`selectableEmployees`/`filteredForBulk`/`allFilteredSelected` derivations, the header, the tabs bar, the `BudgetBar` gate, and a JSX tree that composes the 8 extracted components.

- [ ] **Step 3: Full verification pass**

```bash
npx tsc --noEmit
npm run lint
npm run build
```

All three must succeed with the lint warning count unchanged from before Task 22. Then `npm run dev` and re-run a full manual click-through: all 4 tabs (Single/Bulk/Deduct/Attendance), the budget bar, and the transactions table with pagination, to catch any cross-task integration issue a single task's narrower check might have missed.

- [ ] **Step 4: Commit**

```bash
git add "app/admin/points/page.tsx"
git commit -m "refactor: clean up unused imports after admin points page split"
```
