# Notification Preferences Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users toggle 4 in-app notification types on/off from their profile page; `createNotification` skips opted-out types silently.

**Architecture:** Add `notificationPrefs Json?` to the User model (null = all defaults on, opt-out model). The `createNotification` helper checks the field before inserting. Two new API routes `GET/PUT /api/me/notification-preferences` read and merge prefs. A "Notifications" tab added to the profile page renders toggle rows with optimistic updates.

**Tech Stack:** Next.js 16.2.6 App Router, Prisma, Tailwind CSS v4, Lucide React

**Codebase context:**
- Auth: `verifyAuth(req)` from `@/lib/auth/verifyAuth`
- Client fetch: `useApiClient()` → `apiFetch<T>()` with auto Bearer token
- Current profile page: `app/(dashboard)/profile/page.tsx` — has `activeTab` state typed as `"overview" | "points" | "badges"`, tab bar at line 252–266
- `createNotification` at `lib/helpers/createNotification.ts` — currently inserts directly without checking prefs
- After running `prisma migrate dev`, always run `prisma generate` to regenerate the client

---

## File Map

| File | Action |
|------|--------|
| `prisma/schema.prisma` | Modify — add `notificationPrefs Json?` to User |
| `lib/helpers/createNotification.ts` | Modify — check prefs before insert |
| `app/api/me/notification-preferences/route.ts` | New — GET + PUT |
| `app/(dashboard)/profile/page.tsx` | Modify — add Notifications tab |

---

### Task 1: Schema migration

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add field to User model**

In `prisma/schema.prisma`, inside the `model User { ... }` block, add after `onboardingComplete Boolean @default(false)`:

```prisma
notificationPrefs Json?
```

The User model block around that area should look like:
```prisma
  onboardingComplete Boolean   @default(false)
  notificationPrefs  Json?
  isActive           Boolean   @default(true)
```

- [ ] **Step 2: Run migration**

```bash
npx prisma migrate dev --name add_notification_prefs
```

Expected: migration created and applied, no errors.

- [ ] **Step 3: Regenerate Prisma client**

```bash
npx prisma generate
```

Expected: `@prisma/client` generated successfully.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add notificationPrefs JSON field to User"
```

---

### Task 2: Update createNotification helper

**Files:**
- Modify: `lib/helpers/createNotification.ts`

The current file inserts directly. We add a pref check for the 4 toggleable types before inserting. Types not in the list always proceed.

- [ ] **Step 1: Replace the file content**

```typescript
import { prisma } from "@/lib/prisma/client";
import { Prisma } from "@/lib/generated/prisma/client";

type CreateNotificationParams = {
  userId: string;
  type: string;
  title: string;
  body: string;
  data?: Prisma.InputJsonValue;
};

const TOGGLEABLE_TYPES = [
  "SHOUTOUT_RECEIVED",
  "MISSION_COMPLETED",
  "POINTS_AWARDED",
  "MILESTONE_REWARD",
];

export async function createNotification(params: CreateNotificationParams) {
  if (TOGGLEABLE_TYPES.includes(params.type)) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: params.userId },
        select: { notificationPrefs: true },
      });
      const prefs = (user?.notificationPrefs ?? {}) as Record<string, boolean>;
      if (prefs[params.type] === false) return null;
    } catch {
      // fail open — if pref check errors, still send notification
    }
  }
  return prisma.notification.create({ data: params });
}
```

- [ ] **Step 2: Verify no TypeScript errors**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/helpers/createNotification.ts
git commit -m "feat: check notification prefs before inserting notification"
```

---

### Task 3: Notification preferences API

**Files:**
- Create: `app/api/me/notification-preferences/route.ts`

- [ ] **Step 1: Create the route**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";

const TOGGLEABLE_TYPES = [
  "SHOUTOUT_RECEIVED",
  "MISSION_COMPLETED",
  "POINTS_AWARDED",
  "MILESTONE_REWARD",
] as const;

type PrefKey = (typeof TOGGLEABLE_TYPES)[number];

const DEFAULTS: Record<PrefKey, boolean> = {
  SHOUTOUT_RECEIVED: true,
  MISSION_COMPLETED: true,
  POINTS_AWARDED: true,
  MILESTONE_REWARD: true,
};

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { notificationPrefs: true },
  });
  const stored = (dbUser?.notificationPrefs ?? {}) as Record<string, boolean>;
  const merged: Record<PrefKey, boolean> = { ...DEFAULTS };
  for (const key of TOGGLEABLE_TYPES) {
    if (key in stored) merged[key] = stored[key];
  }

  return NextResponse.json({ data: merged });
}

export async function PUT(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as Record<string, unknown>;

  const invalidKeys = Object.keys(body).filter(
    (k) => !(TOGGLEABLE_TYPES as readonly string[]).includes(k)
  );
  if (invalidKeys.length > 0) {
    return NextResponse.json(
      { error: `Invalid preference keys: ${invalidKeys.join(", ")}` },
      { status: 400 }
    );
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { notificationPrefs: true },
  });
  const existing = (dbUser?.notificationPrefs ?? {}) as Record<string, boolean>;
  const updated = { ...existing, ...body };

  await prisma.user.update({
    where: { id: user.id },
    data: { notificationPrefs: updated },
  });

  const merged: Record<PrefKey, boolean> = { ...DEFAULTS };
  for (const key of TOGGLEABLE_TYPES) {
    if (key in updated) merged[key] = (updated as Record<string, boolean>)[key];
  }

  return NextResponse.json({ data: merged });
}
```

- [ ] **Step 2: Verify no TypeScript errors**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "app/api/me/notification-preferences/route.ts"
git commit -m "feat: add GET/PUT /api/me/notification-preferences"
```

---

### Task 4: Add Notifications tab to profile page

**Files:**
- Modify: `app/(dashboard)/profile/page.tsx`

The current profile page has:
- Line 155: `const [activeTab, setActiveTab] = useState<"overview" | "points" | "badges">("overview");`
- Line 6: imports from lucide-react include `History, Star, Flame, Medal, Coins, CalendarDays, Trophy, Award`
- Line 252–266: tab bar mapping over `["overview", "points", "badges"]`
- Line 269–340: overview tab content
- Line 454–487: badges tab content

- [ ] **Step 1: Add Bell import**

In `app/(dashboard)/profile/page.tsx`, update the lucide-react import line to add `Bell`:

Change:
```typescript
import { History, Star, Flame, Medal, Coins, CalendarDays, Trophy, Award } from "lucide-react";
```

To:
```typescript
import { History, Star, Flame, Medal, Coins, CalendarDays, Trophy, Award, Bell } from "lucide-react";
```

- [ ] **Step 2: Add notification preferences state**

Inside `ProfilePage()`, after the existing state declarations (after line 159 `const [birthdayError, setBirthdayError] = useState("");`), add:

```typescript
const [notifPrefs, setNotifPrefs] = useState<Record<string, boolean> | null>(null);
const [notifLoading, setNotifLoading] = useState(false);
const [notifSaving, setNotifSaving] = useState<string | null>(null);
const [notifError, setNotifError] = useState("");
```

- [ ] **Step 3: Add effect to fetch prefs when tab is activated**

After the existing `useEffect` that fetches profile data (after line 175), add:

```typescript
useEffect(() => {
  if (activeTab !== "notifications" || notifPrefs !== null) return;
  setNotifLoading(true);
  apiFetch<{ data: Record<string, boolean> }>("/api/me/notification-preferences")
    .then((res) => setNotifPrefs(res.data))
    .catch(() => setNotifError("Failed to load preferences"))
    .finally(() => setNotifLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [activeTab]);
```

- [ ] **Step 4: Add toggle handler**

After the `handleBirthdaySave` function (after line 193), add:

```typescript
async function handleNotifToggle(type: string, value: boolean) {
  if (!notifPrefs) return;
  const previous = notifPrefs;
  setNotifPrefs({ ...notifPrefs, [type]: value });
  setNotifSaving(type);
  try {
    const res = await apiFetch<{ data: Record<string, boolean> }>(
      "/api/me/notification-preferences",
      { method: "PUT", body: JSON.stringify({ [type]: value }) }
    );
    setNotifPrefs(res.data);
  } catch {
    setNotifPrefs(previous);
    setNotifError("Failed to save preference");
  } finally {
    setNotifSaving(null);
  }
}
```

- [ ] **Step 5: Update activeTab type and tab bar**

Change line 155:
```typescript
const [activeTab, setActiveTab] = useState<"overview" | "points" | "badges">("overview");
```
To:
```typescript
const [activeTab, setActiveTab] = useState<"overview" | "points" | "badges" | "notifications">("overview");
```

Update the tab bar (line 253) — change the array and labels:
```tsx
{(["overview", "points", "badges", "notifications"] as const).map((tab) => (
  <button
    key={tab}
    onClick={() => { setActiveTab(tab); setVisibleCount(10); }}
    className={`flex-1 py-1.5 text-sm font-semibold rounded-lg capitalize transition-colors ${
      activeTab === tab
        ? "bg-white text-zinc-900 shadow-sm"
        : "text-zinc-500 hover:text-zinc-700"
    }`}
  >
    {tab === "points" ? "Points" : tab === "badges" ? "Badges" : tab === "notifications" ? "Notifs" : "Overview"}
  </button>
))}
```

- [ ] **Step 6: Add Notifications tab content**

After the closing `)}` of the badges tab block (after line 487), add:

```tsx
{/* ── Notifications tab ── */}
{activeTab === "notifications" && (
  <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
    <div className="px-5 py-3.5 border-b border-zinc-100 flex items-center gap-2">
      <Bell className="w-4 h-4 text-zinc-400" />
      <h2 className="text-sm font-bold text-zinc-800">Notification Preferences</h2>
    </div>

    {notifLoading ? (
      <div className="p-8 text-center text-zinc-400 text-sm">Loading…</div>
    ) : notifError ? (
      <div className="p-8 text-center text-red-400 text-sm">{notifError}</div>
    ) : notifPrefs ? (
      <ul className="divide-y divide-zinc-100">
        {[
          { type: "SHOUTOUT_RECEIVED", label: "Shoutout received", description: "When a colleague shouts you out" },
          { type: "MISSION_COMPLETED", label: "Mission approved", description: "When your mission completion is approved" },
          { type: "POINTS_AWARDED",    label: "Points awarded",   description: "When an admin manually awards you points" },
          { type: "MILESTONE_REWARD",  label: "Milestone reward", description: "On your birthday or work anniversary" },
        ].map(({ type, label, description }) => {
          const enabled = notifPrefs[type] !== false;
          const saving = notifSaving === type;
          return (
            <li key={type} className="flex items-center justify-between gap-4 px-5 py-4">
              <div>
                <p className="text-sm font-medium text-zinc-800">{label}</p>
                <p className="text-xs text-zinc-400 mt-0.5">{description}</p>
              </div>
              <button
                role="switch"
                aria-checked={enabled}
                disabled={saving}
                onClick={() => handleNotifToggle(type, !enabled)}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none disabled:opacity-50 ${
                  enabled ? "bg-navy-500" : "bg-zinc-200"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ${
                    enabled ? "translate-x-4" : "translate-x-0"
                  }`}
                />
              </button>
            </li>
          );
        })}
      </ul>
    ) : null}
  </div>
)}
```

- [ ] **Step 7: Verify no TypeScript errors**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add "app/(dashboard)/profile/page.tsx" "app/api/me/notification-preferences/route.ts"
git commit -m "feat: add Notifications tab to profile page with toggle UI"
```

---

## Self-Review Checklist

- [x] Schema: `notificationPrefs Json?` — null = all defaults, existing users unaffected
- [x] `createNotification`: only checks the 4 toggleable types, fails open on DB error
- [x] GET: merges stored prefs with DEFAULTS (missing keys default to true)
- [x] PUT: rejects unknown keys with 400, merges into existing JSON
- [x] Profile tab: optimistic toggle, reverts on error
- [x] Prefs fetched lazily only when tab is first opened (not on every mount)
- [x] Bell icon imported from lucide-react
- [x] activeTab type union updated to include "notifications"
