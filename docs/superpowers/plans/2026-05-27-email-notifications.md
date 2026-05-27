# Email Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the existing in-app notification preferences system to also send emails for 4 event types, with email opt-in toggles on the profile page.

**Architecture:** Reuse `notificationPrefs Json?` field — email prefs use `_EMAIL` suffix keys (default false, opt-in). `createNotification` fires emails fire-and-forget after the existing in-app pref check. The notification-preferences API gains 4 `_EMAIL` keys. The profile page Notifications tab gains an Email toggle column alongside the existing In-App column.

**Tech Stack:** Next.js 16.2.6 App Router, Prisma, Nodemailer (existing), Tailwind CSS v4

**Codebase context:**
- `lib/email/mailer.ts` — `sendMail({ to, subject, html })`, silently skips if EMAIL_USER/EMAIL_PASS not set
- `lib/email/templates.ts` — `layout()` wrapper + `BRAND_COLOR` already defined; needs `notificationEmail()` added
- `lib/helpers/createNotification.ts` — already checks `notificationPrefs` for in-app opt-out; needs email pref check added
- `app/api/me/notification-preferences/route.ts` — `TOGGLEABLE_TYPES` array + `DEFAULTS` object; needs 4 `_EMAIL` keys
- `app/(dashboard)/profile/page.tsx` — Notifications tab already has 4 toggle rows; needs Email column added

---

## File Map

| File | Action |
|------|--------|
| `lib/email/templates.ts` | Modify — add `notificationEmail(displayName, title, body)` |
| `lib/helpers/createNotification.ts` | Modify — load email + check `_EMAIL` pref → fire `sendMail` |
| `app/api/me/notification-preferences/route.ts` | Modify — add 4 `_EMAIL` keys to TOGGLEABLE_TYPES + DEFAULTS |
| `app/(dashboard)/profile/page.tsx` | Modify — add Email toggle column to Notifications tab |

---

### Task 1: Add notificationEmail template

**Files:**
- Modify: `lib/email/templates.ts`

- [ ] **Step 1: Add the template function**

In `lib/email/templates.ts`, append after the `redemptionStatusEmail` function (at end of file):

```typescript
export function notificationEmail(displayName: string, title: string, body: string) {
  return {
    subject: title,
    html: layout(`
      <h1 style="margin:0 0 8px;font-size:24px;color:#111827;">${title}</h1>
      <p style="margin:0 0 20px;font-size:15px;color:#4b5563;">Hi ${displayName},</p>
      <p style="margin:0 0 28px;font-size:15px;color:#4b5563;line-height:1.6;">${body}</p>
      <a href="${process.env.NEXT_PUBLIC_APP_URL ?? "#"}/dashboard"
         style="display:inline-block;background:${BRAND_COLOR};color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:14px;">
        Go to Dashboard →
      </a>
    `),
  };
}
```

- [ ] **Step 2: Verify no TypeScript errors**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/email/templates.ts
git commit -m "feat: add notificationEmail template to lib/email/templates.ts"
```

---

### Task 2: Update createNotification to send emails

**Files:**
- Modify: `lib/helpers/createNotification.ts`

Current file content:
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

- [ ] **Step 1: Replace the file content**

Replace the entire file with:

```typescript
import { prisma } from "@/lib/prisma/client";
import { Prisma } from "@/lib/generated/prisma/client";
import { sendMail } from "@/lib/email/mailer";
import { notificationEmail } from "@/lib/email/templates";

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
        select: { notificationPrefs: true, email: true, displayName: true },
      });
      const prefs = (user?.notificationPrefs ?? {}) as Record<string, boolean>;

      // In-app opt-out check (default true — only skip if explicitly false)
      if (prefs[params.type] === false) return null;

      // Email opt-in check (default false — only send if explicitly true)
      const emailKey = `${params.type}_EMAIL`;
      if (prefs[emailKey] === true && user?.email && user?.displayName) {
        const { subject, html } = notificationEmail(user.displayName, params.title, params.body);
        sendMail({ to: user.email, subject, html }).catch(() => {});
      }
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
git commit -m "feat: send email notifications via createNotification when email pref enabled"
```

---

### Task 3: Add _EMAIL keys to notification-preferences API

**Files:**
- Modify: `app/api/me/notification-preferences/route.ts`

Current `TOGGLEABLE_TYPES` and `DEFAULTS` in that file:
```typescript
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
```

- [ ] **Step 1: Replace TOGGLEABLE_TYPES, PrefKey, and DEFAULTS**

Change the `TOGGLEABLE_TYPES`, `PrefKey`, and `DEFAULTS` block to:

```typescript
const TOGGLEABLE_TYPES = [
  "SHOUTOUT_RECEIVED",
  "MISSION_COMPLETED",
  "POINTS_AWARDED",
  "MILESTONE_REWARD",
  "SHOUTOUT_RECEIVED_EMAIL",
  "MISSION_COMPLETED_EMAIL",
  "POINTS_AWARDED_EMAIL",
  "MILESTONE_REWARD_EMAIL",
] as const;

type PrefKey = (typeof TOGGLEABLE_TYPES)[number];

const DEFAULTS: Record<PrefKey, boolean> = {
  SHOUTOUT_RECEIVED: true,
  MISSION_COMPLETED: true,
  POINTS_AWARDED: true,
  MILESTONE_REWARD: true,
  SHOUTOUT_RECEIVED_EMAIL: false,
  MISSION_COMPLETED_EMAIL: false,
  POINTS_AWARDED_EMAIL: false,
  MILESTONE_REWARD_EMAIL: false,
};
```

The rest of the GET and PUT handlers do not need changes — they already iterate over `TOGGLEABLE_TYPES` dynamically.

- [ ] **Step 2: Verify no TypeScript errors**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "app/api/me/notification-preferences/route.ts"
git commit -m "feat: add _EMAIL pref keys to notification-preferences API"
```

---

### Task 4: Add Email toggle column to profile Notifications tab

**Files:**
- Modify: `app/(dashboard)/profile/page.tsx`

The Notifications tab currently renders 4 rows, each with one toggle (in-app). We add a second toggle (email) per row and a two-column header.

The current toggle row JSX (inside the `{activeTab === "notifications" && ...}` block) looks like:

```tsx
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
```

- [ ] **Step 1: Add column header inside the card header div**

Find the Notifications tab card header:
```tsx
<div className="px-5 py-3.5 border-b border-zinc-100 flex items-center gap-2">
  <Bell className="w-4 h-4 text-zinc-400" />
  <h2 className="text-sm font-bold text-zinc-800">Notification Preferences</h2>
</div>
```

Replace it with:
```tsx
<div className="px-5 py-3.5 border-b border-zinc-100 flex items-center gap-2">
  <Bell className="w-4 h-4 text-zinc-400" />
  <h2 className="text-sm font-bold text-zinc-800 flex-1">Notification Preferences</h2>
  <span className="text-xs text-zinc-400 w-9 text-center">In-App</span>
  <span className="text-xs text-zinc-400 w-7 text-center">Email</span>
</div>
```

- [ ] **Step 2: Replace each toggle row with a two-toggle row**

Replace the entire `<li>` element inside the `.map()`:

```tsx
<li key={type} className="flex items-center gap-4 px-5 py-4">
  <div className="flex-1">
    <p className="text-sm font-medium text-zinc-800">{label}</p>
    <p className="text-xs text-zinc-400 mt-0.5">{description}</p>
  </div>
  {/* In-app toggle */}
  <button
    role="switch"
    aria-label={`${label} in-app notifications`}
    aria-checked={enabled}
    disabled={notifSaving === type}
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
  {/* Email toggle */}
  {(() => {
    const emailKey = `${type}_EMAIL`;
    const emailEnabled = notifPrefs[emailKey] === true;
    const emailSaving = notifSaving === emailKey;
    return (
      <button
        role="switch"
        aria-label={`${label} email notifications`}
        aria-checked={emailEnabled}
        disabled={emailSaving}
        onClick={() => handleNotifToggle(emailKey, !emailEnabled)}
        className={`relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none disabled:opacity-50 ${
          emailEnabled ? "bg-navy-500" : "bg-zinc-200"
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow ring-0 transition duration-200 ${
            emailEnabled ? "translate-x-3" : "translate-x-0"
          }`}
        />
      </button>
    );
  })()}
</li>
```

Note: The email toggle is slightly smaller (`h-4 w-7` vs `h-5 w-9`, thumb `h-3 w-3`, translate `translate-x-3`) to visually distinguish it from the in-app toggle. The `handleNotifToggle` function works for both — it accepts any string key.

- [ ] **Step 3: Verify no TypeScript errors**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add "app/(dashboard)/profile/page.tsx"
git commit -m "feat: add Email toggle column to Notifications tab on profile page"
```

---

## Self-Review Checklist

- [x] No schema migration needed — `_EMAIL` keys live in existing `notificationPrefs Json?` field
- [x] `notificationEmail` uses `layout()` wrapper and `BRAND_COLOR` from templates.ts
- [x] `createNotification`: email pref check opt-in (`=== true`), in-app check opt-out (`=== false`)
- [x] `sendMail` call is fire-and-forget (`.catch(() => {})`) — email failure never blocks in-app notification
- [x] API: GET returns all 8 keys merged with DEFAULTS; PUT accepts any subset of 8 keys
- [x] Profile UI: IIFE for email toggle state avoids polluting the outer map scope
- [x] Email toggle is smaller than in-app toggle for visual distinction
- [x] `aria-label` on each toggle clarifies which type (in-app vs email) for accessibility
