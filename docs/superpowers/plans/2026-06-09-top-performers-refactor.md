# Top Performers Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the competitive numbered leaderboard with a recognition-focused "Top Performers" widget across the dashboard sidebar, the full leaderboard page, and the nav.

**Architecture:** Pure UI refactoring across 3 files — no API changes, no new files. The existing `/api/leaderboard` endpoint is reused as-is; we stop rendering rank numbers and the podium. The URL `/leaderboard` stays unchanged to avoid broken links.

**Tech Stack:** Next.js 15 App Router, React, Tailwind CSS, lucide-react

---

## File Map

| File | Change |
|---|---|
| `app/(dashboard)/layout.tsx` | Swap nav item label + icon: Leaderboard/Trophy → Top Performers/Star |
| `app/(dashboard)/dashboard/page.tsx` | Remove Rank stat chip; replace leaderboard snippet with Top Performers widget |
| `app/(dashboard)/leaderboard/page.tsx` | Rename page title, remove podium, remove rank numbers from list |

---

### Task 1: Update nav — Leaderboard → Top Performers

**Files:**
- Modify: `app/(dashboard)/layout.tsx`

- [ ] **Step 1: Swap Trophy import for Star in layout.tsx**

Open `app/(dashboard)/layout.tsx`. Find the lucide-react import line:

```typescript
import {
  Home, ShoppingBag, Trophy, User, ShieldCheck, LogOut,
  Rss, Menu, Target, UtensilsCrossed, MessageSquare, Sparkles, Swords, Search, Pill, Puzzle,
} from "lucide-react";
```

Replace with:

```typescript
import {
  Home, ShoppingBag, Star, User, ShieldCheck, LogOut,
  Rss, Menu, Target, UtensilsCrossed, MessageSquare, Sparkles, Swords, Search, Pill, Puzzle,
} from "lucide-react";
```

- [ ] **Step 2: Update the nav item for the leaderboard route**

Find this entry in the `mainNav` array:

```typescript
{ href: "/leaderboard", label: "Leaderboard", icon: Trophy },
```

Replace with:

```typescript
{ href: "/leaderboard", label: "Top Performers", icon: Star },
```

- [ ] **Step 3: Verify no remaining Trophy references**

Run in terminal:
```
Select-String -Path "app/(dashboard)/layout.tsx" -Pattern "Trophy"
```
Expected: no matches.

- [ ] **Step 4: Commit**

```bash
git add "app/(dashboard)/layout.tsx"
git commit -m "feat: rename Leaderboard nav item to Top Performers"
```

---

### Task 2: Update dashboard page — remove Rank stat, replace leaderboard widget

**Files:**
- Modify: `app/(dashboard)/dashboard/page.tsx`

- [ ] **Step 1: Remove Trophy from the import and clean up derived state**

Open `app/(dashboard)/dashboard/page.tsx`. Find the lucide-react import:

```typescript
import {
  Rss, Trophy, Gamepad2, ShoppingBag, Flame, Star, Coins,
  Target, Swords,
} from "lucide-react";
```

Replace with (Trophy removed — no longer used):

```typescript
import {
  Rss, Gamepad2, ShoppingBag, Flame, Star, Coins,
  Target, Swords,
} from "lucide-react";
```

- [ ] **Step 2: Remove derived state that depended on rank numbers**

Find these three lines (they appear just before the JSX return):

```typescript
const myRank = leaderboard.find((e) => e.isCurrentUser)?.rank;
const top3 = leaderboard.slice(0, 3);
const meNotInTop3 = myRank && myRank > 3 ? leaderboard.find((e) => e.isCurrentUser) : null;
```

Delete all three lines entirely. The `leaderboard` state and its fetch stay — we still need the data for the widget.

- [ ] **Step 3: Remove the Rank chip from the stat strip**

Find the stats array inside the stat strip section:

```typescript
{ icon: <Coins className="w-3.5 h-3.5 text-navy-500" />, label: "Points", value: profile?.pointsBalance?.toLocaleString() },
{ icon: <Star className="w-3.5 h-3.5 text-violet-500" />, label: "Level", value: profile?.level },
{ icon: <Flame className="w-3.5 h-3.5 text-orange-400" />, label: "Streak", value: profile ? `${profile.streakDays}d` : undefined },
{ icon: <Trophy className="w-3.5 h-3.5 text-yellow-500" />, label: "Rank", value: myRank ? `#${myRank}` : undefined },
```

Replace with (Rank chip removed):

```typescript
{ icon: <Coins className="w-3.5 h-3.5 text-navy-500" />, label: "Points", value: profile?.pointsBalance?.toLocaleString() },
{ icon: <Star className="w-3.5 h-3.5 text-violet-500" />, label: "Level", value: profile?.level },
{ icon: <Flame className="w-3.5 h-3.5 text-orange-400" />, label: "Streak", value: profile ? `${profile.streakDays}d` : undefined },
```

- [ ] **Step 4: Replace the leaderboard snippet widget with Top Performers**

Find the entire leaderboard snippet block in the right column — it starts with:

```tsx
{/* Leaderboard snippet */}
<div className="bg-white rounded-xl border border-zinc-100 overflow-hidden">
  <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-50">
    <div className="flex items-center gap-1.5">
      <Trophy className="w-3.5 h-3.5 text-yellow-500" />
      <span className="text-xs font-semibold text-zinc-700">Leaderboard</span>
    </div>
    <Link href="/leaderboard" className="text-xs text-navy-600 hover:text-navy-700 font-medium">See all →</Link>
  </div>
  {loading ? (
    <div className="p-4 space-y-3 animate-pulse">
      {[1, 2, 3].map((i) => <div key={i} className="h-8 bg-zinc-100 rounded" />)}
    </div>
  ) : top3.length === 0 ? (
    <p className="text-xs text-zinc-400 text-center py-6">No rankings yet</p>
  ) : (
    <div>
      {top3.map((entry, i) => (
        <div key={entry.userId} className={`flex items-center gap-2.5 px-4 py-2.5 ${entry.isCurrentUser ? "bg-navy-50/50" : "hover:bg-zinc-50/60"} transition-colors`}>
          <span className="text-base shrink-0">{MEDAL[i]}</span>
          <Link href={`/employees/${entry.userId}`}><Avatar url={entry.avatarUrl} name={entry.displayName} size="w-6 h-6" /></Link>
          <Link href={`/employees/${entry.userId}`} className={`text-xs font-medium truncate flex-1 min-w-0 hover:underline ${entry.isCurrentUser ? "text-navy-700 font-semibold" : "text-zinc-700"}`}>
            {entry.displayName}
          </Link>
          <span className="text-xs font-bold tabular-nums text-zinc-500 shrink-0">
            {entry.points.toLocaleString()}
          </span>
        </div>
      ))}
      {meNotInTop3 && (
        <>
          <div className="border-t border-dashed border-zinc-100 mx-4" />
          <div className="flex items-center gap-2.5 px-4 py-2.5 bg-navy-50/50">
            <span className="text-xs font-bold text-navy-600 shrink-0 w-6 text-center">#{meNotInTop3.rank}</span>
            <Avatar url={meNotInTop3.avatarUrl} name={meNotInTop3.displayName} size="w-6 h-6" />
            <span className="text-xs font-semibold text-navy-700 truncate flex-1 min-w-0">You</span>
            <span className="text-xs font-bold tabular-nums text-zinc-500 shrink-0">
              {meNotInTop3.points.toLocaleString()}
            </span>
          </div>
        </>
      )}
    </div>
  )}
</div>
```

Replace the entire block with:

```tsx
{/* Top Performers widget */}
<div className="bg-white rounded-xl border border-zinc-100 overflow-hidden">
  <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-50">
    <div className="flex items-center gap-1.5">
      <Star className="w-3.5 h-3.5 text-yellow-500" />
      <span className="text-xs font-semibold text-zinc-700">Top Performers</span>
    </div>
    <Link href="/leaderboard" className="text-xs text-navy-600 hover:text-navy-700 font-medium">See all →</Link>
  </div>
  {loading ? (
    <div className="p-4 space-y-3 animate-pulse">
      {[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-8 bg-zinc-100 rounded" />)}
    </div>
  ) : leaderboard.length === 0 ? (
    <p className="text-xs text-zinc-400 text-center py-6">No data yet</p>
  ) : (
    <div>
      {leaderboard.slice(0, 5).map((entry) => (
        <div key={entry.userId} className={`flex items-center gap-2.5 px-4 py-2.5 ${entry.isCurrentUser ? "bg-navy-50/50" : "hover:bg-zinc-50/60"} transition-colors`}>
          <Link href={`/employees/${entry.userId}`}><Avatar url={entry.avatarUrl} name={entry.displayName} size="w-6 h-6" /></Link>
          <Link href={`/employees/${entry.userId}`} className={`text-xs font-medium truncate flex-1 min-w-0 hover:underline ${entry.isCurrentUser ? "text-navy-700 font-semibold" : "text-zinc-700"}`}>
            {entry.isCurrentUser ? "You" : entry.displayName}
          </Link>
          <span className="text-xs font-bold tabular-nums text-zinc-500 shrink-0">
            {entry.points.toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  )}
</div>
```

- [ ] **Step 5: Remove unused MEDAL constant**

Find and delete this line near the top of the file (it's no longer used):

```typescript
const MEDAL = ["🥇", "🥈", "🥉"];
```

- [ ] **Step 6: Verify no TypeScript errors**

Run:
```
npx tsc --noEmit
```
Expected: no errors referencing `Trophy`, `myRank`, `top3`, `meNotInTop3`, or `MEDAL`.

- [ ] **Step 7: Commit**

```bash
git add "app/(dashboard)/dashboard/page.tsx"
git commit -m "feat: replace leaderboard widget with Top Performers on dashboard"
```

---

### Task 3: Repurpose leaderboard page as Top Performers

**Files:**
- Modify: `app/(dashboard)/leaderboard/page.tsx`

- [ ] **Step 1: Remove unused imports and constants**

Open `app/(dashboard)/leaderboard/page.tsx`. Find the import line:

```typescript
import { Medal } from "lucide-react";
```

Delete it entirely — the Medal icon is only used in the podium.

Find and delete these constants (they are only used by the podium):

```typescript
const rankColors: Record<number, string> = {
  1: "text-yellow-500",
  2: "text-zinc-400",
  3: "text-orange-500",
};

const podiumOrder = [1, 0, 2];

const podiumStyle: Record<number, { bg: string; height: string; medal: React.ElementType; medalClass: string }> = {
  0: { bg: "bg-zinc-100 border border-zinc-200",        height: "pt-10", medal: Medal, medalClass: "text-zinc-400" },
  1: { bg: "bg-yellow-50 border border-yellow-200",     height: "pt-4",  medal: Medal, medalClass: "text-yellow-500" },
  2: { bg: "bg-orange-50 border border-orange-200",     height: "pt-14", medal: Medal, medalClass: "text-orange-500" },
};
```

- [ ] **Step 2: Update the page header**

Find:

```tsx
<div>
  <h1 className="text-2xl font-bold text-zinc-900">Leaderboard</h1>
  <p className="text-zinc-500 text-sm mt-1">Top point earners in the company.</p>
</div>
```

Replace with:

```tsx
<div>
  <h1 className="text-2xl font-bold text-zinc-900">Top Performers</h1>
  <p className="text-zinc-500 text-sm mt-1">This month's highest earners.</p>
</div>
```

- [ ] **Step 3: Remove the currentUserEntry variable and rank callout banner**

Find and delete this line (it will become unused once the banner below is removed):

```typescript
const currentUserEntry = entries.find((e) => e.isCurrentUser);
```

Then find and delete this entire block (it shows "you are at rank #X" when outside top 10):

```tsx
{/* ── Current user rank (if outside top 10) ── */}
{currentUserEntry && currentUserEntry.rank > 10 && (
  <div className="bg-navy-50 border border-navy-200 rounded-xl px-4 py-3 flex items-center justify-between">
    <div className="flex items-center gap-3">
      <span className="text-navy-600 font-bold text-sm">#{currentUserEntry.rank}</span>
      <Avatar name={currentUserEntry.displayName} url={currentUserEntry.avatarUrl} />
      <div>
        <p className="font-semibold text-sm text-zinc-900">You</p>
        {currentUserEntry.department && <p className="text-xs text-zinc-500">{currentUserEntry.department}</p>}
      </div>
    </div>
    <span className="font-bold text-navy-600 text-sm">{currentUserEntry.points.toLocaleString()} pts</span>
  </div>
)}
```

- [ ] **Step 4: Remove the podium section**

Find and delete this entire block:

```tsx
{/* ── Podium ── */}
{!loading && entries.length >= 3 && (
  <div className="flex items-end justify-center gap-3 px-2">
    {podiumOrder.map((idx) => {
      const e = entries[idx];
      if (!e) return null;
      const style = podiumStyle[idx];
      const isFirst = idx === 1;
      return (
        <div
          key={e.userId}
          className={`flex-1 rounded-xl text-center ${style.bg} ${style.height} ${e.isCurrentUser ? "ring-2 ring-navy-400 ring-offset-1" : ""}`}
        >
          <div className={`flex flex-col items-center gap-1 px-2 pb-4 ${isFirst ? "pt-4" : "pt-3"}`}>
            <style.medal className={`${isFirst ? "w-10 h-10" : "w-8 h-8"} ${style.medalClass}`} />
            <Avatar name={e.displayName} url={e.avatarUrl} size={isFirst ? "lg" : "md"} />
            <p className={`font-semibold text-zinc-800 mt-1 truncate w-full px-1 ${isFirst ? "text-sm" : "text-xs"}`}>
              {e.isCurrentUser ? "You" : e.displayName}
            </p>
            <p className={`font-bold text-zinc-700 ${isFirst ? "text-sm" : "text-xs"}`}>
              {e.points.toLocaleString()} pts
            </p>
          </div>
        </div>
      );
    })}
  </div>
)}
```

- [ ] **Step 5: Remove rank numbers from the list rows**

Find the list item inside the `<ul>`:

```tsx
<li
  key={e.userId}
  className={`flex items-center gap-3 px-5 py-3 transition-colors ${
    e.isCurrentUser
      ? "bg-navy-50 border-l-2 border-navy-500"
      : "hover:bg-zinc-50 border-l-2 border-transparent"
  }`}
>
  <span className={`w-7 text-center font-bold text-sm tabular-nums ${rankColors[e.rank] ?? "text-zinc-400"}`}>
    {`#${e.rank}`}
  </span>
  <Avatar name={e.displayName} url={e.avatarUrl} />
  <div className="flex-1 min-w-0">
    <p className="font-medium text-sm text-zinc-900 truncate">
      {e.isCurrentUser ? `${e.displayName} (You)` : e.displayName}
    </p>
    {e.department && <p className="text-xs text-zinc-400 truncate">{e.department}</p>}
  </div>
  <span className="font-bold text-navy-600 text-sm tabular-nums">
    {e.points.toLocaleString()} pts
  </span>
</li>
```

Replace with (rank span removed):

```tsx
<li
  key={e.userId}
  className={`flex items-center gap-3 px-5 py-3 transition-colors ${
    e.isCurrentUser
      ? "bg-navy-50 border-l-2 border-navy-500"
      : "hover:bg-zinc-50 border-l-2 border-transparent"
  }`}
>
  <Avatar name={e.displayName} url={e.avatarUrl} />
  <div className="flex-1 min-w-0">
    <p className="font-medium text-sm text-zinc-900 truncate">
      {e.isCurrentUser ? `${e.displayName} (You)` : e.displayName}
    </p>
    {e.department && <p className="text-xs text-zinc-400 truncate">{e.department}</p>}
  </div>
  <span className="font-bold text-navy-600 text-sm tabular-nums">
    {e.points.toLocaleString()} pts
  </span>
</li>
```

- [ ] **Step 6: Verify no TypeScript errors**

Run:
```
npx tsc --noEmit
```
Expected: no errors referencing `Medal`, `rankColors`, `podiumOrder`, `podiumStyle`.

- [ ] **Step 7: Commit**

```bash
git add "app/(dashboard)/leaderboard/page.tsx"
git commit -m "feat: repurpose leaderboard page as Top Performers, remove podium and rank numbers"
```
