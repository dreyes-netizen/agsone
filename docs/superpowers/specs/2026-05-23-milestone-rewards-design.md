# Automated Milestone Rewards — Design Spec
_Date: 2026-05-23_

## Overview

Auto-award points to employees on their birthday and work anniversaries (1, 3, 5, 10 years). HR admins configure point amounts per milestone type. A daily cron job fires the awards. Employees need a birthday and hire date on their profile to participate.

---

## 1. Data Layer

### Schema changes

**`User` model** — add optional date fields:
```prisma
birthday  DateTime?
hireDate  DateTime?
```

**New `MilestoneConfig` model:**
```prisma
model MilestoneConfig {
  id           String        @id @default(uuid())
  type         MilestoneType
  pointsReward Int
  isActive     Boolean       @default(true)
  updatedAt    DateTime      @updatedAt
  updatedById  String
  updatedBy    User          @relation(fields: [updatedById], references: [id])

  @@unique([type])
}

enum MilestoneType {
  BIRTHDAY
  WORK_ANNIVERSARY_1
  WORK_ANNIVERSARY_3
  WORK_ANNIVERSARY_5
  WORK_ANNIVERSARY_10
}
```

**New `MilestoneAward` model** — prevents double-awarding the same milestone:
```prisma
model MilestoneAward {
  id        String        @id @default(uuid())
  userId    String
  type      MilestoneType
  awardedAt DateTime      @default(now())
  year      Int

  user User @relation(fields: [userId], references: [id])

  @@unique([userId, type, year])
}
```

User model additions:
```prisma
birthday        DateTime?
hireDate        DateTime?
milestoneAwards MilestoneAward[]
```

### Cron endpoint

**`POST /api/cron/milestones`** — secured with `Authorization: Bearer {CRON_SECRET}`:

Logic (runs daily):
1. Fetch all active `MilestoneConfig` records
2. Fetch all users with `birthday` or `hireDate` set
3. For each user, check:
   - **Birthday**: `birthday` month+day matches today → award `BIRTHDAY` config points (once per year, checked via `MilestoneAward` with current year)
   - **Work anniversaries**: years since `hireDate` is 1, 3, 5, or 10 → award corresponding config points (once, checked via `MilestoneAward`)
4. For each match with no existing `MilestoneAward`:
   - `prisma.$transaction`: create `PointTransaction` + increment `user.pointsBalance` + create `MilestoneAward`
   - `createNotification` for the employee: `"🎉 Happy Birthday! You've been awarded X pts"`
   - Post a `SocialPost` of type `SHOUTOUT` tagging the employee (from a system/bot author — use the HR_ADMIN who set the config, or a designated system user)

### API for HR

**`GET /api/admin/milestones`** — returns all MilestoneConfig records.
**`PUT /api/admin/milestones`** — upsert all configs at once (body: array of `{ type, pointsReward, isActive }`).

---

## 2. Admin UI — `/admin/milestones`

**Table** — one row per milestone type:

| Milestone | Points | Active | |
|-----------|--------|--------|--|
| Birthday | 100 | ✓ | Edit |
| 1-Year Anniversary | 200 | ✓ | Edit |
| 3-Year Anniversary | 300 | ✓ | Edit |
| 5-Year Anniversary | 500 | ✓ | Edit |
| 10-Year Anniversary | 1000 | ✓ | Edit |

Inline edit: click points amount → number input → save.
Toggle active/inactive per type.

**Add to admin sidebar nav** between Missions and Award Points.

---

## 3. Employee Profile — Birthday / Hire Date

**Profile page** (`/profile`) — add optional "Personal Info" section:
- Birthday (date picker, year optional)
- Hire Date (read-only, pulled from HR records or set during onboarding)

**`PATCH /api/me`** — employees can update their own `birthday`.
**`PATCH /api/admin/employees/[id]`** — HR sets `hireDate` and can also set `birthday`.

---

## 4. Vercel Cron Configuration

In `vercel.json`, add:
```json
{
  "crons": [
    { "path": "/api/cron/milestones", "schedule": "0 1 * * *" }
  ]
}
```

This fires daily at 1:00 AM UTC. Secured via `CRON_SECRET` env var.

---

## 5. Files Changed

```
prisma/schema.prisma                        — MilestoneConfig, MilestoneAward, birthday/hireDate on User
app/api/cron/milestones/route.ts            — daily cron handler
app/api/admin/milestones/route.ts           — GET + PUT for HR config
app/admin/milestones/page.tsx               — HR admin UI
app/admin/layout.tsx                        — add Milestones nav item
app/(dashboard)/profile/page.tsx            — birthday field + hire date display
app/api/me/route.ts                         — PATCH to update birthday
app/api/admin/employees/[id]/route.ts       — PATCH to set hireDate
```

---

## 6. Out of Scope (v1)

- Custom milestone types (beyond the 5 built-in)
- Manager-triggered milestone recognition
- Milestone awards visible in admin analytics
- Welcome/onboarding award on first login
