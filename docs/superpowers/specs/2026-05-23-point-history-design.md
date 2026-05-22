# Point History / Statement — Design Spec
_Date: 2026-05-23_

## Overview

Add a "Points" tab to the employee profile page (`/profile`) showing a full timeline of point earnings and deductions. No new data — `PointTransaction` already stores everything needed.

---

## 1. Data Layer

### No schema changes required.

`PointTransaction` already has: `toUserId`, `fromUserId`, `amount`, `type`, `note`, `createdAt`, `createdById`.

### New API endpoint

**`GET /api/me/points`** — returns the current user's point transaction history:

```typescript
// Query: all transactions where toUserId = authUser.id, ordered by createdAt desc
// Include: fromUser { displayName }, createdBy { displayName }
// Also include redemptions: Redemption where userId = authUser.id (for spend history)
```

Response shape:
```json
{
  "data": {
    "balance": 1250,
    "transactions": [
      {
        "id": "...",
        "amount": 100,
        "type": "TASK",
        "note": "Q1 Sales Target Hit",
        "createdAt": "2026-05-10T...",
        "from": { "displayName": "Maria Santos" }
      }
    ],
    "redemptions": [
      {
        "id": "...",
        "pointsSpent": 500,
        "reward": { "name": "Starbucks GC" },
        "createdAt": "2026-05-15T..."
      }
    ]
  }
}
```

---

## 2. Employee UI

### Profile page (`/profile`) — add "Points" tab

**Tab bar** (add alongside existing profile sections):
- Overview | **Points** | Badges

**Points tab content:**

**Balance card** at top:
- Large balance number with "pts" label
- Level badge (existing level system)
- "Total earned all-time" computed from sum of all positive transactions

**Transaction timeline** — chronological list, newest first:

Each row:
- Green `+100 pts` badge (earnings) or red `-500 pts` badge (redemptions)
- Title: transaction note or redemption reward name
- Subtitle: "From {name}" or "Redeemed" + date (relative: "3 days ago")
- Type chip: TASK / MANUAL / REDEMPTION

**Empty state** — "No points yet — complete missions or wait for your manager to recognize you!"

---

## 3. Rules & Edge Cases

- Only shows the current user's own history (no admin view here — that's in `/admin/employees`)
- Redemption spend rows are pulled from `Redemption` model (not PointTransaction — marketplace deductions may not be tracked as PointTransactions)
- If `PointTransaction.note` is null, fall back to the `type` label
- Pagination: load 50 most recent, "Load more" link

---

## 4. Files Changed

```
app/api/me/points/route.ts              — new GET endpoint
app/(dashboard)/profile/page.tsx        — add Points tab + timeline UI
```

---

## 5. Out of Scope (v1)

- Exporting point history as CSV
- Admin viewing another employee's point history here (already in admin panel)
- Points summary by category/month chart
