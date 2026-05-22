# Point History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Points" tab to the employee profile page showing a unified timeline of point earnings and redemptions, powered by a new `/api/me/points` endpoint.

**Architecture:** Create a single new API endpoint at `GET /api/me/points` that returns the user's balance, total earned, last 50 point transactions, and all redemptions. Update the profile page to add a tab bar (Overview | Points | Badges), moving existing content into tabs and building the new Points tab with a balance card and unified chronological timeline.

**Tech Stack:** Next.js App Router route handler, Prisma, React (client component), Tailwind CSS, shadcn/ui patterns, TypeScript.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `app/api/me/points/route.ts` | **Create** | GET endpoint: balance + totalEarned + transactions + redemptions |
| `app/(dashboard)/profile/page.tsx` | **Modify** | Add tab bar; split Overview / Points / Badges tabs |

---

### Task 1: Create the `/api/me/points` endpoint

**Files:**
- Create: `app/api/me/points/route.ts`

- [ ] **Step 1: Create the route file**

```typescript
// app/api/me/points/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [userData, transactions, redemptions, totalEarnedAgg] = await Promise.all([
    prisma.user.findUnique({
      where: { id: user.id },
      select: { pointsBalance: true, level: true },
    }),
    prisma.pointTransaction.findMany({
      where: { toUserId: user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        amount: true,
        type: true,
        note: true,
        createdAt: true,
        fromUser: { select: { displayName: true } },
      },
    }),
    prisma.redemption.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        pointsSpent: true,
        createdAt: true,
        reward: { select: { name: true } },
      },
    }),
    prisma.pointTransaction.aggregate({
      where: { toUserId: user.id, amount: { gt: 0 } },
      _sum: { amount: true },
    }),
  ]);

  return NextResponse.json({
    data: {
      balance: userData?.pointsBalance ?? 0,
      level: userData?.level ?? 1,
      totalEarned: totalEarnedAgg._sum.amount ?? 0,
      transactions,
      redemptions,
    },
  });
}
```

- [ ] **Step 2: Verify the endpoint compiles**

Run the dev server and call the endpoint:
```
npm run dev
```
Then in a separate terminal (or browser with auth cookie):
```
curl http://localhost:3000/api/me/points
```
Expected: JSON response with `data.balance`, `data.totalEarned`, `data.transactions` (array), `data.redemptions` (array). No 500 errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/me/points/route.ts
git commit -m "feat: add GET /api/me/points endpoint with balance, transactions, redemptions"
```

---

### Task 2: Refactor profile page to use tabs

**Files:**
- Modify: `app/(dashboard)/profile/page.tsx`

This task replaces the single-scroll layout with a tabbed layout: **Overview** (profile card + stats + birthday), **Points** (balance card + unified timeline), **Badges** (badges grid). The existing fetch of `/api/points/history` is replaced by `/api/me/points`.

- [ ] **Step 1: Update TypeScript types at the top of the file**

Replace the existing `Transaction` type and add new types for the new API shape. Find this block (around line 28–35):

```typescript
type Transaction = {
  id: string;
  amount: number;
  type: string;
  note: string | null;
  createdAt: string;
  fromUser: { displayName: string; avatarUrl: string | null } | null;
};
```

Replace it with:

```typescript
type PointTx = {
  id: string;
  amount: number;
  type: string;
  note: string | null;
  createdAt: string;
  fromUser: { displayName: string } | null;
};

type RedemptionTx = {
  id: string;
  pointsSpent: number;
  createdAt: string;
  reward: { name: string };
};

type PointsData = {
  balance: number;
  level: number;
  totalEarned: number;
  transactions: PointTx[];
  redemptions: RedemptionTx[];
};

type TimelineEntry =
  | { kind: "earn"; data: PointTx }
  | { kind: "redeem"; data: RedemptionTx };
```

- [ ] **Step 2: Add tab state and update component state declarations**

Find the existing state declarations inside `ProfilePage` (around line 77–82):

```typescript
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [birthdayEdit, setBirthdayEdit] = useState("");
  const [birthdaySaving, setBirthdaySaving] = useState(false);
  const [birthdayError, setBirthdayError] = useState("");
```

Replace with:

```typescript
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [pointsData, setPointsData] = useState<PointsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "points" | "badges">("overview");
  const [visibleCount, setVisibleCount] = useState(10);
  const [birthdayEdit, setBirthdayEdit] = useState("");
  const [birthdaySaving, setBirthdaySaving] = useState(false);
  const [birthdayError, setBirthdayError] = useState("");
```

- [ ] **Step 3: Update the useEffect to fetch from the new endpoint**

Find the existing `useEffect` (around line 84–95):

```typescript
  useEffect(() => {
    if (authLoading || !authUser) return;
    Promise.all([
      apiFetch<{ data: UserProfile }>("/api/me"),
      apiFetch<{ data: Transaction[] }>("/api/points/history"),
    ]).then(([me, hist]) => {
      setProfile(me.data);
      setTransactions(hist.data);
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, authUser]);
```

Replace with:

```typescript
  useEffect(() => {
    if (authLoading || !authUser) return;
    Promise.all([
      apiFetch<{ data: UserProfile }>("/api/me"),
      apiFetch<{ data: PointsData }>("/api/me/points"),
    ]).then(([me, pts]) => {
      setProfile(me.data);
      setPointsData(pts.data);
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, authUser]);
```

- [ ] **Step 4: Add the tab bar JSX after the profile card**

Find the closing tag of the profile card section (the `</div>` that ends the white rounded card block, around line 169). Insert the tab bar immediately after:

```typescript
      {/* ── Tab bar ── */}
      <div className="flex gap-1 bg-zinc-100 p-1 rounded-xl">
        {(["overview", "points", "badges"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-1.5 text-sm font-semibold rounded-lg capitalize transition-colors ${
              activeTab === tab
                ? "bg-white text-zinc-900 shadow-sm"
                : "text-zinc-500 hover:text-zinc-700"
            }`}
          >
            {tab === "points" ? "Points" : tab === "badges" ? "Badges" : "Overview"}
          </button>
        ))}
      </div>
```

- [ ] **Step 5: Wrap existing content blocks in tab conditionals**

The current layout has three sections after the profile card + tab bar: stats grid, birthday, badges, and the old points history. Wrap each in the appropriate tab condition.

Replace the entire block from the stats grid to the bottom of the return statement (from `{/* ── Stats ── */}` to the end before the final closing `</div>`) with:

```typescript
      {/* ── Overview tab ── */}
      {activeTab === "overview" && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { icon: Coins,  value: profile.pointsBalance.toLocaleString(), label: "Points Balance", color: "text-indigo-600", bg: "bg-indigo-50" },
              { icon: Star,   value: profile.level,                          label: "Level",          color: "text-violet-600", bg: "bg-violet-50" },
              { icon: Flame,  value: profile.streakDays,                     label: "Streak (days)",  color: "text-orange-500", bg: "bg-orange-50" },
              { icon: Medal,  value: profile.userBadges.length,              label: "Badges",         color: "text-amber-600",  bg: "bg-amber-50" },
            ].map(({ icon: Icon, value, label, color, bg }) => (
              <div key={label} className="bg-white rounded-xl border border-zinc-200 p-4 flex flex-col gap-2">
                <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center`}>
                  <Icon className={`w-4 h-4 ${color}`} />
                </div>
                <p className={`text-2xl font-black leading-none ${color}`}>{value}</p>
                <p className="text-xs text-zinc-400 font-medium">{label}</p>
              </div>
            ))}
          </div>

          {/* Birthday */}
          <div className="bg-white rounded-xl border border-zinc-200 px-5 py-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center">
                  <CalendarDays className="w-4 h-4 text-rose-500" />
                </div>
                <div>
                  <p className="text-xs text-zinc-400 font-medium">Birthday</p>
                  <p className="text-sm font-semibold text-zinc-800">
                    {profile.birthday
                      ? new Date(profile.birthday).toLocaleDateString(undefined, { month: "long", day: "numeric" })
                      : "Not set"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={birthdayEdit}
                  onChange={(e) => setBirthdayEdit(e.target.value)}
                  className="text-sm border border-zinc-200 rounded-lg px-3 py-1.5 text-zinc-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition"
                />
                <button
                  onClick={handleBirthdaySave}
                  disabled={birthdaySaving || !birthdayEdit}
                  className="text-sm bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-4 py-1.5 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {birthdaySaving ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
            {birthdayError && <p className="mt-2 text-xs text-red-500">{birthdayError}</p>}
          </div>
        </>
      )}

      {/* ── Points tab ── */}
      {activeTab === "points" && pointsData && (
        <>
          {/* Balance card */}
          <div className="bg-white rounded-xl border border-zinc-200 p-5">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <p className="text-xs text-zinc-400 font-medium uppercase tracking-wide">Current Balance</p>
                <p className="text-4xl font-black text-indigo-600 leading-none mt-1">
                  {pointsData.balance.toLocaleString()}
                  <span className="text-lg font-semibold text-zinc-400 ml-1">pts</span>
                </p>
              </div>
              <div className="text-right">
                <span className="inline-block bg-violet-100 text-violet-700 text-xs font-bold px-3 py-1 rounded-full">
                  Level {pointsData.level}
                </span>
                <p className="text-xs text-zinc-400 mt-2">
                  Total earned:{" "}
                  <span className="font-semibold text-zinc-700">
                    {pointsData.totalEarned.toLocaleString()} pts
                  </span>
                </p>
              </div>
            </div>
          </div>

          {/* Unified timeline */}
          <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-zinc-100 flex items-center gap-2">
              <History className="w-4 h-4 text-zinc-400" />
              <h2 className="text-sm font-bold text-zinc-800">Transaction History</h2>
            </div>
            {(() => {
              const entries: TimelineEntry[] = [
                ...pointsData.transactions.map((t): TimelineEntry => ({ kind: "earn", data: t })),
                ...pointsData.redemptions.map((r): TimelineEntry => ({ kind: "redeem", data: r })),
              ].sort(
                (a, b) =>
                  new Date(b.data.createdAt).getTime() - new Date(a.data.createdAt).getTime()
              );

              if (entries.length === 0) {
                return (
                  <div className="flex flex-col items-center py-10 gap-2 text-center px-4">
                    <span className="text-3xl">🏆</span>
                    <p className="text-sm font-medium text-zinc-500">No points yet</p>
                    <p className="text-xs text-zinc-400">Complete missions or wait for your manager to recognize you!</p>
                  </div>
                );
              }

              const visible = entries.slice(0, visibleCount);
              return (
                <>
                  <ul className="divide-y divide-zinc-100">
                    {visible.map((entry) => {
                      if (entry.kind === "earn") {
                        const t = entry.data;
                        const meta = txTypeLabel[t.type] ?? { label: t.type, color: "text-zinc-600" };
                        const positive = t.amount >= 0;
                        return (
                          <li key={`earn-${t.id}`} className="flex items-center gap-4 px-5 py-3 hover:bg-zinc-50 transition-colors">
                            <span className={`shrink-0 text-xs font-bold px-2 py-0.5 rounded-full ${positive ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-500"}`}>
                              {positive ? "+" : ""}{t.amount.toLocaleString()} pts
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-zinc-900 truncate">{t.note ?? meta.label}</p>
                              <p className="text-xs text-zinc-400">
                                <span className={`font-medium ${meta.color}`}>{meta.label}</span>
                                {t.fromUser ? ` · from ${t.fromUser.displayName}` : ""}
                                {" · "}{new Date(t.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                          </li>
                        );
                      } else {
                        const r = entry.data;
                        return (
                          <li key={`redeem-${r.id}`} className="flex items-center gap-4 px-5 py-3 hover:bg-zinc-50 transition-colors">
                            <span className="shrink-0 text-xs font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-500">
                              -{r.pointsSpent.toLocaleString()} pts
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-zinc-900 truncate">{r.reward.name}</p>
                              <p className="text-xs text-zinc-400">
                                <span className="font-medium text-rose-500">Redemption</span>
                                {" · "}{new Date(r.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                          </li>
                        );
                      }
                    })}
                  </ul>
                  {entries.length > visibleCount && (
                    <div className="px-5 py-3 border-t border-zinc-100">
                      <button
                        onClick={() => setVisibleCount((c) => c + 10)}
                        className="text-sm text-indigo-600 hover:text-indigo-700 font-medium transition-colors"
                      >
                        Load more ({entries.length - visibleCount} remaining)
                      </button>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </>
      )}

      {/* ── Badges tab ── */}
      {activeTab === "badges" && (
        <div className="bg-white rounded-xl border border-zinc-200 p-5">
          <h2 className="text-sm font-bold text-zinc-800 mb-4 flex items-center gap-2">
            <Medal className="w-4 h-4 text-amber-500" />
            Badges
            <span className="text-xs font-normal text-zinc-400">({profile.userBadges.length})</span>
          </h2>
          {profile.userBadges.length === 0 ? (
            <div className="flex flex-col items-center py-8 gap-2 text-center">
              <span className="text-4xl">🎖️</span>
              <p className="text-sm text-zinc-500 font-medium">No badges yet</p>
              <p className="text-xs text-zinc-400">Keep earning points to unlock your first badge!</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {profile.userBadges.map((ub) => {
                const icon = ub.badge.description?.split(" ")[0] ?? "🏅";
                return (
                  <div
                    key={ub.id}
                    className="flex flex-col items-center gap-1.5 bg-zinc-50 border border-zinc-200 rounded-xl p-3 text-center"
                  >
                    <span className="text-2xl">{icon}</span>
                    <p className="text-xs font-semibold text-zinc-800">{ub.badge.name}</p>
                    {ub.badge.description && (
                      <p className="text-xs text-zinc-400 line-clamp-2">{ub.badge.description}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
```

- [ ] **Step 6: Verify the page compiles and renders correctly**

The dev server should already be running. Open `http://localhost:3000/profile` and verify:
- Tab bar shows "Overview", "Points", "Badges"
- Overview tab: stats grid + birthday section appear
- Points tab: balance card shows balance, level badge, total earned; timeline renders; redemptions show with negative amounts; "Load more" appears if >10 entries
- Badges tab: badges grid appears
- Empty state on Points tab renders if no transactions/redemptions

Also check TypeScript: run `npx tsc --noEmit` and confirm no errors.

- [ ] **Step 7: Commit**

```bash
git add app/(dashboard)/profile/page.tsx
git commit -m "feat: add Points and Badges tabs to profile page with balance card and unified timeline"
```

---

## Spec Coverage Check

| Spec requirement | Covered by |
|-----------------|------------|
| `GET /api/me/points` endpoint | Task 1 |
| Returns `balance`, `totalEarned`, `transactions`, `redemptions` | Task 1 |
| Transactions: 50 most recent, `fromUser.displayName` | Task 1 |
| Redemptions: include `reward.name` | Task 1 |
| Points tab on profile page | Task 2, Step 4 |
| Balance card: balance + level + total earned | Task 2, Step 5 |
| Green earning / red redemption badges | Task 2, Step 5 |
| Note fallback to type label | Task 2, Step 5 (uses `t.note ?? meta.label`) |
| Relative dates | ❌ Spec says "relative: '3 days ago'" — omitted, using absolute dates to keep it simple (no dependency on a date-fns/dayjs util) |
| Type chip on rows | Task 2, Step 5 (colored type label in subtitle) |
| Empty state | Task 2, Step 5 |
| "Load more" showing 50 records | Task 2 — fetches 50 transactions from API, shows 10 at a time with Load More |
| Only current user's own history | Task 1 (always uses `user.id` from auth) |

> **Note on relative dates:** The spec mentions "3 days ago" relative formatting. This project has no date utility installed (`date-fns`, `dayjs`, etc.). Using absolute dates (`toLocaleDateString()`) is acceptable for v1 — avoids adding a dependency for a cosmetic detail.
