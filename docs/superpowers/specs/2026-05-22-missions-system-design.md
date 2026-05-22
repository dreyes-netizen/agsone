# Missions System — Design Spec
_Date: 2026-05-22_

## Overview

Add a full Missions system to AGS One. Employees self-report mission completions; HR/Managers verify and approve or reject them. Approved completions award points via the existing `TASK` transaction type.

---

## 1. Data Layer

### Schema changes (`prisma/schema.prisma`)

Add enum:
```prisma
enum MissionCompletionStatus {
  PENDING
  APPROVED
  REJECTED
}
```

Extend `MissionCompletion` with three new fields:
```prisma
status       MissionCompletionStatus @default(PENDING)
adminNote    String?
verifiedAt   DateTime?
```

`verifiedById` already exists on the model and serves as the approver/rejector reference.

### API Routes

| Route | Method | Auth | Purpose |
|---|---|---|---|
| `/api/missions` | GET | Any authenticated | List active missions + current user's completion status |
| `/api/missions/[id]/complete` | POST | Any authenticated | Submit a completion (creates PENDING record) |
| `/api/admin/missions` | GET | Manager / HR_ADMIN | List all missions |
| `/api/admin/missions` | POST | Manager / HR_ADMIN | Create a mission |
| `/api/admin/missions/[id]` | PATCH | Manager / HR_ADMIN | Edit or toggle active/inactive |
| `/api/admin/missions/completions` | GET | Manager / HR_ADMIN | List all PENDING completions |
| `/api/admin/missions/completions/[id]` | PATCH | Manager / HR_ADMIN | Approve or reject with optional/required note |

---

## 2. Employee UI — `/missions`

**Route:** `app/(dashboard)/missions/page.tsx`

**Layout:** card grid, consistent with `/marketplace` and `/games`.

### Filter tabs
- **Available** — active missions where the user has no completion record (status: not submitted) OR was rejected (so they can see what they missed)
- **Completed** — missions with status PENDING or APPROVED
- **All** — everything regardless of status

### Mission card states
| State | Visual |
|---|---|
| Available | Indigo "Mark Complete" button |
| Awaiting Review | Amber "Pending Review" badge, button disabled |
| Approved | Emerald "Completed ✓" badge, points shown in green |
| Rejected | Red "Not Approved" badge, admin note shown below |

### Card fields
- Mission type badge: INDIVIDUAL or TEAM
- Title + description (2-line clamp)
- Points reward (prominent)
- Deadline if set (`endDate`)
- Action area (state-dependent)

### "Mark Complete" flow
Clicking "Mark Complete" shows a browser `confirm()` dialog (consistent with existing UX in marketplace and admin). On confirm, `POST /api/missions/[id]/complete`. Card switches to "Pending Review" state optimistically.

### Navigation
Add "Missions" to `app/(dashboard)/layout.tsx` main sidebar nav, with `Target` icon from lucide-react, between Feed and Marketplace.

---

## 3. Admin UI — `/admin/missions`

**Route:** `app/admin/missions/page.tsx`

Single page with two sections.

### Section A — Mission Management
- **"New Mission" button** toggles an inline creation form
- **Form fields:** title (required), description (optional), points reward (required, min 1), type (INDIVIDUAL / TEAM), start date (optional), end date (optional)
- **Missions table:** Name | Type | Points | Deadline | Status | Completions count | Actions
- **Actions:** Activate / Pause toggle

### Section B — Pending Completions
Shown below mission management. Only visible when there are pending completions.

- **Table:** Employee | Mission | Submitted (relative time) | Actions
- **Approve** — fires immediately, no note required
- **Reject** — opens an inline note input; note is required before confirming

### Navigation
Add "Missions" to `app/admin/layout.tsx` sidebar nav, with `Target` icon, between Departments and Award Points.

---

## 4. Points Flow

### On Approve
1. Verify `completion.status === PENDING` (guard against double-processing)
2. Create `PointTransaction` — type `TASK`, `amount = mission.pointsReward`, `toUserId = completion.userId`, `note = mission.title`, `createdById = verifier.id`
3. Increment `user.pointsBalance` by `mission.pointsReward`
4. Call `checkLevelUp(userId)` — existing helper
5. Call `checkAndAwardBadges(userId)` — existing helper
6. Create `Notification` — title: "Mission approved", body: `"'${mission.title}' — +${mission.pointsReward} pts"`
7. Set `completion.status = APPROVED`, `verifiedById = verifier.id`, `verifiedAt = now()`

### On Reject
1. Verify `completion.status === PENDING`
2. Set `completion.status = REJECTED`, `adminNote`, `verifiedById`, `verifiedAt = now()`
3. Create `Notification` — title: "Mission not approved", body: `"'${mission.title}' — ${adminNote}"`
4. No points awarded

### Edge Cases
- **Duplicate submission:** blocked by existing `@@unique([missionId, userId])` on `MissionCompletion`
- **Double-approval:** PATCH handler checks `status === PENDING` before processing
- **Inactive missions:** `GET /api/missions` filters to `isActive: true` only
- **Resubmission after rejection:** Not allowed in v1. The `@@unique([missionId, userId])` constraint means one completion record per user per mission. If HR rejects and later changes their mind, they can approve the existing rejected record. This keeps the audit trail clean.

---

## 5. Files Changed

### New files
```
app/(dashboard)/missions/page.tsx
app/api/missions/route.ts
app/api/missions/[id]/complete/route.ts
app/api/admin/missions/route.ts
app/api/admin/missions/[id]/route.ts
app/api/admin/missions/completions/route.ts
app/api/admin/missions/completions/[id]/route.ts
app/admin/missions/page.tsx
```

### Modified files
```
prisma/schema.prisma              — add MissionCompletionStatus enum + 3 fields
app/(dashboard)/layout.tsx        — add Missions nav item
app/admin/layout.tsx              — add Missions nav item
```

---

## 6. Out of Scope (v1)
- Submission notes / proof upload from employees
- Team mission tracking (type stored but employee UI treats all missions individually)
- Mission editing after creation (toggle active only)
- Bulk approval
