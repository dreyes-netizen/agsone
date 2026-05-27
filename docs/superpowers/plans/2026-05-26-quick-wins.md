# Quick Wins: Confetti + Shoutouts Page + Profile Completeness

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add confetti on wins, a dedicated /shoutouts recognition wall, and a profile completeness bar on the profile page.

**Architecture:** All frontend — no schema or API changes. `canvas-confetti` loaded via dynamic import (SSR-safe). Shoutouts page reuses `GET /api/feed?type=SHOUTOUT` which already supports type filtering and cursor pagination. Profile completeness bar computes from existing `UserProfile` fields.

**Tech Stack:** Next.js 16.2.6 App Router, React, Tailwind CSS v4, Lucide React, canvas-confetti

**Codebase context:**
- Auth: `useAuth()` from `@/lib/auth/AuthProvider`, `useApiClient()` → `apiFetch` with auto Bearer token
- API client: `apiFetch<T>(url, opts?)` returns `T` directly (throws on error)
- `verifyAuth(req)` on all API routes — no new API routes needed in this plan
- Tailwind colors: `bg-[#111827]` dark, `text-navy-600`, `bg-zinc-50/100/200`, `bg-emerald-50`, `bg-amber-50`
- `timeAgo(isoString)` helper at `@/lib/helpers/timeAgo`

---

## File Map

| File | Action |
|------|--------|
| `package.json` | Add `canvas-confetti` + `@types/canvas-confetti` |
| `lib/hooks/useConfetti.ts` | New — confetti hook (dynamic import, SSR-safe) |
| `app/(dashboard)/games/[id]/page.tsx` | Modify — fire confetti on game win |
| `app/(dashboard)/marketplace/page.tsx` | Modify — fire confetti on redemption success |
| `app/(dashboard)/shoutouts/page.tsx` | New — recognition wall page |
| `app/(dashboard)/layout.tsx` | Modify — add Shoutouts to sidebar nav |
| `app/(dashboard)/profile/page.tsx` | Modify — add completeness bar |

---

### Task 1: Install canvas-confetti

**Files:** `package.json`

- [ ] **Step 1: Install packages**

```bash
cd C:\Users\D_Reyes\Desktop\employegames
npm install canvas-confetti
npm install --save-dev @types/canvas-confetti
```

Expected: both added to `package.json` dependencies/devDependencies. No build errors.

- [ ] **Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add canvas-confetti for win celebrations"
```

---

### Task 2: Create useConfetti hook

**Files:**
- Create: `lib/hooks/useConfetti.ts`

- [ ] **Step 1: Create the hook**

```typescript
// lib/hooks/useConfetti.ts
"use client";
import { useCallback } from "react";

export function useConfetti() {
  const fire = useCallback(() => {
    import("canvas-confetti").then(({ default: confetti }) => {
      confetti({
        particleCount: 150,
        spread: 80,
        origin: { y: 0.6 },
        colors: ["#6366f1", "#f59e0b", "#10b981", "#3b82f6", "#ec4899"],
      });
    });
  }, []);
  return { fire };
}
```

- [ ] **Step 2: Verify file exists**

```bash
ls lib/hooks/useConfetti.ts
```

Expected: file present.

- [ ] **Step 3: Commit**

```bash
git add lib/hooks/useConfetti.ts
git commit -m "feat: add useConfetti hook with dynamic import"
```

---

### Task 3: Confetti on game wins

**Files:**
- Modify: `app/(dashboard)/games/[id]/page.tsx`

**Context:** 
- `handleSpin()` at line ~306: after API call, runs `setTimeout(() => { setShowResult(true); setSpinning(false); ... }, 4200)`. Variable `pointsWon` is in scope inside that closure.
- `handleQuizSubmit()` at line ~345: sets `quizResult` state. Quiz result displays `result.pointsWon > 0` at line ~176 inside `QuizView`.
- Current imports: `import { ArrowLeft, Ticket, CheckCircle2, XCircle, Clock } from "lucide-react";`

- [ ] **Step 1: Add useConfetti import**

At the top of `app/(dashboard)/games/[id]/page.tsx`, after existing imports, add:
```typescript
import { useConfetti } from "@/lib/hooks/useConfetti";
```

- [ ] **Step 2: Call the hook inside the page component**

Inside `export default function GamePage()` (or equivalent top-level component), add near the top of the component body, alongside other state declarations:
```typescript
const { fire: fireConfetti } = useConfetti();
```

- [ ] **Step 3: Fire confetti on spin win**

Find `handleSpin()`. Inside the `setTimeout` callback, after `setShowResult(true)`, add:
```typescript
if (pointsWon > 0) fireConfetti();
```

The setTimeout block becomes:
```typescript
setTimeout(() => {
  setShowResult(true);
  setSpinning(false);
  setGame((g) => g ? { ...g, playsToday: g.playsToday + 1, canPlay: g.playsToday + 1 < g.dailyPlaysLimit } : g);
  if (pointsWon > 0) fireConfetti();
}, 4200);
```

- [ ] **Step 4: Fire confetti on quiz win**

Find `handleQuizSubmit()`. After `setQuizResult({...})` call, add:
```typescript
if (res.data.pointsWon > 0) fireConfetti();
```

- [ ] **Step 5: Verify no TypeScript errors**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors on this file.

- [ ] **Step 6: Commit**

```bash
git add "app/(dashboard)/games/[id]/page.tsx"
git commit -m "feat: fire confetti on game win"
```

---

### Task 4: Confetti on marketplace redemption

**Files:**
- Modify: `app/(dashboard)/marketplace/page.tsx`

**Context:** `handleRedeem()` at line ~41: on success calls `setToast({ type: "success", msg: ... })`. `useConfetti` hook not yet imported.

- [ ] **Step 1: Add import**

In `app/(dashboard)/marketplace/page.tsx`, add after existing lucide import:
```typescript
import { useConfetti } from "@/lib/hooks/useConfetti";
```

- [ ] **Step 2: Call hook in component**

Inside `MarketplacePage()`, add near top of component body:
```typescript
const { fire: fireConfetti } = useConfetti();
```

- [ ] **Step 3: Fire on success**

In `handleRedeem()`, after `setToast({ type: "success", ... })`, add:
```typescript
fireConfetti();
```

The try block becomes:
```typescript
try {
  await apiFetch("/api/redemptions", { method: "POST", body: JSON.stringify({ rewardId: reward.id }) });
  setBalance((b) => b - reward.pointCost);
  setToast({ type: "success", msg: `"${reward.name}" redeemed! Pending HR approval.` });
  fireConfetti();
} catch (err) {
  setToast({ type: "error", msg: err instanceof Error ? err.message : "Failed to redeem" });
}
```

- [ ] **Step 4: Commit**

```bash
git add "app/(dashboard)/marketplace/page.tsx"
git commit -m "feat: fire confetti on marketplace redemption"
```

---

### Task 5: Shoutouts recognition wall page

**Files:**
- Create: `app/(dashboard)/shoutouts/page.tsx`

**Context:** `GET /api/feed?type=SHOUTOUT` returns `{ data: Post[], nextCursor: string | null }`. Each shoutout post has: `id`, `content`, `createdAt`, `author: { displayName, avatarUrl }`, `recipient: { id, displayName, avatarUrl } | null`. The feed already supports `type` and `cursor` query params.

- [ ] **Step 1: Create the page**

```typescript
// app/(dashboard)/shoutouts/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useApiClient } from "@/lib/hooks/useApiClient";
import { Sparkles, Search } from "lucide-react";
import { timeAgo } from "@/lib/helpers/timeAgo";

type Shoutout = {
  id: string;
  content: string;
  createdAt: string;
  author: { displayName: string; avatarUrl: string | null };
  recipient: { id: string; displayName: string; avatarUrl: string | null } | null;
};

function Avatar({ name, url }: { name: string; url: string | null }) {
  if (url) return <img src={url} alt={name} className="w-8 h-8 rounded-full object-cover" />;
  return (
    <div className="w-8 h-8 rounded-full bg-navy-100 flex items-center justify-center text-navy-600 font-bold text-xs">
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

export default function ShoutoutsPage() {
  const { user, loading: authLoading } = useAuth();
  const { apiFetch } = useApiClient();
  const [shoutouts, setShoutouts] = useState<Shoutout[]>([]);
  const [loading, setLoading] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (authLoading || !user) return;
    load(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user]);

  async function load(cursor: string | null) {
    const params = new URLSearchParams({ type: "SHOUTOUT" });
    if (cursor) params.set("cursor", cursor);
    const res = await apiFetch<{ data: Shoutout[]; nextCursor: string | null }>(`/api/feed?${params}`);
    if (cursor) {
      setShoutouts((prev) => [...prev, ...res.data]);
    } else {
      setShoutouts(res.data);
    }
    setNextCursor(res.nextCursor);
    setLoading(false);
    setLoadingMore(false);
  }

  const filtered = shoutouts.filter((s) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      s.author.displayName.toLowerCase().includes(q) ||
      (s.recipient?.displayName.toLowerCase().includes(q) ?? false) ||
      s.content.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Recognition Wall</h1>
          <p className="text-zinc-500 text-sm mt-1">Every shoutout, every colleague who went above and beyond.</p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input
            type="text"
            placeholder="Search by name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-4 py-2 text-sm border border-zinc-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-navy-500/20 focus:border-navy-400 transition w-52"
          />
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-zinc-200 p-4 animate-pulse">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-full bg-zinc-100" />
                <div className="h-3 bg-zinc-100 rounded w-24" />
              </div>
              <div className="h-3 bg-zinc-100 rounded w-full mb-2" />
              <div className="h-3 bg-zinc-100 rounded w-3/4" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 rounded-xl border border-zinc-200 bg-white text-center">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center mb-4">
            <Sparkles className="w-7 h-7 text-amber-400" />
          </div>
          <p className="text-zinc-900 font-semibold text-lg">
            {search ? "No matches found" : "No shoutouts yet"}
          </p>
          <p className="text-zinc-400 text-sm mt-1">
            {search ? "Try a different name or keyword." : "Head to the Feed to recognize a colleague!"}
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((s) => (
              <div key={s.id} className="bg-white rounded-xl border border-zinc-200 overflow-hidden hover:shadow-md transition-shadow">
                <div className="h-1 bg-gradient-to-r from-amber-400 to-yellow-300" />
                <div className="p-4 space-y-3">
                  <div className="flex items-center gap-1.5 flex-wrap text-sm">
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Avatar name={s.author.displayName} url={s.author.avatarUrl} />
                      <span className="font-semibold text-zinc-800">{s.author.displayName}</span>
                    </div>
                    <span className="text-amber-600 font-medium flex items-center gap-1 shrink-0">
                      <Sparkles className="w-3.5 h-3.5" /> shouted out
                    </span>
                    {s.recipient && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Avatar name={s.recipient.displayName} url={s.recipient.avatarUrl} />
                        <span className="font-semibold text-zinc-800">{s.recipient.displayName}</span>
                      </div>
                    )}
                  </div>
                  <p className="text-sm text-zinc-600 leading-relaxed line-clamp-3">{s.content}</p>
                  <p className="text-xs text-zinc-400">{timeAgo(s.createdAt)}</p>
                </div>
              </div>
            ))}
          </div>
          {nextCursor && !search && (
            <div className="flex justify-center">
              <button
                onClick={() => { setLoadingMore(true); load(nextCursor); }}
                disabled={loadingMore}
                className="px-6 py-2 text-sm font-medium bg-white border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-colors disabled:opacity-50"
              >
                {loadingMore ? "Loading…" : "Load more"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify no TypeScript errors**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "app/(dashboard)/shoutouts/page.tsx"
git commit -m "feat: add /shoutouts recognition wall page"
```

---

### Task 6: Add Shoutouts to sidebar nav

**Files:**
- Modify: `app/(dashboard)/layout.tsx`

**Context:** `mainNav` array at line ~15. Currently has entries from Home through Feedback. Pattern: `{ href: string; label: string; icon: React.ElementType }`. `Sparkles` is already imported in feed/page.tsx but not in layout.tsx. Import it from lucide-react.

- [ ] **Step 1: Add Sparkles import**

In `app/(dashboard)/layout.tsx`, find the lucide-react import line and add `Sparkles`:

Current:
```typescript
import {
  Home, ShoppingBag, Trophy, User, ShieldCheck, LogOut,
  Rss, Gamepad2, Menu, Target, UtensilsCrossed, MessageSquare,
} from "lucide-react";
```

New:
```typescript
import {
  Home, ShoppingBag, Trophy, User, ShieldCheck, LogOut,
  Rss, Gamepad2, Menu, Target, UtensilsCrossed, MessageSquare, Sparkles,
} from "lucide-react";
```

- [ ] **Step 2: Add shoutouts to mainNav**

Find `mainNav` array. After `{ href: "/leaderboard", label: "Leaderboard", icon: Trophy }`, add:
```typescript
{ href: "/shoutouts",   label: "Shoutouts",   icon: Sparkles },
```

Full updated array:
```typescript
const mainNav = [
  { href: "/dashboard",   label: "Home",        icon: Home },
  { href: "/feed",        label: "Feed",        icon: Rss },
  { href: "/missions",    label: "Missions",    icon: Target },
  { href: "/marketplace", label: "Marketplace", icon: ShoppingBag },
  { href: "/food",        label: "Food",        icon: UtensilsCrossed },
  { href: "/games",       label: "Games",       icon: Gamepad2 },
  { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
  { href: "/shoutouts",   label: "Shoutouts",   icon: Sparkles },
  { href: "/profile",     label: "Profile",     icon: User },
  { href: "/feedback",    label: "Feedback",    icon: MessageSquare },
];
```

- [ ] **Step 3: Commit**

```bash
git add "app/(dashboard)/layout.tsx"
git commit -m "feat: add Shoutouts link to sidebar nav"
```

---

### Task 7: Profile completeness bar

**Files:**
- Modify: `app/(dashboard)/profile/page.tsx`

**Context:** 
- `UserProfile` type already has `displayName`, `avatarUrl`, `birthday`, `department: { id, name } | null`
- The profile page has tabs: "overview" | "points" | "badges"
- The overview tab starts around line 160 with the avatar/name header area
- Import `X` and `CheckCircle2` (or use Check) — Check is available from lucide-react

Completeness items to track:
- Display name set (always true from Google) → 25%
- Profile photo set (`!!profile.avatarUrl`) → 25%
- Birthday set (`!!profile.birthday`) → 25%
- Department assigned (`!!profile.department`) → 25%

When 100%, hide the bar. When < 100%, show a subtle banner at top of overview tab with missing items and a note to visit profile settings or contact HR.

- [ ] **Step 1: Add CompletenessBar component**

In `app/(dashboard)/profile/page.tsx`, after the imports and before `export default function ProfilePage()`, add this component:

```typescript
function CompletenessBar({ profile }: { profile: UserProfile }) {
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
    <div className="bg-white rounded-xl border border-zinc-200 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-zinc-700">Profile completeness</p>
        <span className="text-sm font-bold text-navy-600">{pct}%</span>
      </div>
      <div className="w-full bg-zinc-100 rounded-full h-1.5">
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
                : "bg-zinc-50 border-zinc-200 text-zinc-500"
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
      <p className="text-xs text-zinc-400">
        Complete your profile to unlock features like milestone rewards and birthday bonuses.
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Insert CompletenessBar in the overview tab**

Find where the overview tab content starts. It will be inside a conditional like `{activeTab === "overview" && (`. Add `<CompletenessBar profile={profile} />` as the first element inside that tab section, before the avatar/name card.

Search for the line that renders the avatar/player card (it will have `<PlayerAvatar` or similar). Insert the CompletenessBar just before that block, inside the overview tab wrapper:

```tsx
{activeTab === "overview" && (
  <div className="space-y-4">
    <CompletenessBar profile={profile} />
    {/* ... rest of overview content unchanged ... */}
  </div>
)}
```

- [ ] **Step 3: Verify no TypeScript errors**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add "app/(dashboard)/profile/page.tsx"
git commit -m "feat: add profile completeness bar to profile page"
```

---

## Self-Review Checklist

- [x] Confetti: spin wheel win, quiz win, marketplace redemption — all covered
- [x] Confetti: dynamic import (SSR-safe), no server-side import issues
- [x] Shoutouts page: uses existing API, cursor pagination, client-side search, empty states
- [x] Shoutouts page: added to sidebar nav
- [x] Profile completeness: shows 4 items, hides at 100%, motivates birthday/department completion
- [x] No schema changes, no new API routes
- [x] No placeholders — all code is complete
