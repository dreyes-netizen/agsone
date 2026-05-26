# Department Challenges — Design Spec

**Date:** 2026-05-27
**Feature:** Collaborative department-level challenges with shared goals

---

## Overview

HR admins create time-boxed challenges (e.g., "Complete 50 missions this month"). All departments participate — each works toward the same target value as a team. Progress is computed at query time from existing data (no denormalized progress table). Scoring is per-department total (not normalized by headcount) — the goal is collaborative, not competitive.

---

## Schema

### New enum

```prisma
enum ChallengeMetric {
  TOTAL_POINTS       // sum of positive PointTransaction amounts in window
  MISSIONS_COMPLETED // count of approved MissionCompletion in window
  SHOUTOUTS_SENT     // count of SHOUTOUT posts in window
}
```

### New model

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

Add `challengesCreated Challenge[]` to User model.

No per-dept progress table — progress is computed live from PointTransaction / MissionCompletion / SocialPost.

---

## Progress Computation

For each active challenge, per department:

| Metric | Query |
|---|---|
| `TOTAL_POINTS` | `SUM(PointTransaction.amount)` where `toUser.departmentId = deptId` AND `createdAt` in `[startDate, endDate]` AND `amount > 0` |
| `MISSIONS_COMPLETED` | `COUNT(MissionCompletion)` where `user.departmentId = deptId` AND `completedAt` in `[startDate, endDate]` AND `status = APPROVED` |
| `SHOUTOUTS_SENT` | `COUNT(SocialPost)` where `author.departmentId = deptId` AND `type = SHOUTOUT` AND `createdAt` in `[startDate, endDate]` |

Computed via Prisma aggregate queries, one per department per challenge. Results are not cached — acceptable for the expected scale.

---

## Architecture

### Admin API

**`GET /api/admin/challenges`** — list all challenges (HR_ADMIN + MANAGER)
- Returns all challenges ordered by `createdAt desc`

**`POST /api/admin/challenges`** — create challenge (HR_ADMIN only)
- Body: `{ title, description?, metric, targetValue, startDate, endDate }`
- Validates `startDate < endDate`, `targetValue > 0`

**`PATCH /api/admin/challenges/[id]`** — update (HR_ADMIN only)
- Accepts any subset of: `title`, `description`, `isActive`, `endDate`
- Does not allow changing `metric` or `targetValue` after creation (data integrity)

### Employee API

**`GET /api/challenges`** — active challenges with dept progress (any auth user)
- Returns all `isActive = true` challenges where `endDate >= now`
- For each challenge, computes progress per department
- Response:
  ```json
  {
    "data": [
      {
        "id": "...",
        "title": "Mission Month",
        "description": "Complete 50 missions as a team",
        "metric": "MISSIONS_COMPLETED",
        "targetValue": 50,
        "startDate": "2026-05-01T00:00:00Z",
        "endDate": "2026-05-31T23:59:59Z",
        "deptProgress": [
          { "deptId": "...", "deptName": "Engineering", "progress": 23 },
          { "deptId": "...", "deptName": "Marketing", "progress": 11 }
        ]
      }
    ]
  }
  ```
- Departments ordered by progress descending

### UI — Employee `/challenges` page

- Route: `app/(dashboard)/challenges/page.tsx`
- Added to sidebar nav between Leaderboard and Shoutouts (Trophy2 or Swords icon → use `Swords` from lucide-react)
- Each challenge renders as a card:
  - Title + description
  - Metric label + time remaining badge (e.g., "4 days left" or "Ended")
  - One progress bar per department:
    - Dept name + progress number / target
    - Bar fills proportionally (capped at 100%)
    - User's own department row highlighted with a navy ring
  - "Goal reached" green banner when any dept hits target
- Loading skeleton while fetching

### UI — Admin `/admin/challenges` page

- Table of all challenges with title, metric, target, dates, status badge
- "New Challenge" button → inline form or modal
- Toggle isActive per row
- No edit of metric/targetValue after creation (shown as read-only)

---

## Data Flow

```
Employee visits /challenges
  → GET /api/challenges
  → server loads active challenges
  → for each challenge × each department: runs aggregate query
  → returns merged payload
  → UI renders one card per challenge, progress bars per dept

Admin creates challenge
  → POST /api/admin/challenges
  → validates fields
  → inserts Challenge row
  → challenge appears on /challenges immediately
```

---

## File Map

| File | Action |
|------|--------|
| `prisma/schema.prisma` | Add `ChallengeMetric` enum + `Challenge` model |
| `app/api/admin/challenges/route.ts` | New — GET + POST |
| `app/api/admin/challenges/[id]/route.ts` | New — PATCH |
| `app/api/challenges/route.ts` | New — GET with dept progress |
| `app/(dashboard)/challenges/page.tsx` | New — employee view |
| `app/admin/challenges/page.tsx` | New — admin management |
| `app/(dashboard)/layout.tsx` | Modify — add Challenges to sidebar nav |
| `app/admin/layout.tsx` | Modify — add Challenges to admin sidebar nav |

---

## Error Handling

- No departments in DB: API returns `deptProgress: []` — UI shows empty state
- Challenge with no users in a dept: progress = 0 (aggregate returns 0)
- Aggregate query failure: 500 with `{ error: "Failed to load progress" }` — UI shows retry state

---

## Non-Goals

- No notifications when a department hits the target (future)
- No per-user contribution breakdown within the challenge
- No headcount normalization (collaborative goal, not competition)
- No reward/prize tied to challenge completion in this phase
