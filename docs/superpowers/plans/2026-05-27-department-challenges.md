# Department Challenges Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let HR admins create time-boxed department challenges with collaborative goals; employees see each department's live progress toward the target.

**Architecture:** New `Challenge` model with a `ChallengeMetric` enum. Progress is computed at query time from existing PointTransaction, MissionCompletion, and SocialPost data — no denormalized progress table. Admin CRUD API + employee read API with per-dept progress aggregation. Two new UI pages plus sidebar nav additions.

**Tech Stack:** Next.js 16.2.6 App Router, Prisma, Tailwind CSS v4, Lucide React

**Codebase context:**
- Auth: `verifyAuth(req)` + `requireRole(user, roles)` from `@/lib/auth/verifyAuth`
- Client fetch: `useApiClient()` → `apiFetch<T>()` with auto Bearer token
- `useAuth()` from `@/lib/auth/AuthProvider` — `dbUser.department.id` identifies user's dept
- Dashboard layout sidebar: `app/(dashboard)/layout.tsx` — `mainNav` array at line 15
- Admin layout: `app/admin/layout.tsx` — `navItems` array (check file for exact line)
- Tailwind colors: `bg-[#111827]` dark, `text-navy-600`, `bg-zinc-50/100/200`
- After `prisma migrate dev`, always run `prisma generate`

---

## File Map

| File | Action |
|------|--------|
| `prisma/schema.prisma` | Add `ChallengeMetric` enum + `Challenge` model |
| `app/api/admin/challenges/route.ts` | New — GET list + POST create |
| `app/api/admin/challenges/[id]/route.ts` | New — PATCH update |
| `app/api/challenges/route.ts` | New — GET active challenges with dept progress |
| `app/(dashboard)/challenges/page.tsx` | New — employee view |
| `app/admin/challenges/page.tsx` | New — admin management |
| `app/(dashboard)/layout.tsx` | Modify — add Challenges to sidebar nav |
| `app/admin/layout.tsx` | Modify — add Challenges to admin sidebar |

---

### Task 1: Schema migration

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add ChallengeMetric enum**

In `prisma/schema.prisma`, after the `MilestoneType` enum block, add:

```prisma
enum ChallengeMetric {
  TOTAL_POINTS
  MISSIONS_COMPLETED
  SHOUTOUTS_SENT
}
```

- [ ] **Step 2: Add Challenge model**

After the `MilestoneAward` model (at the bottom of the schema), add:

```prisma
model Challenge {
  id          String          @id @default(uuid())
  title       String
  description String?
  metric      ChallengeMetric
  targetValue Int
  startDate   DateTime
  endDate     DateTime
  isActive    Boolean         @default(true)
  createdById String
  createdAt   DateTime        @default(now())
  updatedAt   DateTime        @updatedAt

  createdBy User @relation(fields: [createdById], references: [id])
}
```

- [ ] **Step 3: Add relation to User**

In the `model User { ... }` block, add after `milestoneConfigs MilestoneConfig[]`:

```prisma
  challengesCreated Challenge[]
```

- [ ] **Step 4: Run migration**

```bash
npx prisma migrate dev --name add_department_challenges
```

Expected: migration created and applied, no errors.

- [ ] **Step 5: Regenerate Prisma client**

```bash
npx prisma generate
```

Expected: client regenerated successfully.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add ChallengeMetric enum and Challenge model"
```

---

### Task 2: Admin challenges API — GET + POST

**Files:**
- Create: `app/api/admin/challenges/route.ts`

- [ ] **Step 1: Create the route**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, requireRole } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";
import { ChallengeMetric } from "@/lib/generated/prisma/client";

const VALID_METRICS: ChallengeMetric[] = ["TOTAL_POINTS", "MISSIONS_COMPLETED", "SHOUTOUTS_SENT"];

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!requireRole(user, ["HR_ADMIN", "MANAGER"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const challenges = await prisma.challenge.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      description: true,
      metric: true,
      targetValue: true,
      startDate: true,
      endDate: true,
      isActive: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ data: challenges });
}

export async function POST(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!requireRole(user, ["HR_ADMIN"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { title, description, metric, targetValue, startDate, endDate } = body;

  if (!title || !metric || !targetValue || !startDate || !endDate) {
    return NextResponse.json({ error: "title, metric, targetValue, startDate, endDate are required" }, { status: 400 });
  }
  if (!VALID_METRICS.includes(metric)) {
    return NextResponse.json({ error: "Invalid metric" }, { status: 400 });
  }
  if (Number(targetValue) <= 0) {
    return NextResponse.json({ error: "targetValue must be > 0" }, { status: 400 });
  }
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (start >= end) {
    return NextResponse.json({ error: "startDate must be before endDate" }, { status: 400 });
  }

  const challenge = await prisma.challenge.create({
    data: {
      title,
      description: description ?? null,
      metric: metric as ChallengeMetric,
      targetValue: Number(targetValue),
      startDate: start,
      endDate: end,
      createdById: user!.id,
    },
  });

  return NextResponse.json({ data: challenge }, { status: 201 });
}
```

- [ ] **Step 2: Verify no TypeScript errors**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "app/api/admin/challenges/route.ts"
git commit -m "feat: add GET + POST /api/admin/challenges"
```

---

### Task 3: Admin challenges PATCH

**Files:**
- Create: `app/api/admin/challenges/[id]/route.ts`

- [ ] **Step 1: Create the route**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, requireRole } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth(req);
  if (!requireRole(user, ["HR_ADMIN"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();

  const allowedFields = ["title", "description", "isActive", "endDate"];
  const update: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if (field in body) {
      update[field] = field === "endDate" ? new Date(body[field]) : body[field];
    }
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No updatable fields provided" }, { status: 400 });
  }

  const challenge = await prisma.challenge.update({
    where: { id },
    data: update,
  });

  return NextResponse.json({ data: challenge });
}
```

- [ ] **Step 2: Verify no TypeScript errors**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "app/api/admin/challenges/[id]/route.ts"
git commit -m "feat: add PATCH /api/admin/challenges/[id]"
```

---

### Task 4: Employee challenges API with dept progress

**Files:**
- Create: `app/api/challenges/route.ts`

Progress is computed per department per challenge. For `TOTAL_POINTS`: sum positive PointTransactions to users in that dept within the date range. For `MISSIONS_COMPLETED`: count approved MissionCompletions. For `SHOUTOUTS_SENT`: count SHOUTOUT SocialPosts by dept authors.

- [ ] **Step 1: Create the route**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";

async function computeProgress(
  metric: string,
  deptId: string,
  startDate: Date,
  endDate: Date
): Promise<number> {
  if (metric === "TOTAL_POINTS") {
    const result = await prisma.pointTransaction.aggregate({
      where: {
        toUser: { departmentId: deptId },
        createdAt: { gte: startDate, lte: endDate },
        amount: { gt: 0 },
      },
      _sum: { amount: true },
    });
    return result._sum.amount ?? 0;
  }

  if (metric === "MISSIONS_COMPLETED") {
    return prisma.missionCompletion.count({
      where: {
        user: { departmentId: deptId },
        completedAt: { gte: startDate, lte: endDate },
        status: "APPROVED",
      },
    });
  }

  if (metric === "SHOUTOUTS_SENT") {
    return prisma.socialPost.count({
      where: {
        author: { departmentId: deptId },
        type: "SHOUTOUT",
        createdAt: { gte: startDate, lte: endDate },
      },
    });
  }

  return 0;
}

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const now = new Date();

  const [challenges, departments] = await Promise.all([
    prisma.challenge.findMany({
      where: { isActive: true, endDate: { gte: now } },
      orderBy: { startDate: "asc" },
    }),
    prisma.department.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const result = await Promise.all(
    challenges.map(async (challenge) => {
      const deptProgress = await Promise.all(
        departments.map(async (dept) => {
          const progress = await computeProgress(
            challenge.metric,
            dept.id,
            challenge.startDate,
            challenge.endDate
          );
          return { deptId: dept.id, deptName: dept.name, progress };
        })
      );

      deptProgress.sort((a, b) => b.progress - a.progress);

      return {
        id: challenge.id,
        title: challenge.title,
        description: challenge.description,
        metric: challenge.metric,
        targetValue: challenge.targetValue,
        startDate: challenge.startDate,
        endDate: challenge.endDate,
        deptProgress,
      };
    })
  );

  return NextResponse.json({ data: result });
}
```

- [ ] **Step 2: Verify no TypeScript errors**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "app/api/challenges/route.ts"
git commit -m "feat: add GET /api/challenges with per-dept progress"
```

---

### Task 5: Employee challenges page

**Files:**
- Create: `app/(dashboard)/challenges/page.tsx`

- [ ] **Step 1: Create the page**

```typescript
"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useApiClient } from "@/lib/hooks/useApiClient";
import { Swords, Clock } from "lucide-react";

type DeptProgress = {
  deptId: string;
  deptName: string;
  progress: number;
};

type Challenge = {
  id: string;
  title: string;
  description: string | null;
  metric: "TOTAL_POINTS" | "MISSIONS_COMPLETED" | "SHOUTOUTS_SENT";
  targetValue: number;
  startDate: string;
  endDate: string;
  deptProgress: DeptProgress[];
};

const metricLabel: Record<Challenge["metric"], string> = {
  TOTAL_POINTS: "Total Points",
  MISSIONS_COMPLETED: "Missions Completed",
  SHOUTOUTS_SENT: "Shoutouts Sent",
};

function timeRemaining(endDate: string): string {
  const diff = new Date(endDate).getTime() - Date.now();
  if (diff <= 0) return "Ended";
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return "Ends today";
  return `${days} day${days === 1 ? "" : "s"} left`;
}

export default function ChallengesPage() {
  const { user, loading: authLoading, dbUser } = useAuth();
  const { apiFetch } = useApiClient();
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading || !user) return;
    apiFetch<{ data: Challenge[] }>("/api/challenges")
      .then((res) => setChallenges(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user]);

  const myDeptId = dbUser?.department?.id ?? null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Department Challenges</h1>
        <p className="text-zinc-500 text-sm mt-1">
          Collaborative goals your department is working toward together.
        </p>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[0, 1].map((i) => (
            <div key={i} className="bg-white rounded-2xl border border-zinc-200 p-5 animate-pulse">
              <div className="h-4 bg-zinc-100 rounded w-48 mb-3" />
              <div className="h-3 bg-zinc-100 rounded w-full mb-2" />
              <div className="h-3 bg-zinc-100 rounded w-3/4" />
            </div>
          ))}
        </div>
      ) : challenges.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 rounded-2xl border border-zinc-200 bg-white text-center">
          <div className="w-14 h-14 rounded-2xl bg-violet-50 flex items-center justify-center mb-4">
            <Swords className="w-7 h-7 text-violet-400" />
          </div>
          <p className="text-zinc-900 font-semibold text-lg">No active challenges</p>
          <p className="text-zinc-400 text-sm mt-1">Check back when HR creates a new challenge.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {challenges.map((challenge) => {
            const remaining = timeRemaining(challenge.endDate);
            const ended = remaining === "Ended";
            return (
              <div key={challenge.id} className="bg-white rounded-2xl border border-zinc-200 overflow-hidden">
                <div className="px-5 py-4 border-b border-zinc-100">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <h2 className="text-base font-bold text-zinc-900">{challenge.title}</h2>
                      {challenge.description && (
                        <p className="text-sm text-zinc-500 mt-0.5">{challenge.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-medium bg-zinc-100 text-zinc-600 px-2.5 py-1 rounded-full">
                        {metricLabel[challenge.metric]}
                      </span>
                      <span
                        className={`flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${
                          ended
                            ? "bg-zinc-100 text-zinc-500"
                            : "bg-amber-50 text-amber-700"
                        }`}
                      >
                        <Clock className="w-3 h-3" />
                        {remaining}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-5 space-y-3">
                  <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">
                    Target: {challenge.targetValue.toLocaleString()}
                  </p>
                  {challenge.deptProgress.map((dp) => {
                    const pct = Math.min(100, Math.round((dp.progress / challenge.targetValue) * 100));
                    const isMyDept = dp.deptId === myDeptId;
                    const reached = dp.progress >= challenge.targetValue;
                    return (
                      <div
                        key={dp.deptId}
                        className={`rounded-xl p-3 border transition-colors ${
                          isMyDept
                            ? "border-navy-200 bg-navy-50/50 ring-1 ring-navy-200"
                            : "border-zinc-100 bg-zinc-50/50"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-semibold text-zinc-800">{dp.deptName}</span>
                            {isMyDept && (
                              <span className="text-xs font-medium text-navy-600 bg-navy-100 px-1.5 py-0.5 rounded-full">
                                Your dept
                              </span>
                            )}
                            {reached && (
                              <span className="text-xs font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-full">
                                Goal reached!
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-zinc-500 font-medium">
                            {dp.progress.toLocaleString()} / {challenge.targetValue.toLocaleString()}
                          </span>
                        </div>
                        <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              reached ? "bg-emerald-500" : isMyDept ? "bg-navy-500" : "bg-zinc-400"
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
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
git add "app/(dashboard)/challenges/page.tsx"
git commit -m "feat: add /challenges employee page with dept progress bars"
```

---

### Task 6: Admin challenges page

**Files:**
- Create: `app/admin/challenges/page.tsx`

- [ ] **Step 1: Create the page**

```typescript
"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useApiClient } from "@/lib/hooks/useApiClient";
import { Plus, Swords } from "lucide-react";

type Challenge = {
  id: string;
  title: string;
  description: string | null;
  metric: "TOTAL_POINTS" | "MISSIONS_COMPLETED" | "SHOUTOUTS_SENT";
  targetValue: number;
  startDate: string;
  endDate: string;
  isActive: boolean;
  createdAt: string;
};

const metricLabel: Record<Challenge["metric"], string> = {
  TOTAL_POINTS: "Total Points",
  MISSIONS_COMPLETED: "Missions Completed",
  SHOUTOUTS_SENT: "Shoutouts Sent",
};

const inputClass =
  "w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-navy-500/30 bg-white";

export default function AdminChallengesPage() {
  const { user, loading: authLoading } = useAuth();
  const { apiFetch } = useApiClient();
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    metric: "MISSIONS_COMPLETED" as Challenge["metric"],
    targetValue: "",
    startDate: "",
    endDate: "",
  });

  useEffect(() => {
    if (authLoading || !user) return;
    apiFetch<{ data: Challenge[] }>("/api/admin/challenges")
      .then((res) => setChallenges(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user]);

  async function handleToggleActive(challenge: Challenge) {
    setTogglingId(challenge.id);
    try {
      await apiFetch(`/api/admin/challenges/${challenge.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !challenge.isActive }),
      });
      setChallenges((prev) =>
        prev.map((c) =>
          c.id === challenge.id ? { ...c, isActive: !c.isActive } : c
        )
      );
    } catch {
      alert("Failed to update challenge");
    } finally {
      setTogglingId(null);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title || !form.metric || !form.targetValue || !form.startDate || !form.endDate) {
      alert("All fields except description are required.");
      return;
    }
    setSaving(true);
    try {
      const res = await apiFetch<{ data: Challenge }>("/api/admin/challenges", {
        method: "POST",
        body: JSON.stringify({
          title: form.title,
          description: form.description || null,
          metric: form.metric,
          targetValue: Number(form.targetValue),
          startDate: form.startDate,
          endDate: form.endDate,
        }),
      });
      setChallenges((prev) => [res.data, ...prev]);
      setForm({ title: "", description: "", metric: "MISSIONS_COMPLETED", targetValue: "", startDate: "", endDate: "" });
      setShowForm(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to create challenge");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Department Challenges</h1>
          <p className="text-gray-500 text-sm mt-1">
            Create time-boxed collaborative goals for departments.
          </p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-2 bg-[#111827] text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-gray-800 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Challenge
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-sm font-bold text-gray-800 mb-4">New Challenge</h2>
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-gray-500 mb-1">Title *</label>
                <input
                  className={inputClass}
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Mission Month"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-gray-500 mb-1">Description</label>
                <input
                  className={inputClass}
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Optional description"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Metric *</label>
                <select
                  className={inputClass}
                  value={form.metric}
                  onChange={(e) => setForm((f) => ({ ...f, metric: e.target.value as Challenge["metric"] }))}
                >
                  <option value="MISSIONS_COMPLETED">Missions Completed</option>
                  <option value="TOTAL_POINTS">Total Points Earned</option>
                  <option value="SHOUTOUTS_SENT">Shoutouts Sent</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Target *</label>
                <input
                  type="number"
                  min="1"
                  className={inputClass}
                  value={form.targetValue}
                  onChange={(e) => setForm((f) => ({ ...f, targetValue: e.target.value }))}
                  placeholder="e.g. 50"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Start Date *</label>
                <input
                  type="date"
                  className={inputClass}
                  value={form.startDate}
                  onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">End Date *</label>
                <input
                  type="date"
                  className={inputClass}
                  value={form.endDate}
                  onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                disabled={saving}
                className="bg-[#111827] text-white text-sm font-semibold px-5 py-2 rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-50"
              >
                {saving ? "Creating…" : "Create Challenge"}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2 rounded-xl border border-gray-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Challenges list */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Loading…</div>
        ) : challenges.length === 0 ? (
          <div className="flex flex-col items-center py-16 gap-3">
            <Swords className="w-8 h-8 text-gray-300" />
            <p className="text-gray-400 text-sm">No challenges yet. Create one above.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Title</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Metric</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Target</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Period</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
              </tr>
            </thead>
            <tbody>
              {challenges.map((c) => (
                <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors">
                  <td className="px-6 py-3">
                    <p className="font-medium text-gray-900">{c.title}</p>
                    {c.description && (
                      <p className="text-xs text-gray-400 truncate max-w-xs">{c.description}</p>
                    )}
                  </td>
                  <td className="px-6 py-3 text-gray-600">{metricLabel[c.metric]}</td>
                  <td className="px-6 py-3 font-semibold text-gray-800">{c.targetValue.toLocaleString()}</td>
                  <td className="px-6 py-3 text-gray-500 text-xs">
                    {new Date(c.startDate).toLocaleDateString()} —{" "}
                    {new Date(c.endDate).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-3">
                    <button
                      onClick={() => handleToggleActive(c)}
                      disabled={togglingId === c.id}
                      className={`text-xs font-semibold px-3 py-1 rounded-full border transition-colors disabled:opacity-50 ${
                        c.isActive
                          ? "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100"
                          : "bg-gray-100 border-gray-200 text-gray-500 hover:bg-gray-200"
                      }`}
                    >
                      {togglingId === c.id ? "…" : c.isActive ? "Active" : "Inactive"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
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
git add "app/admin/challenges/page.tsx"
git commit -m "feat: add admin challenges management page"
```

---

### Task 7: Add Challenges to sidebar navs

**Files:**
- Modify: `app/(dashboard)/layout.tsx`
- Modify: `app/admin/layout.tsx`

#### Dashboard sidebar

The current `mainNav` in `app/(dashboard)/layout.tsx` (line 15–26):
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

- [ ] **Step 1: Add Swords to dashboard layout lucide import**

In `app/(dashboard)/layout.tsx`, update the lucide-react import to add `Swords`:

```typescript
import {
  Home, ShoppingBag, Trophy, User, ShieldCheck, LogOut,
  Rss, Gamepad2, Menu, Target, UtensilsCrossed, MessageSquare, Sparkles, Swords,
} from "lucide-react";
```

- [ ] **Step 2: Add Challenges to mainNav**

In `app/(dashboard)/layout.tsx`, add after the Shoutouts entry:

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
  { href: "/challenges",  label: "Challenges",  icon: Swords },
  { href: "/profile",     label: "Profile",     icon: User },
  { href: "/feedback",    label: "Feedback",    icon: MessageSquare },
];
```

#### Admin sidebar

- [ ] **Step 3: Read app/admin/layout.tsx to find navItems**

Before editing, read `app/admin/layout.tsx` to see the current `navItems` structure and lucide imports.

- [ ] **Step 4: Add Swords to admin layout lucide import**

In `app/admin/layout.tsx`, add `Swords` to the lucide-react import alongside the existing icons.

- [ ] **Step 5: Add Challenges to admin navItems**

In `app/admin/layout.tsx`, add a Challenges entry to the `navItems` array after the Milestones entry:

```typescript
{ href: "/admin/challenges", label: "Challenges", icon: Swords },
```

- [ ] **Step 6: Verify no TypeScript errors**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add "app/(dashboard)/layout.tsx" "app/admin/layout.tsx"
git commit -m "feat: add Challenges to dashboard and admin sidebar navs"
```

---

## Self-Review Checklist

- [x] Schema: `ChallengeMetric` enum matches API and progress computation logic
- [x] Progress computed from existing data — no denormalized table
- [x] `TOTAL_POINTS`: filters `amount > 0` (excludes deductions like GAME_SPEND)
- [x] `MISSIONS_COMPLETED`: filters `status = APPROVED` only
- [x] `SHOUTOUTS_SENT`: filters `type = SHOUTOUT`
- [x] Employee API: only returns `isActive = true` + `endDate >= now`
- [x] Admin PATCH: does not allow changing `metric` or `targetValue` (data integrity)
- [x] User's own dept highlighted with navy ring in progress view
- [x] `deptProgress` sorted by progress desc — leading dept first
- [x] Both dashboard and admin sidebars updated
- [x] `await params` pattern used for Next.js 16 App Router dynamic routes
