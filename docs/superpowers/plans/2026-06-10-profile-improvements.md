# Profile Page Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add tenure badge, streak nudge, sidebar milestone/badge widgets, shoutouts received, active missions, and custom banner upload to the profile page.

**Architecture:** Pure frontend changes use already-loaded profile state. Two new API fetches (missions + shoutouts) are added to the initial Promise.all. Banner upload uses existing Cloudinary infrastructure plus a new `bannerUrl` DB column on User. All changes are confined to one page file, two API routes, and the Prisma schema.

**Tech Stack:** Next.js 16 App Router, Prisma ORM, Supabase Postgres, Cloudinary (image upload), Tailwind CSS, lucide-react, Zod

**Spec:** `docs/superpowers/specs/2026-06-10-profile-improvements-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `prisma/schema.prisma` | Modify | Add `bannerUrl String?` to User model |
| `app/api/me/route.ts` | Modify | Expose `bannerUrl` in GET; accept it in PATCH |
| `app/api/me/shoutouts/route.ts` | **Create** | Return last 5 shoutouts where current user is recipient |
| `app/(dashboard)/profile/page.tsx` | Modify | All frontend changes: types, state, fetches, widgets, banner |

---

## Task 1: Add bannerUrl to DB schema

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add `bannerUrl` field to User model**

Open `prisma/schema.prisma`. Find the User model. Add `bannerUrl` after `avatarUrl`:

```prisma
model User {
  id                 String    @id @default(uuid())
  firebaseUid        String?   @unique
  email              String    @unique
  displayName        String
  avatarUrl          String?
  bannerUrl          String?       // <-- add this line
  role               Role      @default(EMPLOYEE)
  // ... rest of model unchanged
```

- [ ] **Step 2: Run migration**

```bash
npx prisma migrate dev --name add-user-banner-url
```

Expected output: `✔  Your database is now in sync with your schema.`

- [ ] **Step 3: Verify Prisma client updated**

```bash
npx prisma generate
```

Expected output: `✔ Generated Prisma Client`

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(profile): add bannerUrl field to User schema"
```

---

## Task 2: Update /api/me — expose and accept bannerUrl

**Files:**
- Modify: `app/api/me/route.ts`

- [ ] **Step 1: Add `bannerUrl` to the GET select and update the PATCH schema**

Replace the entire contents of `app/api/me/route.ts` with:

```ts
import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";
import { z } from "zod";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profile = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      displayName: true,
      email: true,
      avatarUrl: true,
      bannerUrl: true,
      role: true,
      pointsBalance: true,
      level: true,
      streakDays: true,
      onboardingComplete: true,
      birthday: true,
      hireDate: true,
      bio: true,
      skills: true,
      department: { select: { id: true, name: true } },
      userBadges: {
        orderBy: { awardedAt: "desc" },
        select: {
          id: true,
          awardedAt: true,
          badge: { select: { name: true, description: true } },
        },
      },
    },
  });

  return NextResponse.json({ data: profile });
}

const patchSchema = z.object({
  bio: z.string().max(500).optional(),
  skills: z.array(z.string().min(1).max(50)).max(20).optional(),
  bannerUrl: z.string().url().nullable().optional(),
});

export async function PATCH(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: parsed.data,
    select: { bio: true, skills: true, bannerUrl: true },
  });

  return NextResponse.json({ data: updated });
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep "api/me"
```

Expected: no output (no errors in this file).

- [ ] **Step 3: Commit**

```bash
git add app/api/me/route.ts
git commit -m "feat(profile): expose bannerUrl in GET /api/me and accept in PATCH"
```

---

## Task 3: Create /api/me/shoutouts endpoint

**Files:**
- Create: `app/api/me/shoutouts/route.ts`

- [ ] **Step 1: Create the file**

```ts
import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const shoutouts = await prisma.shoutoutRecipient.findMany({
    where: { userId: user.id },
    include: {
      post: {
        select: {
          id: true,
          content: true,
          createdAt: true,
          author: {
            select: {
              id: true,
              displayName: true,
              avatarUrl: true,
              department: { select: { name: true } },
            },
          },
        },
      },
    },
    orderBy: { post: { createdAt: "desc" } },
    take: 5,
  });

  return NextResponse.json({ data: shoutouts });
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep "shoutouts"
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add app/api/me/shoutouts/route.ts
git commit -m "feat(profile): add GET /api/me/shoutouts endpoint"
```

---

## Task 4: Update profile page types, state, and data fetching

**Files:**
- Modify: `app/(dashboard)/profile/page.tsx`

- [ ] **Step 1: Add new types after the existing `TimelineEntry` type (around line 58)**

```ts
type MissionItem = {
  id: string;
  title: string;
  pointsReward: number;
  myCompletion: { status: "PENDING" | "APPROVED" | "REJECTED" } | null;
};

type ShoutoutEntry = {
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
```

- [ ] **Step 2: Add `bannerUrl` to the `UserProfile` type**

Find the `UserProfile` type and add `bannerUrl` after `avatarUrl`:

```ts
type UserProfile = {
  id: string;
  displayName: string;
  email: string;
  avatarUrl: string | null;
  bannerUrl: string | null;   // <-- add this line
  role: string;
  // ... rest unchanged
};
```

- [ ] **Step 3: Add helper functions before the `txTypeLabel` constant (near top of file after imports)**

Add these pure utility functions:

```ts
function getDaysUntil(isoDate: string): number {
  const now = new Date();
  const d = new Date(isoDate);
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const next = new Date(now.getFullYear(), d.getMonth(), d.getDate());
  if (next.getTime() < todayMidnight.getTime()) next.setFullYear(now.getFullYear() + 1);
  return Math.round((next.getTime() - todayMidnight.getTime()) / (1000 * 60 * 60 * 24));
}

function getAnniversaryYear(hireDate: string): number {
  const now = new Date();
  const hire = new Date(hireDate);
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const thisYearDate = new Date(now.getFullYear(), hire.getMonth(), hire.getDate());
  return thisYearDate.getTime() < todayMidnight.getTime()
    ? now.getFullYear() + 1 - hire.getFullYear()
    : now.getFullYear() - hire.getFullYear();
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function getTenure(hireDate: string): string {
  const years = Math.floor((Date.now() - new Date(hireDate).getTime()) / (1000 * 60 * 60 * 24 * 365));
  if (years < 1) return "< 1 yr at AGS";
  return `${years} yr${years > 1 ? "s" : ""} at AGS`;
}
```

- [ ] **Step 4: Add new state variables inside `ProfilePage` (after existing state declarations)**

```ts
const [missions, setMissions] = useState<MissionItem[] | null>(null);
const [shoutouts, setShoutouts] = useState<ShoutoutEntry[] | null>(null);
const [bannerUploading, setBannerUploading] = useState(false);
const [bannerError, setBannerError] = useState("");
const bannerInputRef = useRef<HTMLInputElement>(null);
```

- [ ] **Step 5: Add `useRef` to the React import at the top of the file**

Change:
```ts
import { useEffect, useState } from "react";
```
To:
```ts
import { useEffect, useState, useRef } from "react";
```

- [ ] **Step 6: Expand the initial Promise.all to include missions and shoutouts**

Find the existing Promise.all in the first useEffect and replace it:

```ts
Promise.all([
  apiFetch<{ data: UserProfile }>("/api/me"),
  apiFetch<{ data: PointsData }>("/api/me/points"),
  apiFetch<{ data: MissionItem[] }>("/api/missions").catch(() => ({ data: [] as MissionItem[] })),
  apiFetch<{ data: ShoutoutEntry[] }>("/api/me/shoutouts").catch(() => ({ data: [] as ShoutoutEntry[] })),
]).then(([me, pts, miss, shouts]) => {
  setProfile(me.data);
  setPointsData(pts.data);
  setBioEdit(me.data.bio ?? "");
  setSkillsEdit(me.data.skills ?? []);
  setMissions(miss.data);
  setShoutouts(shouts.data);
}).catch(() => {
  // intentional: stop loading spinner on fetch failure
}).finally(() => {
  setLoading(false);
});
```

- [ ] **Step 7: Add `uploadToCloudinary` import and `Camera` icon import**

Add to existing lucide-react import:
```ts
import { History, Star, Flame, Medal, Coins, CalendarDays, Trophy, Award, Bell, FileText, Tag, Pencil, X, ShoppingBag, Gamepad2, Megaphone, Camera } from "lucide-react";
```

Add after the `Link` import:
```ts
import { uploadToCloudinary } from "@/lib/cloudinary/upload";
```

- [ ] **Step 8: Add `handleBannerUpload` function inside `ProfilePage` (after `handleCancelEdit`)**

```ts
async function handleBannerUpload(e: React.ChangeEvent<HTMLInputElement>) {
  const file = e.target.files?.[0];
  if (!file) return;
  setBannerUploading(true);
  setBannerError("");
  try {
    const url = await uploadToCloudinary(file);
    await apiFetch("/api/me", { method: "PATCH", body: JSON.stringify({ bannerUrl: url }) });
    setProfile((p) => p ? { ...p, bannerUrl: url } : p);
  } catch {
    setBannerError("Banner upload failed. Please try again.");
    setTimeout(() => setBannerError(""), 3000);
  } finally {
    setBannerUploading(false);
    if (bannerInputRef.current) bannerInputRef.current.value = "";
  }
}
```

- [ ] **Step 9: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep "profile/page"
```

Expected: no output.

- [ ] **Step 10: Commit**

```bash
git add app/(dashboard)/profile/page.tsx
git commit -m "feat(profile): add types, state, and parallel data fetching for new widgets"
```

---

## Task 5: Group 1 — Tenure badge, streak nudge, and sidebar widgets

**Files:**
- Modify: `app/(dashboard)/profile/page.tsx`

- [ ] **Step 1: Add tenure badge to the profile card**

Find the section that renders the role and department pills (inside the profile card's `<div className="flex items-start justify-between flex-wrap gap-3">`). After the department pill, add:

```tsx
{profile.hireDate && (
  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-teal-50 text-teal-700">
    {getTenure(profile.hireDate)}
  </span>
)}
```

The full pills section should look like:
```tsx
<div className="flex items-center gap-2 mt-2 flex-wrap">
  <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${roleBadgeStyle[profile.role] ?? "bg-zinc-100 text-zinc-700"}`}>
    {roleLabel[profile.role] ?? profile.role}
  </span>
  {profile.department && (
    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-zinc-100 text-zinc-600">
      {profile.department.name}
    </span>
  )}
  {profile.hireDate && (
    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-teal-50 text-teal-700">
      {getTenure(profile.hireDate)}
    </span>
  )}
</div>
```

- [ ] **Step 2: Add streak nudge to the streak stat card**

Find the streak stat card in the 4-card grid (the one with `icon: Flame` and `label: "Streak (days)"`). This grid renders each card identically, so add a special case for the streak card.

Replace the 4-card grid map with:

```tsx
<div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
  {[
    { icon: Coins, value: profile.pointsBalance.toLocaleString(), label: "Points Balance", color: "text-navy-600",   bg: "bg-navy-50",   hint: null },
    { icon: Star,  value: profile.level,                          label: "Level",          color: "text-violet-600", bg: "bg-violet-50", hint: null },
    { icon: Flame, value: profile.streakDays,                     label: "Streak (days)",  color: "text-orange-500", bg: "bg-orange-50",
      hint: profile.streakDays > 0 ? "Log in tomorrow to keep it going!" : "Log in daily to start a streak!" },
    { icon: Medal, value: profile.userBadges.length,              label: "Badges",         color: "text-amber-600",  bg: "bg-amber-50",  hint: null },
  ].map(({ icon: Icon, value, label, color, bg, hint }) => (
    <div key={label} className="bg-white rounded-xl border border-zinc-200 p-4 flex flex-col gap-2">
      <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center`}>
        <Icon className={`w-4 h-4 ${color}`} />
      </div>
      <p className={`text-2xl font-black leading-none ${color}`}>{value}</p>
      <p className="text-xs text-zinc-400 font-medium">{label}</p>
      {hint && <p className="text-xs text-zinc-400 italic leading-tight">{hint}</p>}
    </div>
  ))}
</div>
```

- [ ] **Step 3: Add Upcoming Milestone sidebar widget**

In the right sidebar `<div className="space-y-4 sticky top-6 self-start">`, add this as the **first** widget (before Dept Rank):

```tsx
{/* Widget 0: Upcoming Milestone */}
{(() => {
  const items: { emoji: string; label: string; daysUntil: number }[] = [];
  const dayLabel = (d: number) => d === 0 ? "Today!" : `in ${d} day${d === 1 ? "" : "s"}`;
  if (profile.birthday) {
    const d = getDaysUntil(profile.birthday);
    if (d <= 30) items.push({ emoji: "🎂", label: `Birthday ${dayLabel(d)}`, daysUntil: d });
  }
  if (profile.hireDate) {
    const d = getDaysUntil(profile.hireDate);
    if (d <= 30) {
      const yr = getAnniversaryYear(profile.hireDate);
      if (yr > 0) items.push({ emoji: "🎉", label: `${ordinal(yr)} anniversary ${dayLabel(d)}`, daysUntil: d });
    }
  }
  if (items.length === 0) return null;
  return (
    <div className="bg-white rounded-xl border border-zinc-200 px-5 py-4 space-y-2">
      <p className="text-xs text-zinc-400 font-medium">Upcoming</p>
      {items.map((item) => (
        <p key={item.label} className="text-sm font-semibold text-zinc-800">
          {item.emoji} {item.label}
        </p>
      ))}
    </div>
  );
})()}
```

- [ ] **Step 4: Add Recent Badges sidebar widget**

In the right sidebar, add after the Quick Actions widget:

```tsx
{/* Widget 4: Recent Badges */}
{profile.userBadges.length > 0 && (
  <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
    <div className="px-4 py-3 border-b border-zinc-100 flex items-center justify-between">
      <p className="text-xs font-semibold text-zinc-700">Recent Badges</p>
      <button onClick={() => setActiveTab("badges")} className="text-xs text-navy-600 hover:underline">
        See all →
      </button>
    </div>
    <ul className="divide-y divide-zinc-100">
      {profile.userBadges.slice(0, 2).map((ub) => (
        <li key={ub.id} className="flex items-center gap-3 px-4 py-2.5">
          <Award className="w-4 h-4 text-amber-500 shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-medium text-zinc-800 truncate">{ub.badge.name}</p>
            <p className="text-xs text-zinc-400">{new Date(ub.awardedAt).toLocaleDateString()}</p>
          </div>
        </li>
      ))}
    </ul>
  </div>
)}
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep "profile/page"
```

Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add app/(dashboard)/profile/page.tsx
git commit -m "feat(profile): add tenure badge, streak nudge, milestone and badges sidebar widgets"
```

---

## Task 6: Active Missions widget (Overview tab)

**Files:**
- Modify: `app/(dashboard)/profile/page.tsx`

- [ ] **Step 1: Add missions widget in the Overview tab, after `<MinigamesStatsCard />`**

Find `{/* Minigames stats */}` in the Overview tab and add the missions widget immediately after `<MinigamesStatsCard />`:

```tsx
{/* Active Missions */}
{missions && missions.filter(m => !m.myCompletion || m.myCompletion.status === "PENDING").length > 0 && (
  <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
    <div className="px-5 py-3.5 border-b border-zinc-100 flex items-center justify-between">
      <p className="text-sm font-semibold text-zinc-800">🎯 Active Missions</p>
      <Link href="/dashboard" className="text-xs text-navy-600 hover:underline">Go to Dashboard →</Link>
    </div>
    <ul className="divide-y divide-zinc-100">
      {missions
        .filter(m => !m.myCompletion || m.myCompletion.status === "PENDING")
        .slice(0, 3)
        .map((m) => (
          <li key={m.id} className="flex items-center gap-3 px-5 py-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-zinc-800 truncate">{m.title}</p>
              <p className="text-xs text-zinc-400">{m.pointsReward.toLocaleString()} pts</p>
            </div>
            {m.myCompletion?.status === "PENDING" ? (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-600">Pending</span>
            ) : (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">In Progress</span>
            )}
          </li>
        ))}
    </ul>
  </div>
)}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep "profile/page"
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add app/(dashboard)/profile/page.tsx
git commit -m "feat(profile): add active missions widget to Overview tab"
```

---

## Task 7: Shoutouts Received widget (Overview tab)

**Files:**
- Modify: `app/(dashboard)/profile/page.tsx`

- [ ] **Step 1: Add shoutouts widget after the Skills section in the Overview tab**

Find the Skills section close tag (`</div>` after the skills block). Add this widget immediately after:

```tsx
{/* Shoutouts Received */}
{shoutouts !== null && (
  <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
    <div className="px-5 py-3.5 border-b border-zinc-100 flex items-center justify-between">
      <p className="text-sm font-semibold text-zinc-800">💬 Shoutouts</p>
      <Link href="/feed" className="text-xs text-navy-600 hover:underline">See all →</Link>
    </div>
    {shoutouts.length === 0 ? (
      <p className="px-5 py-4 text-sm text-zinc-400 italic">No shoutouts yet — keep up the great work!</p>
    ) : (
      <ul className="divide-y divide-zinc-100">
        {shoutouts.map((s) => (
          <li key={s.id} className="flex gap-3 px-5 py-3">
            <div className="w-8 h-8 rounded-full bg-navy-500 flex items-center justify-center text-white font-bold text-xs shrink-0 overflow-hidden">
              {s.post.author.avatarUrl
                ? <img src={s.post.author.avatarUrl} alt={s.post.author.displayName} className="w-full h-full object-cover" />
                : s.post.author.displayName.charAt(0).toUpperCase()
              }
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-zinc-800">{s.post.author.displayName}</p>
              <p className="text-xs text-zinc-600 line-clamp-2 leading-relaxed">{s.post.content}</p>
              <p className="text-xs text-zinc-400 mt-0.5">{new Date(s.post.createdAt).toLocaleDateString()}</p>
            </div>
          </li>
        ))}
      </ul>
    )}
  </div>
)}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep "profile/page"
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add app/(dashboard)/profile/page.tsx
git commit -m "feat(profile): add shoutouts received widget to Overview tab"
```

---

## Task 8: Custom banner upload

**Files:**
- Modify: `app/(dashboard)/profile/page.tsx`

- [ ] **Step 1: Replace the profile card header with the banner-aware version**

Find the existing header div:

```tsx
{/* Top accent */}
<div className="h-24 bg-gradient-to-br from-navy-500 to-violet-600 relative">
  <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)", backgroundSize: "20px 20px" }} />
</div>
```

Replace with:

```tsx
{/* Top accent — click to upload banner */}
<div
  className="h-24 bg-gradient-to-br from-navy-500 to-violet-600 relative group cursor-pointer"
  onClick={() => bannerInputRef.current?.click()}
>
  {profile.bannerUrl ? (
    <img src={profile.bannerUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
  ) : (
    <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)", backgroundSize: "20px 20px" }} />
  )}
  <div className={`absolute inset-0 flex items-center justify-center transition-opacity ${bannerUploading ? "bg-black/50 opacity-100" : "bg-black/30 opacity-0 group-hover:opacity-100"}`}>
    {bannerUploading
      ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
      : <Camera className="w-5 h-5 text-white" />
    }
  </div>
  <input
    ref={bannerInputRef}
    type="file"
    accept="image/*"
    className="hidden"
    onChange={handleBannerUpload}
  />
</div>
```

- [ ] **Step 2: Show banner error below the profile card**

Find the closing `</div>` of the profile card (the one wrapping `{/* Top accent */}` and `<div className="px-6 pb-6 relative">`). After the entire profile card `</div>`, add:

```tsx
{bannerError && (
  <p className="text-xs text-red-500 text-center -mt-3">{bannerError}</p>
)}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep "profile/page"
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add app/(dashboard)/profile/page.tsx
git commit -m "feat(profile): add custom banner upload with Cloudinary and camera hover overlay"
```

---

## Final Verification Checklist

- [ ] Dev server starts without errors: `npm run dev`
- [ ] Profile card shows tenure pill for users with hire date (teal, e.g. "3 yrs at AGS")
- [ ] Streak stat card shows nudge text below the label
- [ ] Sidebar: Upcoming Milestone shows birthday/anniversary if within 30 days; hidden otherwise
- [ ] Sidebar: Recent Badges shows last 2 badges; "See all →" switches to Badges tab
- [ ] Overview tab: Active Missions shows missions with no completion or PENDING status; hidden if none
- [ ] Overview tab: Shoutouts section always renders (empty state or list)
- [ ] Profile card: camera icon overlay appears on header hover; upload triggers file picker
- [ ] Banner upload: spinner shows during upload; banner renders after success
- [ ] Banner error: red message appears briefly on upload failure, auto-clears after 3s
- [ ] All 4 tabs: sidebar (Dept Rank, Recent Activity, Quick Actions + new widgets) remains visible
- [ ] Mobile: sidebar stacks below tab content cleanly
