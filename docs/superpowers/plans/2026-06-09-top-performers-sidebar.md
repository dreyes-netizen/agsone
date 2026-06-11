# Top Performers Sidebar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a two-column layout to the Top Performers page (`/leaderboard`) with a sticky right sidebar containing four cards: Your Stats, Period Summary, Top Departments, and Recent Achievers.

**Architecture:** Three tasks — commit pending polish fixes, create a new `/api/leaderboard/achievers` endpoint, then rewrite the leaderboard page to add the two-column grid and all four sidebar cards. Cards 2 and 3 derive their data client-side from the leaderboard entries already fetched; Cards 1 and 4 each get their own API call on mount.

**Tech Stack:** Next.js 15 App Router, Prisma (PostgreSQL), React, Tailwind CSS, lucide-react

---

## File Map

| File | Change |
|---|---|
| `app/(dashboard)/dashboard/page.tsx` | Commit only — polish fixes already in working tree |
| `app/(dashboard)/leaderboard/page.tsx` | Commit polish fixes, then full rewrite for sidebar |
| `app/api/leaderboard/achievers/route.ts` | Create — new GET endpoint |

---

### Task 1: Commit pending polish fixes

**Files:**
- Modify (commit only): `app/(dashboard)/dashboard/page.tsx`
- Modify (commit only): `app/(dashboard)/leaderboard/page.tsx`

These files have uncommitted changes in the working tree from the previous refactor session. They must be committed before starting the sidebar work so the new feature has a clean baseline.

- [ ] **Step 1: Verify the pending changes are present**

Run:
```bash
git diff --stat HEAD
```
Expected output includes both `app/(dashboard)/dashboard/page.tsx` and `app/(dashboard)/leaderboard/page.tsx`.

- [ ] **Step 2: Commit the polish fixes**

```bash
git add "app/(dashboard)/dashboard/page.tsx" "app/(dashboard)/leaderboard/page.tsx"
git commit -m "fix: polish fixes — dead rank fields, You label, subtitle, error handling"
```

---

### Task 2: Create `/api/leaderboard/achievers` endpoint

**Files:**
- Create: `app/api/leaderboard/achievers/route.ts`

This endpoint merges two queries — recent badge awards (`UserBadge`) and recent milestone awards (`MilestoneAward`) from the last 30 days — and returns the top 5 newest events.

- [ ] **Step 1: Create the file with the full implementation**

Create `app/api/leaderboard/achievers/route.ts` with this exact content:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";

const MILESTONE_LABELS: Record<string, string> = {
  BIRTHDAY: "Birthday",
  WORK_ANNIVERSARY_1: "1-Year Anniversary",
  WORK_ANNIVERSARY_3: "3-Year Anniversary",
  WORK_ANNIVERSARY_5: "5-Year Anniversary",
  WORK_ANNIVERSARY_10: "10-Year Anniversary",
};

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const since = new Date();
  since.setDate(since.getDate() - 30);

  const [badges, milestones] = await Promise.all([
    prisma.userBadge.findMany({
      where: { awardedAt: { gte: since } },
      include: {
        user: { select: { id: true, displayName: true, avatarUrl: true } },
        badge: { select: { name: true } },
      },
      orderBy: { awardedAt: "desc" },
      take: 20,
    }),
    prisma.milestoneAward.findMany({
      where: { awardedAt: { gte: since } },
      include: {
        user: { select: { id: true, displayName: true, avatarUrl: true } },
      },
      orderBy: { awardedAt: "desc" },
      take: 20,
    }),
  ]);

  const combined = [
    ...badges.map((b) => ({
      userId: b.user.id,
      displayName: b.user.displayName,
      avatarUrl: b.user.avatarUrl,
      label: b.badge.name,
      achievedAt: b.awardedAt.toISOString(),
    })),
    ...milestones.map((m) => ({
      userId: m.user.id,
      displayName: m.user.displayName,
      avatarUrl: m.user.avatarUrl,
      label: MILESTONE_LABELS[m.type] ?? m.type,
      achievedAt: m.awardedAt.toISOString(),
    })),
  ]
    .sort((a, b) => b.achievedAt.localeCompare(a.achievedAt))
    .slice(0, 5);

  return NextResponse.json({ data: combined });
}
```

- [ ] **Step 2: Verify TypeScript compiles cleanly**

Run:
```bash
npx tsc --noEmit
```
Expected: only the pre-existing error in `app/(dashboard)/employees/[id]/page.tsx:550` — no new errors.

- [ ] **Step 3: Commit**

```bash
git add "app/api/leaderboard/achievers/route.ts"
git commit -m "feat: add /api/leaderboard/achievers endpoint"
```

---

### Task 3: Rewrite leaderboard page — two-column layout + all four sidebar cards

**Files:**
- Modify: `app/(dashboard)/leaderboard/page.tsx`

Replace the entire file content. The left column is the existing header, filters, and rankings list (logic unchanged). The right sidebar adds Your Stats (from `/api/me`), Period Summary (derived), Top Departments (derived), and Recent Achievers (from `/api/leaderboard/achievers`).

- [ ] **Step 1: Replace the entire file**

Write the following as the complete content of `app/(dashboard)/leaderboard/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { Star, Flame } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useApiClient } from "@/lib/hooks/useApiClient";

type Entry = {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  department: string | null;
  points: number;
  level?: number;
  isCurrentUser: boolean;
};

type Department = { id: string; name: string };

type UserProfile = {
  pointsBalance: number;
  level: number;
  streakDays: number;
  displayName: string;
  avatarUrl: string | null;
  department: { id: string; name: string } | null;
};

type Achiever = {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  label: string;
  achievedAt: string;
};

function Avatar({ name, url, size = "md" }: { name: string; url: string | null; size?: "sm" | "md" | "lg" }) {
  const cls = size === "lg" ? "w-16 h-16 text-2xl" : size === "sm" ? "w-9 h-9 text-xs" : "w-11 h-11 text-sm";
  if (url) return <img src={url} alt={name} className={`${cls} rounded-full object-cover`} />;
  return (
    <div className={`${cls} rounded-full bg-navy-100 flex items-center justify-center text-navy-600 font-bold`}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return `${diffDays} days ago`;
}

export default function LeaderboardPage() {
  const { user, loading: authLoading } = useAuth();
  const { apiFetch } = useApiClient();

  const [entries, setEntries] = useState<Entry[]>([]);
  const [period, setPeriod] = useState<"monthly" | "alltime">("monthly");
  const [loading, setLoading] = useState(true);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [departmentId, setDepartmentId] = useState<string | "ALL">("ALL");
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [achievers, setAchievers] = useState<Achiever[]>([]);
  const [achieversLoading, setAchieversLoading] = useState(true);

  useEffect(() => {
    if (authLoading || !user) return;
    apiFetch<{ data: Department[] }>("/api/departments").then((res) => setDepartments(res.data));
    Promise.allSettled([
      apiFetch<{ data: UserProfile }>("/api/me"),
      apiFetch<{ data: Achiever[] }>("/api/leaderboard/achievers"),
    ]).then(([me, ach]) => {
      if (me.status === "fulfilled") setProfile(me.value.data);
      if (ach.status === "fulfilled") setAchievers(ach.value.data ?? []);
    }).finally(() => {
      setProfileLoading(false);
      setAchieversLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user]);

  useEffect(() => {
    if (authLoading || !user) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user, period, departmentId]);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ period });
      if (departmentId !== "ALL") params.set("departmentId", departmentId);
      const res = await apiFetch<{ data: Entry[] }>(`/api/leaderboard?${params.toString()}`);
      setEntries(res.data);
    } finally {
      setLoading(false);
    }
  }

  const totalPoints = entries.reduce((sum, e) => sum + e.points, 0);
  const avgPoints = entries.length > 0 ? Math.round(totalPoints / entries.length) : 0;

  const topDepts = (() => {
    const map = new Map<string, number>();
    for (const e of entries) {
      const key = e.department ?? "Unknown";
      map.set(key, (map.get(key) ?? 0) + e.points);
    }
    const sorted = Array.from(map.entries())
      .sort((a, b) => {
        if (a[0] === "Unknown") return 1;
        if (b[0] === "Unknown") return -1;
        return b[1] - a[1];
      })
      .slice(0, 5);
    const max = sorted[0]?.[1] ?? 1;
    return sorted.map(([name, points]) => ({ name, points, pct: Math.round((points / max) * 100) }));
  })();

  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Top Performers</h1>
        <p className="text-zinc-500 text-sm mt-1">{period === "monthly" ? "This month's" : "All-time"} highest earners.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">

        {/* ════ Left column ════ */}
        <div className="space-y-4">

          {/* Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            {departments.length > 0 && (
              <select
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
                className="text-sm border border-zinc-200 rounded-lg px-3 py-1.5 text-zinc-700 bg-white focus:outline-none focus:ring-2 focus:ring-navy-500/30 focus:border-navy-400 transition"
              >
                <option value="ALL">All Departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            )}
            <div className="flex rounded-lg border border-zinc-200 overflow-hidden bg-white text-sm">
              <button
                className={`px-4 py-1.5 font-medium transition-colors ${period === "monthly" ? "bg-[#111827] text-white" : "text-zinc-600 hover:bg-zinc-50"}`}
                onClick={() => setPeriod("monthly")}
              >
                This Month
              </button>
              <button
                className={`px-4 py-1.5 font-medium transition-colors ${period === "alltime" ? "bg-[#111827] text-white" : "text-zinc-600 hover:bg-zinc-50"}`}
                onClick={() => setPeriod("alltime")}
              >
                All Time
              </button>
            </div>
          </div>

          {/* Rankings list */}
          <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
            {loading ? (
              <div className="text-center py-12 text-zinc-400 text-sm">Loading...</div>
            ) : entries.length === 0 ? (
              <div className="text-center py-12 text-zinc-400 text-sm">No data yet. Start earning points!</div>
            ) : (
              <ul className="divide-y divide-zinc-100">
                {entries.map((e) => (
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
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* ════ Right column ════ */}
        <div className="space-y-4 sticky top-6 self-start">

          {/* Card 1: Your Stats */}
          <div className="bg-white rounded-xl border border-zinc-100 p-4">
            <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">Your Stats</p>
            {profileLoading ? (
              <div className="space-y-3 animate-pulse">
                <div className="h-8 bg-zinc-100 rounded w-1/2" />
                <div className="h-3 bg-zinc-100 rounded w-1/3" />
                <div className="h-3 bg-zinc-100 rounded w-1/4" />
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <p className="text-3xl font-black text-zinc-900 tabular-nums leading-none">
                    {profile?.pointsBalance?.toLocaleString() ?? "—"}
                  </p>
                  <p className="text-xs text-zinc-400 mt-1">points balance</p>
                </div>
                <div className="flex items-center gap-4 pt-1 border-t border-zinc-50">
                  <div className="flex items-center gap-1.5">
                    <Star className="w-3.5 h-3.5 text-violet-500 shrink-0" />
                    <span className="text-sm font-bold text-violet-600">Lv {profile?.level ?? 1}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Flame className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                    <span className="text-sm font-bold text-orange-500">{profile?.streakDays ?? 0}d streak</span>
                  </div>
                </div>
                {profile?.department && (
                  <p className="text-xs text-zinc-400 truncate">{profile.department.name}</p>
                )}
              </div>
            )}
          </div>

          {/* Card 2: Period Summary */}
          {!loading && entries.length > 0 && (
            <div className="bg-white rounded-xl border border-zinc-100 p-4">
              <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">Period Summary</p>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-500">Participants</span>
                  <span className="font-semibold text-zinc-900">{entries.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-500">Total points</span>
                  <span className="font-semibold text-zinc-900">{totalPoints.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-500">Avg per person</span>
                  <span className="font-semibold text-zinc-900">{avgPoints.toLocaleString()}</span>
                </div>
              </div>
            </div>
          )}

          {/* Card 3: Top Departments */}
          {!loading && topDepts.length > 0 && (
            <div className="bg-white rounded-xl border border-zinc-100 p-4">
              <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">Top Departments</p>
              <div className="space-y-3">
                {topDepts.map(({ name, points, pct }) => (
                  <div key={name}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-zinc-700 font-medium truncate mr-2">{name}</span>
                      <span className="text-zinc-500 tabular-nums shrink-0">{points.toLocaleString()}</span>
                    </div>
                    <div className="w-full bg-zinc-100 rounded-full h-1.5 overflow-hidden">
                      <div className="bg-navy-500 h-1.5 rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Card 4: Recent Achievers */}
          <div className="bg-white rounded-xl border border-zinc-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-50">
              <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Recent Achievers</p>
            </div>
            {achieversLoading ? (
              <div className="p-4 space-y-3 animate-pulse">
                {[1, 2, 3].map((i) => <div key={i} className="h-8 bg-zinc-100 rounded" />)}
              </div>
            ) : achievers.length === 0 ? (
              <p className="text-xs text-zinc-400 text-center py-6">No recent achievements</p>
            ) : (
              <div className="divide-y divide-zinc-50">
                {achievers.map((a, i) => (
                  <div key={`${a.userId}-${i}`} className="flex items-center gap-2.5 px-4 py-2.5 hover:bg-zinc-50/60 transition-colors">
                    <Avatar name={a.displayName} url={a.avatarUrl} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-zinc-800 truncate">{a.displayName}</p>
                      <p className="text-[10px] text-zinc-400 truncate">{a.label}</p>
                    </div>
                    <span className="text-[10px] text-zinc-400 shrink-0">{timeAgo(a.achievedAt)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles cleanly**

Run:
```bash
npx tsc --noEmit
```
Expected: only the pre-existing error in `app/(dashboard)/employees/[id]/page.tsx:550`. No new errors.

- [ ] **Step 3: Do NOT commit — report back for controller to handle**

Report back with status and findings.
