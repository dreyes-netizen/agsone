# QA Audit Report — AGS One
**Date:** 2026-06-11 | **URL:** http://localhost:3000 | **Auditor:** Claude QA Audit

## Summary
- **Pages audited:** 24 (12 user-facing, 12 admin)
- **Issues found:** 5 (High: 2, Medium: 1, Low: 2)
- **Screenshots taken:** 24
- **Overall health:** App is largely stable. Most pages load correctly with proper empty states and data.

---

## Findings

### Finding 1: Recipient Column Always Shows "—" in Admin Award Points
**Severity:** High
**Page:** `/admin/points`
**Screenshot:** `qa-audit-screenshots/19-admin-points.png`

**Problem:** The Recent Transactions table shows "—" for every row in the Recipient column, making it impossible to tell who received points.

**Root Cause:** `app/api/points/history/route.ts:21-24` — the Prisma `include` block has `fromUser` and `createdBy` but is missing `toUser`. The frontend reads `t.toUser?.displayName` but the field is never returned by the server.

**Suggested Fix:**
```ts
include: {
  toUser:    { select: { displayName: true } },  // add this
  fromUser:  { select: { displayName: true, avatarUrl: true } },
  createdBy: { select: { displayName: true } },
},
```

---

### Finding 2: Admin Award Points History Shows Only Admin's Own Transactions
**Severity:** High
**Page:** `/admin/points`
**Screenshot:** `qa-audit-screenshots/19-admin-points.png`

**Problem:** Recent Transactions only shows the logged-in admin's own activity (streak bonuses, their own redemptions). An admin needs to see all employees' point activity.

**Root Cause:** `app/api/points/history/route.ts:10` — defaults `userId` to the current user when no param is passed. The admin page calls `/api/points/history` with no param, so it always scopes to the admin's own history.

**Suggested Fix:** When the caller is HR_ADMIN, return all transactions instead of scoping to their own:
```ts
const isAdmin = user.role === "HR_ADMIN" || user.role === "MANAGER";
const userId = searchParams.get("userId") ?? (isAdmin ? null : user.id);

const transactions = await prisma.pointTransaction.findMany({
  where: userId ? { toUserId: userId } : {},
  // ...
});
```

---

### Finding 3: Minigames Stats Leaderboard Stuck on "Loading…"
**Severity:** Medium
**Page:** `/minigames/stats`
**Screenshot:** `qa-audit-screenshots/08-minigames-stats.png`

**Problem:** The Leaderboard section shows "Loading…" while Recent Games and personal stats load correctly.

**Root Cause:** `app/(dashboard)/minigames/stats/page.tsx:93` — `.catch(() => {})` silently swallows errors without calling `setLoading(false)`, leaving the spinner stuck if the request fails.

**Suggested Fix:**
```ts
apiFetch<{ data: LeaderEntry[] }>(`/api/minigames/leaderboard?period=${period}`)
  .then(res => setBoard(res.data))
  .catch(() => setBoard([]))   // resolve to empty instead of leaving loading=true
  .finally(() => setLoading(false));
```

---

### Finding 4: Broken Image for "Loa Remedies" Medicine
**Severity:** Low
**Pages:** `/medicine`, `/admin/medicine`
**Screenshots:** `qa-audit-screenshots/09-medicine.png`, `qa-audit-screenshots/22-admin-medicine.png`

**Problem:** The "Loa Remedies" item shows a broken placeholder icon on both the user catalog and admin medicine pages.

**Root Cause:** The `imageUrl` stored for this medicine record points to an invalid or deleted Supabase storage URL.

**Suggested Fix:** Re-upload the image via Admin → Medicine → Edit on the Loa Remedies item.

---

### Finding 5: Admin Overview Engagement Shows 0%
**Severity:** Low
**Page:** `/admin`
**Screenshot:** `qa-audit-screenshots/13-admin.png`

**Problem:** Engagement widget shows "0%" and "0 of 152 active" even though the admin is actively logged in.

**Root Cause:** 1 active user out of 152 imported employees = ~0.65%, which rounds to 0%. Most employees were bulk-imported via sync and have never actually logged in, so their `lastActiveAt` is null.

**Suggested Fix:** Show one decimal place ("0.7%") or display the raw count: "1 active of 152". This is a display tweak, not a data bug.

---

## What's Working Well
- All 24 pages load without crashes or errors
- Navigation sidebar consistent across all user pages
- Ally chatbot button visible on all user-facing pages
- Both policy documents (COC + Handbook) uploaded and active
- Marketplace, Food Board, Medicine catalog render correctly
- Minigames lobby with 6 game types working
- Profile page complete with all data
- Admin: Rewards, Redemptions, Milestones, Departments all functional
- Empty states are clear and well-worded throughout
