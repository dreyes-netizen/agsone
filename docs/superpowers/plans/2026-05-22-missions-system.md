# Missions System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a full Missions system — employees self-report completions, HR/Managers approve or reject, approved completions award TASK points.

**Architecture:** Schema migration adds `MissionCompletionStatus` + 3 fields to `MissionCompletion`. Seven new API routes handle employee submission and admin CRUD/verification. Two new pages (employee `/missions`, admin `/admin/missions`) follow existing UI patterns.

**Tech Stack:** Next.js 16 App Router, Prisma 7, PostgreSQL (Supabase), TypeScript, Tailwind CSS, shadcn/ui (admin only), lucide-react, zod

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `prisma/schema.prisma` | Modify | Add `MissionCompletionStatus` enum + 3 fields |
| `app/api/missions/route.ts` | Create | GET active missions with user's completion status |
| `app/api/missions/[id]/complete/route.ts` | Create | POST submit completion (employee) |
| `app/api/admin/missions/route.ts` | Create | GET all missions, POST create mission |
| `app/api/admin/missions/[id]/route.ts` | Create | PATCH toggle active/inactive |
| `app/api/admin/missions/completions/route.ts` | Create | GET all PENDING completions |
| `app/api/admin/missions/completions/[id]/route.ts` | Create | PATCH approve or reject |
| `app/(dashboard)/missions/page.tsx` | Create | Employee missions page |
| `app/admin/missions/page.tsx` | Create | Admin missions management page |
| `app/(dashboard)/layout.tsx` | Modify | Add Missions nav item |
| `app/admin/layout.tsx` | Modify | Add Missions nav item |

---

## Task 1: Schema Migration

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add the enum and fields**

In `prisma/schema.prisma`, after the existing `BadgeCriteriaType` enum, add:

```prisma
enum MissionCompletionStatus {
  PENDING
  APPROVED
  REJECTED
}
```

Then extend the `MissionCompletion` model — add these three fields after the `verifiedById` line:

```prisma
  status       MissionCompletionStatus @default(PENDING)
  adminNote    String?
  verifiedAt   DateTime?
```

- [ ] **Step 2: Run the migration**

```bash
npx prisma migrate dev --name add-mission-completion-status
```

Expected: Migration file created and applied. If `DATABASE_URL` is not set, ensure your `.env` is loaded first.

- [ ] **Step 3: Regenerate the Prisma client**

```bash
npx prisma generate
```

Expected: `lib/generated/prisma/` updated with new enum and model fields.

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add MissionCompletionStatus to schema"
```

---

## Task 2: Employee API — List Missions

**Files:**
- Create: `app/api/missions/route.ts`

- [ ] **Step 1: Create the route**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";

export async function GET(req: NextRequest) {
  const authUser = await verifyAuth(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const missions = await prisma.mission.findMany({
    where: { isActive: true },
    include: {
      completions: {
        where: { userId: authUser.id },
        select: { id: true, status: true, adminNote: true, completedAt: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const data = missions.map((m) => ({
    id: m.id,
    title: m.title,
    description: m.description,
    pointsReward: m.pointsReward,
    type: m.type,
    startDate: m.startDate,
    endDate: m.endDate,
    myCompletion: m.completions[0] ?? null,
  }));

  return NextResponse.json({ data });
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Smoke test**

Start the dev server (`npm run dev`). Sign in as an employee. In the browser console run:

```javascript
fetch('/api/missions', { headers: { Authorization: 'Bearer ' + await firebase.auth().currentUser.getIdToken() } }).then(r => r.json()).then(console.log)
```

Expected: `{ data: [] }` (no missions yet — that's fine, admin creates them in Task 4).

- [ ] **Step 4: Commit**

```bash
git add app/api/missions/route.ts
git commit -m "feat: add GET /api/missions employee endpoint"
```

---

## Task 3: Employee API — Submit Completion

**Files:**
- Create: `app/api/missions/[id]/complete/route.ts`

- [ ] **Step 1: Create the route**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = await verifyAuth(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const mission = await prisma.mission.findUnique({ where: { id } });
  if (!mission || !mission.isActive) {
    return NextResponse.json({ error: "Mission not found or inactive" }, { status: 404 });
  }

  const existing = await prisma.missionCompletion.findUnique({
    where: { missionId_userId: { missionId: id, userId: authUser.id } },
  });
  if (existing) {
    return NextResponse.json({ error: "Already submitted" }, { status: 409 });
  }

  const completion = await prisma.missionCompletion.create({
    data: { missionId: id, userId: authUser.id },
  });

  return NextResponse.json({ data: completion }, { status: 201 });
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/missions/[id]/complete/route.ts
git commit -m "feat: add POST /api/missions/[id]/complete endpoint"
```

---

## Task 4: Admin API — List and Create Missions

**Files:**
- Create: `app/api/admin/missions/route.ts`

- [ ] **Step 1: Create the route**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, requireRole } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";
import { z } from "zod";

const createSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  pointsReward: z.number().int().min(1),
  type: z.enum(["INDIVIDUAL", "TEAM"]).default("INDIVIDUAL"),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

export async function GET(req: NextRequest) {
  const authUser = await verifyAuth(req);
  if (!requireRole(authUser, ["MANAGER", "HR_ADMIN"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const missions = await prisma.mission.findMany({
    include: { _count: { select: { completions: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ data: missions });
}

export async function POST(req: NextRequest) {
  const authUser = await verifyAuth(req);
  if (!requireRole(authUser, ["MANAGER", "HR_ADMIN"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { title, description, pointsReward, type, startDate, endDate } = parsed.data;

  const mission = await prisma.mission.create({
    data: {
      title,
      description: description ?? null,
      pointsReward,
      type,
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      createdById: authUser!.id,
    },
  });

  return NextResponse.json({ data: mission }, { status: 201 });
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/admin/missions/route.ts
git commit -m "feat: add GET+POST /api/admin/missions endpoints"
```

---

## Task 5: Admin API — Toggle Mission Active

**Files:**
- Create: `app/api/admin/missions/[id]/route.ts`

- [ ] **Step 1: Create the route**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, requireRole } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = await verifyAuth(req);
  if (!requireRole(authUser, ["MANAGER", "HR_ADMIN"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const { isActive } = await req.json();

  if (typeof isActive !== "boolean") {
    return NextResponse.json({ error: "isActive (boolean) required" }, { status: 400 });
  }

  const mission = await prisma.mission.update({
    where: { id },
    data: { isActive },
  });

  return NextResponse.json({ data: mission });
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/admin/missions/[id]/route.ts
git commit -m "feat: add PATCH /api/admin/missions/[id] toggle endpoint"
```

---

## Task 6: Admin API — List Pending Completions

**Files:**
- Create: `app/api/admin/missions/completions/route.ts`

- [ ] **Step 1: Create the route**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, requireRole } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";

export async function GET(req: NextRequest) {
  const authUser = await verifyAuth(req);
  if (!requireRole(authUser, ["MANAGER", "HR_ADMIN"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const completions = await prisma.missionCompletion.findMany({
    where: { status: "PENDING" },
    include: {
      user: { select: { id: true, displayName: true, avatarUrl: true } },
      mission: { select: { id: true, title: true, pointsReward: true } },
    },
    orderBy: { completedAt: "asc" },
  });

  return NextResponse.json({ data: completions });
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/admin/missions/completions/route.ts
git commit -m "feat: add GET /api/admin/missions/completions endpoint"
```

---

## Task 7: Admin API — Approve or Reject Completion

**Files:**
- Create: `app/api/admin/missions/completions/[id]/route.ts`

- [ ] **Step 1: Create the route**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, requireRole } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";
import { checkLevelUp } from "@/lib/helpers/checkLevelUp";
import { checkAndAwardBadges } from "@/lib/helpers/checkAndAwardBadges";
import { createNotification } from "@/lib/helpers/createNotification";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = await verifyAuth(req);
  if (!requireRole(authUser, ["MANAGER", "HR_ADMIN"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const { action, adminNote } = await req.json();

  if (action !== "approve" && action !== "reject") {
    return NextResponse.json({ error: "action must be 'approve' or 'reject'" }, { status: 400 });
  }
  if (action === "reject" && !adminNote?.trim()) {
    return NextResponse.json({ error: "adminNote is required when rejecting" }, { status: 400 });
  }

  const completion = await prisma.missionCompletion.findUnique({
    where: { id },
    include: { mission: true },
  });
  if (!completion) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (completion.status !== "PENDING") {
    return NextResponse.json({ error: "Already processed" }, { status: 409 });
  }

  if (action === "approve") {
    const recipient = await prisma.user.findUnique({
      where: { id: completion.userId },
      select: { pointsBalance: true },
    });
    const newBalance = (recipient?.pointsBalance ?? 0) + completion.mission.pointsReward;

    await prisma.$transaction(async (tx) => {
      await tx.missionCompletion.update({
        where: { id },
        data: { status: "APPROVED", verifiedById: authUser!.id, verifiedAt: new Date() },
      });
      await tx.pointTransaction.create({
        data: {
          toUserId: completion.userId,
          fromUserId: authUser!.id,
          amount: completion.mission.pointsReward,
          type: "TASK",
          note: completion.mission.title,
          createdById: authUser!.id,
          sourceReferenceId: completion.id,
        },
      });
      await tx.user.update({
        where: { id: completion.userId },
        data: { pointsBalance: { increment: completion.mission.pointsReward } },
      });
    });

    await createNotification({
      userId: completion.userId,
      type: "MISSION_APPROVED",
      title: "Mission approved",
      body: `'${completion.mission.title}' — +${completion.mission.pointsReward} pts`,
    });

    prisma.pointTransaction
      .aggregate({ where: { toUserId: completion.userId, amount: { gt: 0 } }, _sum: { amount: true } })
      .then((agg) => checkAndAwardBadges({ userId: completion.userId, totalEarned: agg._sum.amount ?? 0 }))
      .catch(() => {});
    checkLevelUp(completion.userId, newBalance).catch(() => {});
  } else {
    await prisma.missionCompletion.update({
      where: { id },
      data: {
        status: "REJECTED",
        adminNote: adminNote.trim(),
        verifiedById: authUser!.id,
        verifiedAt: new Date(),
      },
    });
    await createNotification({
      userId: completion.userId,
      type: "MISSION_REJECTED",
      title: "Mission not approved",
      body: `'${completion.mission.title}' — ${adminNote.trim()}`,
    });
  }

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Smoke test approve flow**

With the dev server running:
1. Sign in as HR/Manager
2. Create a mission via admin UI (Task 10) or directly via `POST /api/admin/missions`
3. Sign in as an employee (different browser/incognito), submit completion
4. Back as HR: call `PATCH /api/admin/missions/completions/<id>` with `{ "action": "approve" }`
5. Verify: employee's `pointsBalance` incremented, TASK transaction exists, notification created

- [ ] **Step 4: Commit**

```bash
git add app/api/admin/missions/completions/[id]/route.ts
git commit -m "feat: add PATCH completions approve/reject with points award"
```

---

## Task 8: Navigation — Add Missions to Both Sidebars

**Files:**
- Modify: `app/(dashboard)/layout.tsx`
- Modify: `app/admin/layout.tsx`

- [ ] **Step 1: Add to employee sidebar**

In `app/(dashboard)/layout.tsx`, add `Target` to the lucide-react import line:

```typescript
import {
  Home, ShoppingBag, Trophy, User, ShieldCheck, LogOut,
  Rss, Gamepad2, Menu, Target,
} from "lucide-react";
```

In the `mainNav` array, insert between Feed and Marketplace:

```typescript
const mainNav = [
  { href: "/dashboard",   label: "Home",        icon: Home },
  { href: "/feed",        label: "Feed",        icon: Rss },
  { href: "/missions",    label: "Missions",    icon: Target },
  { href: "/marketplace", label: "Marketplace", icon: ShoppingBag },
  { href: "/games",       label: "Games",       icon: Gamepad2 },
  { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
  { href: "/profile",     label: "Profile",     icon: User },
];
```

Also add to `bottomNavItems` (mobile bottom nav) — replace Profile with Missions since there are already 5 items and Missions is higher-priority than Profile on mobile:

```typescript
const bottomNavItems = [
  { href: "/dashboard",   label: "Home",        icon: Home },
  { href: "/feed",        label: "Feed",        icon: Rss },
  { href: "/missions",    label: "Missions",    icon: Target },
  { href: "/games",       label: "Games",       icon: Gamepad2 },
  { href: "/marketplace", label: "Marketplace", icon: ShoppingBag },
];
```

- [ ] **Step 2: Add to admin sidebar**

In `app/admin/layout.tsx`, add `Target` to the lucide-react import:

```typescript
import { Users, Award, LayoutDashboard, LogOut, ShoppingBag, ClipboardList, Gamepad2, Building2, Target } from "lucide-react";
```

In the `navItems` array, insert between Departments and Award Points:

```typescript
const navItems = [
  { href: "/admin",              label: "Overview",     icon: LayoutDashboard },
  { href: "/admin/employees",    label: "Employees",    icon: Users },
  { href: "/admin/departments",  label: "Departments",  icon: Building2 },
  { href: "/admin/missions",     label: "Missions",     icon: Target },
  { href: "/admin/points",       label: "Award Points", icon: Award },
  { href: "/admin/rewards",      label: "Rewards",      icon: ShoppingBag },
  { href: "/admin/redemptions",  label: "Redemptions",  icon: ClipboardList },
  { href: "/admin/games",        label: "Games",        icon: Gamepad2 },
];
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add app/(dashboard)/layout.tsx app/admin/layout.tsx
git commit -m "feat: add Missions to employee and admin navigation"
```

---

## Task 9: Employee UI — /missions Page

**Files:**
- Create: `app/(dashboard)/missions/page.tsx`

- [ ] **Step 1: Create the page**

```typescript
"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useApiClient } from "@/lib/hooks/useApiClient";
import { Target, Clock, CheckCircle2, XCircle, Loader2 } from "lucide-react";

type MyCompletion = {
  id: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  adminNote: string | null;
  completedAt: string;
};

type Mission = {
  id: string;
  title: string;
  description: string | null;
  pointsReward: number;
  type: "INDIVIDUAL" | "TEAM";
  startDate: string | null;
  endDate: string | null;
  myCompletion: MyCompletion | null;
};

type Filter = "AVAILABLE" | "COMPLETED" | "ALL";

export default function MissionsPage() {
  const { user, loading: authLoading } = useAuth();
  const { apiFetch } = useApiClient();
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("AVAILABLE");
  const [submitting, setSubmitting] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading || !user) return;
    apiFetch<{ data: Mission[] }>("/api/missions")
      .then((r) => setMissions(r.data))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user]);

  async function handleMarkComplete(mission: Mission) {
    if (!confirm(`Mark "${mission.title}" as complete? HR will review your submission.`)) return;
    setSubmitting(mission.id);
    try {
      await apiFetch(`/api/missions/${mission.id}/complete`, { method: "POST" });
      setMissions((prev) =>
        prev.map((m) =>
          m.id === mission.id
            ? { ...m, myCompletion: { id: "", status: "PENDING", adminNote: null, completedAt: new Date().toISOString() } }
            : m
        )
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to submit");
    } finally {
      setSubmitting(null);
    }
  }

  const filtered = missions.filter((m) => {
    if (filter === "AVAILABLE") return !m.myCompletion || m.myCompletion.status === "REJECTED";
    if (filter === "COMPLETED") return m.myCompletion?.status === "PENDING" || m.myCompletion?.status === "APPROVED";
    return true;
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Missions</h1>
        <p className="text-zinc-500 text-sm mt-1">Complete challenges to earn points</p>
      </div>

      <div className="flex gap-2">
        {(["AVAILABLE", "COMPLETED", "ALL"] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3.5 py-1.5 rounded-lg text-sm font-medium border transition-all ${
              filter === f
                ? "bg-indigo-600 text-white border-indigo-600"
                : "bg-white border-zinc-200 text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50"
            }`}
          >
            {f === "AVAILABLE" ? "Available" : f === "COMPLETED" ? "Completed" : "All"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-zinc-200 p-5 animate-pulse space-y-3">
              <div className="w-10 h-10 rounded-xl bg-zinc-100" />
              <div className="h-4 bg-zinc-100 rounded w-3/4" />
              <div className="h-3 bg-zinc-100 rounded w-full" />
              <div className="h-9 bg-zinc-100 rounded-lg w-full mt-4" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border border-zinc-200 text-center">
          <Target className="w-10 h-10 text-zinc-200 mb-4" />
          <p className="text-zinc-600 font-medium">No missions here</p>
          <p className="text-zinc-400 text-sm mt-1">
            {filter === "AVAILABLE" ? "Check back soon — HR will add new missions!" : "Nothing to show for this filter."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((mission) => {
            const comp = mission.myCompletion;
            const busy = submitting === mission.id;

            return (
              <div key={mission.id} className="bg-white rounded-xl border border-zinc-200 overflow-hidden flex flex-col hover:shadow-sm transition-shadow">
                <div className={`h-1 ${comp?.status === "APPROVED" ? "bg-emerald-500" : comp?.status === "REJECTED" ? "bg-red-400" : comp?.status === "PENDING" ? "bg-amber-400" : "bg-indigo-500"}`} />

                <div className="p-5 flex flex-col flex-1 gap-3">
                  <div className="flex items-start justify-between">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
                      <Target className="w-5 h-5 text-indigo-500" />
                    </div>
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-zinc-100 text-zinc-600 border border-zinc-200">
                      {mission.type === "INDIVIDUAL" ? "Individual" : "Team"}
                    </span>
                  </div>

                  <div className="flex-1">
                    <h3 className="font-bold text-zinc-900 leading-snug">{mission.title}</h3>
                    {mission.description && (
                      <p className="text-sm text-zinc-500 mt-1 line-clamp-2 leading-relaxed">{mission.description}</p>
                    )}
                  </div>

                  {mission.endDate && (
                    <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                      <Clock className="w-3.5 h-3.5" />
                      Ends {new Date(mission.endDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </div>
                  )}

                  {comp?.status === "REJECTED" && comp.adminNote && (
                    <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                      Not approved: {comp.adminNote}
                    </p>
                  )}

                  <div className="flex items-center justify-between pt-3 border-t border-zinc-100 mt-auto">
                    <p className="font-bold text-lg text-indigo-600 tabular-nums leading-none">
                      {mission.pointsReward.toLocaleString()}
                      <span className="text-sm font-medium ml-1 text-zinc-400">pts</span>
                    </p>

                    {!comp && (
                      <button
                        onClick={() => handleMarkComplete(mission)}
                        disabled={busy}
                        className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                      >
                        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                        {busy ? "Submitting…" : "Mark Complete"}
                      </button>
                    )}
                    {comp?.status === "PENDING" && (
                      <span className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-amber-50 text-amber-700 border border-amber-200">
                        <Clock className="w-3.5 h-3.5" /> Pending Review
                      </span>
                    )}
                    {comp?.status === "APPROVED" && (
                      <span className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Completed
                      </span>
                    )}
                    {comp?.status === "REJECTED" && (
                      <span className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-red-50 text-red-600 border border-red-200">
                        <XCircle className="w-3.5 h-3.5" /> Not Approved
                      </span>
                    )}
                  </div>
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

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Smoke test**

1. Run `npm run dev`
2. Sign in as employee
3. Navigate to `/missions`
4. Verify: page loads, "No missions here" empty state shows
5. After creating a mission in admin (Task 10), verify it appears and the Mark Complete button works

- [ ] **Step 4: Commit**

```bash
git add app/(dashboard)/missions/page.tsx
git commit -m "feat: add employee /missions page"
```

---

## Task 10: Admin UI — /admin/missions Page

**Files:**
- Create: `app/admin/missions/page.tsx`

- [ ] **Step 1: Create the page**

```typescript
"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useApiClient } from "@/lib/hooks/useApiClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Power, CheckCircle2, XCircle } from "lucide-react";

type Mission = {
  id: string;
  title: string;
  description: string | null;
  pointsReward: number;
  type: "INDIVIDUAL" | "TEAM";
  endDate: string | null;
  isActive: boolean;
  _count: { completions: number };
};

type Completion = {
  id: string;
  completedAt: string;
  user: { id: string; displayName: string; avatarUrl: string | null };
  mission: { id: string; title: string; pointsReward: number };
};

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function AdminMissionsPage() {
  const { user, loading: authLoading } = useAuth();
  const { apiFetch } = useApiClient();
  const [missions, setMissions] = useState<Mission[]>([]);
  const [completions, setCompletions] = useState<Completion[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [pointsReward, setPointsReward] = useState("100");
  const [type, setType] = useState<"INDIVIDUAL" | "TEAM">("INDIVIDUAL");
  const [endDate, setEndDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading || !user) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user]);

  async function load() {
    const [m, c] = await Promise.all([
      apiFetch<{ data: Mission[] }>("/api/admin/missions"),
      apiFetch<{ data: Completion[] }>("/api/admin/missions/completions"),
    ]);
    setMissions(m.data);
    setCompletions(c.data);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiFetch("/api/admin/missions", {
        method: "POST",
        body: JSON.stringify({
          title,
          description: description || undefined,
          pointsReward: Number(pointsReward),
          type,
          endDate: endDate ? new Date(endDate).toISOString() : undefined,
        }),
      });
      setShowForm(false);
      setTitle(""); setDescription(""); setPointsReward("100"); setType("INDIVIDUAL"); setEndDate("");
      await load();
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleActive(mission: Mission) {
    await apiFetch(`/api/admin/missions/${mission.id}`, {
      method: "PATCH",
      body: JSON.stringify({ isActive: !mission.isActive }),
    });
    await load();
  }

  async function handleApprove(id: string) {
    setProcessing(id);
    try {
      await apiFetch(`/api/admin/missions/completions/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "approve" }),
      });
      await load();
    } finally {
      setProcessing(null);
    }
  }

  async function handleReject(id: string) {
    if (!rejectNote.trim()) return;
    setProcessing(id);
    try {
      await apiFetch(`/api/admin/missions/completions/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "reject", adminNote: rejectNote }),
      });
      setRejectId(null);
      setRejectNote("");
      await load();
    } finally {
      setProcessing(null);
    }
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Missions</h1>
          <p className="text-gray-500 text-sm mt-1">Create challenges and review employee completions.</p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="w-4 h-4 mr-2" /> New Mission
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader><CardTitle className="text-base">New Mission</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 space-y-1.5">
                  <Label>Title</Label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="e.g. Complete the safety training" />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label>Description <span className="text-gray-400 font-normal">(optional)</span></Label>
                  <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
                </div>
                <div className="space-y-1.5">
                  <Label>Points Reward</Label>
                  <Input type="number" min={1} value={pointsReward} onChange={(e) => setPointsReward(e.target.value)} required />
                </div>
                <div className="space-y-1.5">
                  <Label>Type</Label>
                  <Select value={type} onValueChange={(v) => v && setType(v as "INDIVIDUAL" | "TEAM")}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="INDIVIDUAL">Individual</SelectItem>
                      <SelectItem value="TEAM">Team</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Deadline <span className="text-gray-400 font-normal">(optional)</span></Label>
                  <Input type="datetime-local" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={submitting}>{submitting ? "Creating…" : "Create Mission"}</Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">All Missions</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mission</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Points</TableHead>
                <TableHead>Deadline</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Completions</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {missions.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-gray-400">No missions yet.</TableCell></TableRow>
              ) : missions.map((m) => (
                <TableRow key={m.id}>
                  <TableCell>
                    <p className="font-medium">{m.title}</p>
                    {m.description && <p className="text-xs text-gray-400 truncate max-w-xs">{m.description}</p>}
                  </TableCell>
                  <TableCell><Badge variant="secondary">{m.type}</Badge></TableCell>
                  <TableCell className="font-semibold text-indigo-600">{m.pointsReward}</TableCell>
                  <TableCell className="text-sm text-gray-500">
                    {m.endDate ? new Date(m.endDate).toLocaleDateString() : "—"}
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${m.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {m.isActive ? "Active" : "Inactive"}
                    </span>
                  </TableCell>
                  <TableCell>{m._count.completions}</TableCell>
                  <TableCell>
                    <Button size="sm" variant="outline" onClick={() => toggleActive(m)} className="h-7 px-2">
                      <Power className="w-3 h-3 mr-1" />{m.isActive ? "Pause" : "Activate"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {completions.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Pending Completions ({completions.length})</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Mission</TableHead>
                  <TableHead>Points</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {completions.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.user.displayName}</TableCell>
                    <TableCell>{c.mission.title}</TableCell>
                    <TableCell className="font-semibold text-indigo-600">+{c.mission.pointsReward}</TableCell>
                    <TableCell className="text-sm text-gray-400">{timeAgo(c.completedAt)}</TableCell>
                    <TableCell>
                      {rejectId === c.id ? (
                        <div className="flex items-center gap-2">
                          <Input
                            autoFocus
                            placeholder="Reason for rejection (required)"
                            value={rejectNote}
                            onChange={(e) => setRejectNote(e.target.value)}
                            className="h-7 text-sm w-56"
                          />
                          <Button
                            size="sm"
                            variant="destructive"
                            className="h-7 px-2"
                            disabled={!rejectNote.trim() || processing === c.id}
                            onClick={() => handleReject(c.id)}
                          >
                            Confirm
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => { setRejectId(null); setRejectNote(""); }}>
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <div className="flex gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                            disabled={processing === c.id}
                            onClick={() => handleApprove(c.id)}
                          >
                            <CheckCircle2 className="w-3 h-3 mr-1" /> Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-red-500 border-red-200 hover:bg-red-50"
                            disabled={processing === c.id}
                            onClick={() => setRejectId(c.id)}
                          >
                            <XCircle className="w-3 h-3 mr-1" /> Reject
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Full end-to-end smoke test**

1. Sign in as HR Admin, go to `/admin/missions`
2. Create a mission: "Complete onboarding checklist", 200 pts, Individual
3. Verify it appears in the missions table as Active
4. In incognito, sign in as an employee, go to `/missions`
5. Verify the mission card appears with "Mark Complete" button
6. Click "Mark Complete", confirm
7. Verify card flips to "Pending Review" amber badge
8. Back in admin, verify the "Pending Completions" section appears with 1 item
9. Click "Approve" — verify employee's points balance increased by 200 and a notification was created
10. Test reject: create another completion, click Reject, enter a note, confirm — verify employee sees "Not Approved" with the note

- [ ] **Step 4: Commit**

```bash
git add app/admin/missions/page.tsx
git commit -m "feat: add admin /admin/missions page"
```
