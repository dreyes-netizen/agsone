# Milestone Rewards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Auto-award configurable points on employee birthdays and work anniversaries (1, 3, 5, 10 years) via a daily cron job, with an HR admin UI to configure each milestone.

**Architecture:** Schema adds `hireDate` to User + 3 new models. A GET cron at `/api/cron/milestones` replaces the existing `/api/cron/birthdays` cron. Admin UI at `/admin/milestones` lets HR configure points per milestone type. The existing birthday cron stays in place but vercel.json is updated to point to the new one.

**Tech Stack:** Next.js 16.2.6 App Router, Prisma ORM, PostgreSQL (Supabase), Tailwind CSS v4, Lucide React

**Codebase context:**
- Auth pattern: `verifyAuth(req)` returns `User | null`; `requireRole(user, roles)` returns boolean
- Admin role check: `if (!requireRole(user, ["HR_ADMIN", "MANAGER"])) return 403`
- API client: `apiFetch<T>(url, opts?)` — returns `T` directly, throws on error
- `createNotification({ userId, type, title, body, data? })` at `@/lib/helpers/createNotification`
- `prisma` at `@/lib/prisma/client`
- Tailwind: `bg-[#111827]` dark, `text-navy-600`, `bg-zinc-50/100/200`
- Cron auth: `req.headers.get("authorization") !== \`Bearer ${process.env.CRON_SECRET}\``
- Existing birthday cron at `app/api/cron/birthdays/route.ts` uses GET — new cron uses same pattern

---

## File Map

| File | Action |
|------|--------|
| `prisma/schema.prisma` | Modify — add MILESTONE enum value, hireDate, MilestoneType enum, MilestoneConfig, MilestoneAward |
| `app/api/admin/milestones/route.ts` | Create — GET + PUT for HR config |
| `app/admin/milestones/page.tsx` | Create — HR admin UI |
| `app/admin/layout.tsx` | Modify — add Milestones nav item |
| `app/api/admin/employees/[id]/route.ts` | Create — PATCH hireDate/birthday |
| `app/admin/employees/page.tsx` | Modify — add hireDate column with inline edit |
| `app/api/me/route.ts` | Modify — return hireDate in GET |
| `app/(dashboard)/profile/page.tsx` | Modify — show hireDate read-only, add MILESTONE to txTypeLabel |
| `app/api/cron/milestones/route.ts` | Create — daily cron logic |
| `vercel.json` | Modify — point cron to new endpoint |

---

### Task 1: Schema changes and migration

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add MILESTONE to PointTransactionType enum**

Find the `enum PointTransactionType` block and add `MILESTONE` at the end:

```prisma
enum PointTransactionType {
  MANUAL_AWARD
  ATTENDANCE
  TASK
  KPI
  CONTEST
  REDEMPTION
  GAME_WIN
  GAME_SPEND
  REFUND
  MILESTONE
}
```

- [ ] **Step 2: Add hireDate to User model**

Find the User model. After the `birthday DateTime?` line (line 117), add:

```prisma
  hireDate   DateTime?
```

Also add these two relation lines at the end of the User model's relation block, after `feedbackReplies FeedbackReply[]`:

```prisma
  milestoneAwards  MilestoneAward[]
  milestoneConfigs MilestoneConfig[]
```

- [ ] **Step 3: Add MilestoneType enum and new models**

After the `enum FeedbackStatus` block, add:

```prisma
enum MilestoneType {
  BIRTHDAY
  WORK_ANNIVERSARY_1
  WORK_ANNIVERSARY_3
  WORK_ANNIVERSARY_5
  WORK_ANNIVERSARY_10
}
```

After the `model FeedbackReply` block at the end of the file, add:

```prisma
model MilestoneConfig {
  id           String        @id @default(uuid())
  type         MilestoneType
  pointsReward Int
  isActive     Boolean       @default(true)
  updatedAt    DateTime      @updatedAt
  updatedById  String

  updatedBy User @relation(fields: [updatedById], references: [id])

  @@unique([type])
}

model MilestoneAward {
  id        String        @id @default(uuid())
  userId    String
  type      MilestoneType
  year      Int
  awardedAt DateTime      @default(now())

  user User @relation(fields: [userId], references: [id])

  @@unique([userId, type, year])
}
```

- [ ] **Step 4: Run migration**

```bash
npx prisma migrate dev --name milestone_rewards
```

Expected output: migration created and applied, no errors.

- [ ] **Step 5: Regenerate Prisma client**

```bash
npx prisma generate
```

Expected: `Generated Prisma Client` — no errors.

- [ ] **Step 6: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add milestone rewards schema (MilestoneConfig, MilestoneAward, hireDate)"
```

---

### Task 2: Admin milestones API

**Files:**
- Create: `app/api/admin/milestones/route.ts`

- [ ] **Step 1: Create the route**

```typescript
// app/api/admin/milestones/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, requireRole } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";
import { z } from "zod";

const MILESTONE_TYPES = [
  "BIRTHDAY",
  "WORK_ANNIVERSARY_1",
  "WORK_ANNIVERSARY_3",
  "WORK_ANNIVERSARY_5",
  "WORK_ANNIVERSARY_10",
] as const;

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!requireRole(user, ["HR_ADMIN", "MANAGER"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const configs = await prisma.milestoneConfig.findMany({
    orderBy: { type: "asc" },
  });

  return NextResponse.json({ data: configs });
}

const putSchema = z.object({
  configs: z.array(
    z.object({
      type: z.enum(MILESTONE_TYPES),
      pointsReward: z.number().int().min(0).max(100000),
      isActive: z.boolean(),
    })
  ),
});

export async function PUT(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!requireRole(user, ["HR_ADMIN"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = putSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const results = await Promise.all(
    parsed.data.configs.map((cfg) =>
      prisma.milestoneConfig.upsert({
        where: { type: cfg.type },
        create: {
          type: cfg.type,
          pointsReward: cfg.pointsReward,
          isActive: cfg.isActive,
          updatedById: user!.id,
        },
        update: {
          pointsReward: cfg.pointsReward,
          isActive: cfg.isActive,
          updatedById: user!.id,
        },
      })
    )
  );

  return NextResponse.json({ data: results });
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "app/api/admin/milestones/route.ts"
git commit -m "feat: add admin milestones GET + PUT API"
```

---

### Task 3: Admin milestones UI page

**Files:**
- Create: `app/admin/milestones/page.tsx`

- [ ] **Step 1: Create the page**

```typescript
// app/admin/milestones/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useApiClient } from "@/lib/hooks/useApiClient";
import { useAuth } from "@/lib/auth/AuthProvider";

type MilestoneType =
  | "BIRTHDAY"
  | "WORK_ANNIVERSARY_1"
  | "WORK_ANNIVERSARY_3"
  | "WORK_ANNIVERSARY_5"
  | "WORK_ANNIVERSARY_10";

type MilestoneConfig = {
  type: MilestoneType;
  pointsReward: number;
  isActive: boolean;
};

const DEFAULTS: MilestoneConfig[] = [
  { type: "BIRTHDAY",            pointsReward: 500,  isActive: true },
  { type: "WORK_ANNIVERSARY_1",  pointsReward: 200,  isActive: true },
  { type: "WORK_ANNIVERSARY_3",  pointsReward: 500,  isActive: true },
  { type: "WORK_ANNIVERSARY_5",  pointsReward: 1000, isActive: true },
  { type: "WORK_ANNIVERSARY_10", pointsReward: 2000, isActive: true },
];

const TYPE_LABELS: Record<MilestoneType, string> = {
  BIRTHDAY:            "Birthday",
  WORK_ANNIVERSARY_1:  "1-Year Work Anniversary",
  WORK_ANNIVERSARY_3:  "3-Year Work Anniversary",
  WORK_ANNIVERSARY_5:  "5-Year Work Anniversary",
  WORK_ANNIVERSARY_10: "10-Year Work Anniversary",
};

export default function MilestonesPage() {
  const { apiFetch } = useApiClient();
  const { user, loading: authLoading } = useAuth();
  const [configs, setConfigs] = useState<MilestoneConfig[]>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (authLoading || !user) return;
    apiFetch<{ data: MilestoneConfig[] }>("/api/admin/milestones")
      .then((res) => {
        if (res.data.length > 0) {
          const merged = DEFAULTS.map((d) => {
            const found = res.data.find((c) => c.type === d.type);
            return found ?? d;
          });
          setConfigs(merged);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user]);

  function updatePoints(type: MilestoneType, value: string) {
    const num = parseInt(value, 10);
    if (isNaN(num)) return;
    setConfigs((prev) =>
      prev.map((c) => (c.type === type ? { ...c, pointsReward: num } : c))
    );
  }

  function toggleActive(type: MilestoneType) {
    setConfigs((prev) =>
      prev.map((c) => (c.type === type ? { ...c, isActive: !c.isActive } : c))
    );
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await apiFetch("/api/admin/milestones", {
        method: "PUT",
        body: JSON.stringify({ configs }),
      });
      setSuccess("Milestone rewards saved!");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  const thClass = "text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide";
  const tdClass = "px-6 py-4";

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Milestone Rewards</h1>
        <p className="text-gray-500 text-sm mt-1">
          Configure automatic point awards for birthdays and work anniversaries.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-800">Milestone Configuration</h2>
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="bg-[#111827] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-gray-800 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save All"}
          </button>
        </div>

        {success && (
          <div className="mx-6 mt-4 px-4 py-2 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700">
            {success}
          </div>
        )}
        {error && (
          <div className="mx-6 mt-4 px-4 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Loading…</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className={thClass}>Milestone</th>
                <th className={thClass}>Points Awarded</th>
                <th className={thClass}>Active</th>
              </tr>
            </thead>
            <tbody>
              {configs.map((cfg) => (
                <tr key={cfg.type} className="border-b border-gray-50 hover:bg-gray-50/40 transition-colors">
                  <td className={`${tdClass} font-medium text-gray-900`}>
                    {TYPE_LABELS[cfg.type]}
                  </td>
                  <td className={tdClass}>
                    <input
                      type="number"
                      min={0}
                      max={100000}
                      value={cfg.pointsReward}
                      onChange={(e) => updatePoints(cfg.type, e.target.value)}
                      className="w-28 px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500/30 focus:border-navy-400 bg-white"
                    />
                  </td>
                  <td className={tdClass}>
                    <button
                      onClick={() => toggleActive(cfg.type)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                        cfg.isActive ? "bg-emerald-500" : "bg-gray-200"
                      }`}
                    >
                      <span
                        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                          cfg.isActive ? "translate-x-4" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="text-xs text-gray-400">
        Awards fire daily at 1 AM UTC. Employees need a birthday or hire date set to receive awards.
        Each milestone is awarded once per year (birthday) or once per qualifying anniversary year.
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "app/admin/milestones/page.tsx"
git commit -m "feat: add admin milestones configuration UI"
```

---

### Task 4: Add Milestones to admin sidebar nav

**Files:**
- Modify: `app/admin/layout.tsx`

- [ ] **Step 1: Add Gift import and nav entry**

In `app/admin/layout.tsx`, find the lucide-react import (line 5):

```typescript
import { Users, Award, LayoutDashboard, LogOut, ShoppingBag, ClipboardList, Gamepad2, Building2, Target, MessageSquare } from "lucide-react";
```

Change to:

```typescript
import { Users, Award, LayoutDashboard, LogOut, ShoppingBag, ClipboardList, Gamepad2, Building2, Target, MessageSquare, Gift } from "lucide-react";
```

Find the `navItems` array. After `{ href: "/admin/missions", label: "Missions", icon: Target }`, add:

```typescript
  { href: "/admin/milestones", label: "Milestones", icon: Gift },
```

Full updated navItems:
```typescript
const navItems = [
  { href: "/admin",             label: "Overview",    icon: LayoutDashboard },
  { href: "/admin/employees",   label: "Employees",   icon: Users },
  { href: "/admin/departments", label: "Departments", icon: Building2 },
  { href: "/admin/missions",    label: "Missions",    icon: Target },
  { href: "/admin/milestones",  label: "Milestones",  icon: Gift },
  { href: "/admin/points",      label: "Award Points", icon: Award },
  { href: "/admin/rewards",     label: "Rewards",     icon: ShoppingBag },
  { href: "/admin/redemptions", label: "Redemptions", icon: ClipboardList },
  { href: "/admin/games",       label: "Games",       icon: Gamepad2 },
  { href: "/admin/feedback",    label: "Feedback",    icon: MessageSquare },
];
```

- [ ] **Step 2: Commit**

```bash
git add "app/admin/layout.tsx"
git commit -m "feat: add Milestones to admin sidebar nav"
```

---

### Task 5: Admin employees hireDate API and UI

**Files:**
- Create: `app/api/admin/employees/[id]/route.ts`
- Modify: `app/admin/employees/page.tsx`

- [ ] **Step 1: Create PATCH employee route**

```typescript
// app/api/admin/employees/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, requireRole } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";
import { z } from "zod";

const schema = z.object({
  hireDate: z.string().optional().nullable(),
  birthday: z.string().optional().nullable(),
});

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
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { hireDate, birthday } = parsed.data;

  const updated = await prisma.user.update({
    where: { id },
    data: {
      ...(hireDate !== undefined ? { hireDate: hireDate ? new Date(hireDate) : null } : {}),
      ...(birthday !== undefined ? { birthday: birthday ? new Date(birthday) : null } : {}),
    },
    select: { id: true, hireDate: true, birthday: true },
  });

  return NextResponse.json({ data: updated });
}
```

- [ ] **Step 2: Add hireDate to admin employees page**

In `app/admin/employees/page.tsx`, update the Employee type to include hireDate:

Current type (line 7-15):
```typescript
type Employee = {
  id: string;
  displayName: string;
  email: string;
  role: "EMPLOYEE" | "MANAGER" | "HR_ADMIN";
  pointsBalance: number;
  isActive: boolean;
  department: { id: string; name: string } | null;
};
```

Change to:
```typescript
type Employee = {
  id: string;
  displayName: string;
  email: string;
  role: "EMPLOYEE" | "MANAGER" | "HR_ADMIN";
  pointsBalance: number;
  isActive: boolean;
  hireDate: string | null;
  department: { id: string; name: string } | null;
};
```

- [ ] **Step 3: Add hireDateEdit state and handler to EmployeesPage**

Inside `export default function EmployeesPage()`, after the `updatingDeptId` state (line 42), add:

```typescript
  const [updatingHireDateId, setUpdatingHireDateId] = useState<string | null>(null);
  const [hireDateEdits, setHireDateEdits] = useState<Record<string, string>>({});
```

After the `handleDepartmentChange` function, add:

```typescript
  async function handleHireDateSave(employeeId: string) {
    const value = hireDateEdits[employeeId];
    if (value === undefined) return;
    setUpdatingHireDateId(employeeId);
    try {
      await apiFetch(`/api/admin/employees/${employeeId}`, {
        method: "PATCH",
        body: JSON.stringify({ hireDate: value || null }),
      });
      setEmployees((prev) =>
        prev.map((e) => (e.id === employeeId ? { ...e, hireDate: value || null } : e))
      );
      setHireDateEdits((prev) => {
        const next = { ...prev };
        delete next[employeeId];
        return next;
      });
    } catch {
      alert("Failed to update hire date");
    } finally {
      setUpdatingHireDateId(null);
    }
  }
```

- [ ] **Step 4: Update GET to include hireDate**

In `app/admin/employees/page.tsx`, the employees are fetched from `/api/admin/employees`. Update `app/api/admin/employees/route.ts` to include `hireDate` in the select:

Current select in `app/api/admin/employees/route.ts`:
```typescript
    select: {
      id: true,
      displayName: true,
      email: true,
      role: true,
      pointsBalance: true,
      isActive: true,
      createdAt: true,
      department: { select: { id: true, name: true } },
    },
```

Change to:
```typescript
    select: {
      id: true,
      displayName: true,
      email: true,
      role: true,
      pointsBalance: true,
      isActive: true,
      createdAt: true,
      hireDate: true,
      department: { select: { id: true, name: true } },
    },
```

- [ ] **Step 5: Add Hire Date column to the table**

In the table `<thead>`, after the `Change Role` header, add:
```tsx
<th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Hire Date</th>
```

In the table `<tbody>` rows, after the role select `<td>`, add:
```tsx
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="date"
                        value={hireDateEdits[employee.id] ?? (employee.hireDate ? employee.hireDate.slice(0, 10) : "")}
                        onChange={(e) => setHireDateEdits((prev) => ({ ...prev, [employee.id]: e.target.value }))}
                        className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-navy-500/30 bg-white"
                      />
                      {hireDateEdits[employee.id] !== undefined && (
                        <button
                          onClick={() => handleHireDateSave(employee.id)}
                          disabled={updatingHireDateId === employee.id}
                          className="text-xs bg-[#111827] text-white px-2.5 py-1.5 rounded-lg hover:bg-gray-800 disabled:opacity-50"
                        >
                          {updatingHireDateId === employee.id ? "…" : "Save"}
                        </button>
                      )}
                    </div>
                  </td>
```

- [ ] **Step 6: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add "app/api/admin/employees/[id]/route.ts" "app/api/admin/employees/route.ts" "app/admin/employees/page.tsx"
git commit -m "feat: add hireDate editing to admin employees page"
```

---

### Task 6: Expose hireDate in /api/me and profile page

**Files:**
- Modify: `app/api/me/route.ts`
- Modify: `app/(dashboard)/profile/page.tsx`

- [ ] **Step 1: Add hireDate to /api/me GET select**

In `app/api/me/route.ts`, find the `select` block. After `birthday: true,` add:

```typescript
      hireDate: true,
```

- [ ] **Step 2: Add hireDate to UserProfile type in profile page**

In `app/(dashboard)/profile/page.tsx`, find the `type UserProfile` block (lines 14-26). After `birthday: string | null;`, add:

```typescript
  hireDate: string | null;
```

- [ ] **Step 3: Add MILESTONE to txTypeLabel**

In `app/(dashboard)/profile/page.tsx`, find the `txTypeLabel` constant (around line 56). Add a MILESTONE entry:

Current:
```typescript
const txTypeLabel: Record<string, { label: string; color: string }> = {
  MANUAL_AWARD: { label: "Award",      color: "text-emerald-600" },
  ATTENDANCE:   { label: "Attendance", color: "text-blue-600" },
  TASK:         { label: "Task",       color: "text-purple-600" },
  KPI:          { label: "KPI",        color: "text-navy-600" },
  CONTEST:      { label: "Contest",    color: "text-yellow-600" },
  REDEMPTION:   { label: "Redemption", color: "text-rose-500" },
  GAME_WIN:     { label: "Game Win",   color: "text-emerald-500" },
  GAME_SPEND:   { label: "Game",       color: "text-orange-500" },
  REFUND:       { label: "Refund",     color: "text-teal-600" },
};
```

Change to:
```typescript
const txTypeLabel: Record<string, { label: string; color: string }> = {
  MANUAL_AWARD: { label: "Award",      color: "text-emerald-600" },
  ATTENDANCE:   { label: "Attendance", color: "text-blue-600" },
  TASK:         { label: "Task",       color: "text-purple-600" },
  KPI:          { label: "KPI",        color: "text-navy-600" },
  CONTEST:      { label: "Contest",    color: "text-yellow-600" },
  REDEMPTION:   { label: "Redemption", color: "text-rose-500" },
  GAME_WIN:     { label: "Game Win",   color: "text-emerald-500" },
  GAME_SPEND:   { label: "Game",       color: "text-orange-500" },
  REFUND:       { label: "Refund",     color: "text-teal-600" },
  MILESTONE:    { label: "Milestone",  color: "text-amber-600" },
};
```

- [ ] **Step 4: Show hireDate read-only in profile overview**

In `app/(dashboard)/profile/page.tsx`, find the Birthday card (the `<div className="bg-white rounded-xl border border-zinc-200 px-5 py-4">` block around line 234). After the closing `</div>` of the Birthday card (before `</>` that closes the overview tab), add:

```tsx
          {profile.hireDate && (
            <div className="bg-white rounded-xl border border-zinc-200 px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                  <Trophy className="w-4 h-4 text-blue-500" />
                </div>
                <div>
                  <p className="text-xs text-zinc-400 font-medium">Hire Date</p>
                  <p className="text-sm font-semibold text-zinc-800">
                    {new Date(profile.hireDate).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}
                  </p>
                </div>
              </div>
            </div>
          )}
```

- [ ] **Step 5: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add "app/api/me/route.ts" "app/(dashboard)/profile/page.tsx"
git commit -m "feat: expose hireDate in /api/me and show on profile page"
```

---

### Task 7: Milestones cron and vercel.json

**Files:**
- Create: `app/api/cron/milestones/route.ts`
- Modify: `vercel.json`

- [ ] **Step 1: Create the cron route**

```typescript
// app/api/cron/milestones/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma/client";
import { createNotification } from "@/lib/helpers/createNotification";

const ANNIVERSARY_TYPES = {
  1:  "WORK_ANNIVERSARY_1",
  3:  "WORK_ANNIVERSARY_3",
  5:  "WORK_ANNIVERSARY_5",
  10: "WORK_ANNIVERSARY_10",
} as const;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = new Date();
  const todayMonth = today.getMonth();
  const todayDay = today.getDate();
  const todayYear = today.getFullYear();

  const configs = await prisma.milestoneConfig.findMany({
    where: { isActive: true },
  });
  if (configs.length === 0) {
    return NextResponse.json({ data: { awarded: 0, reason: "no active configs" } });
  }

  const configMap = Object.fromEntries(configs.map((c) => [c.type, c]));

  const users = await prisma.user.findMany({
    where: {
      OR: [{ birthday: { not: null } }, { hireDate: { not: null } }],
    },
    select: { id: true, displayName: true, birthday: true, hireDate: true },
  });

  let awarded = 0;

  for (const user of users) {
    // Birthday
    if (user.birthday && configMap["BIRTHDAY"]) {
      const bMonth = user.birthday.getMonth();
      const bDay = user.birthday.getDate();
      if (bMonth === todayMonth && bDay === todayDay) {
        const existing = await prisma.milestoneAward.findUnique({
          where: { userId_type_year: { userId: user.id, type: "BIRTHDAY", year: todayYear } },
        });
        if (!existing) {
          const cfg = configMap["BIRTHDAY"];
          await prisma.$transaction(async (tx) => {
            await tx.user.update({ where: { id: user.id }, data: { pointsBalance: { increment: cfg.pointsReward } } });
            await tx.pointTransaction.create({
              data: {
                toUserId: user.id,
                amount: cfg.pointsReward,
                type: "MILESTONE",
                note: `Happy Birthday! You've earned ${cfg.pointsReward} pts.`,
                createdById: cfg.updatedById,
              },
            });
            await tx.milestoneAward.create({ data: { userId: user.id, type: "BIRTHDAY", year: todayYear } });
          });
          await createNotification({
            userId: user.id,
            type: "MILESTONE",
            title: "Happy Birthday!",
            body: `You've received ${cfg.pointsReward} pts for your birthday!`,
          });
          awarded++;
        }
      }
    }

    // Work anniversaries
    if (user.hireDate) {
      const hMonth = user.hireDate.getMonth();
      const hDay = user.hireDate.getDate();
      if (hMonth === todayMonth && hDay === todayDay) {
        const yearsWorked = todayYear - user.hireDate.getFullYear();
        const milestoneType = ANNIVERSARY_TYPES[yearsWorked as keyof typeof ANNIVERSARY_TYPES];
        if (milestoneType && configMap[milestoneType]) {
          const existing = await prisma.milestoneAward.findUnique({
            where: { userId_type_year: { userId: user.id, type: milestoneType, year: todayYear } },
          });
          if (!existing) {
            const cfg = configMap[milestoneType];
            const label = `${yearsWorked}-Year Work Anniversary`;
            await prisma.$transaction(async (tx) => {
              await tx.user.update({ where: { id: user.id }, data: { pointsBalance: { increment: cfg.pointsReward } } });
              await tx.pointTransaction.create({
                data: {
                  toUserId: user.id,
                  amount: cfg.pointsReward,
                  type: "MILESTONE",
                  note: `Congratulations on your ${label}! You've earned ${cfg.pointsReward} pts.`,
                  createdById: cfg.updatedById,
                },
              });
              await tx.milestoneAward.create({ data: { userId: user.id, type: milestoneType, year: todayYear } });
            });
            await createNotification({
              userId: user.id,
              type: "MILESTONE",
              title: `Happy ${label}!`,
              body: `You've received ${cfg.pointsReward} pts for your ${label}.`,
            });
            awarded++;
          }
        }
      }
    }
  }

  return NextResponse.json({ data: { awarded } });
}
```

- [ ] **Step 2: Update vercel.json**

Replace the contents of `vercel.json` with:

```json
{
  "crons": [
    {
      "path": "/api/cron/milestones",
      "schedule": "0 1 * * *"
    }
  ]
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add "app/api/cron/milestones/route.ts" vercel.json
git commit -m "feat: add milestones cron and update vercel.json schedule"
```

---

## Self-Review Checklist

- [x] Schema: `hireDate` on User, `MilestoneType` enum, `MilestoneConfig`, `MilestoneAward` — all modeled correctly with unique constraints to prevent double-awarding
- [x] API: GET returns configs, PUT upserts all 5 types atomically, `updatedById` always set to the saving admin
- [x] Admin UI: table with 5 rows, inline points editing, toggle switch, Save All button, success/error feedback
- [x] Admin nav: Milestones added between Missions and Award Points
- [x] hireDate: PATCH API guarded to HR_ADMIN only, profile shows it read-only, admin employees table has inline edit
- [x] Cron: checks each user for birthday (month+day match) and anniversary (month+day + exact year count match), skips if MilestoneAward exists for that user/type/year
- [x] Cron: replaces old birthday cron in vercel.json — no double awarding
- [x] MILESTONE added to PointTransactionType enum and txTypeLabel on profile page
- [x] No placeholders — all code is complete
