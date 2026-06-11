# Code Audit Report — AGS One
**Date:** 2026-06-11 | **Auditor:** Claude Code Audit (8 parallel passes)

## Scorecard

| Dimension | Issues Found | Critical | High | Medium | Low |
|-----------|-------------|----------|------|--------|-----|
| Security | 26 | 5 | 9 | 8 | 4 |
| Architecture | 28 | 0 | 9 | 13 | 6 |
| Code Quality | 33 | 0 | 10 | 12 | 11 |
| Accessibility | 46 | 0 | 19 | 17 | 10 |
| Performance | 19 | 0 | 6 | 8 | 5 |
| Components | 25 | 0 | 9 | 10 | 6 |
| UX Design | 36 | 0 | 8 | 14 | 9 |
| Structure | 26 | 0 | 9 | 11 | 6 |
| **TOTAL** | **239** | **5** | **79** | **93** | **57** |

---

## 🚨 Stop-The-Line Issues (Fix Before Next Deploy)

### S1: Bootstrap Route — Privilege Escalation
**File:** `app/api/admin/bootstrap/route.ts`
Any logged-in user can become HR_ADMIN if no admin currently exists. If the last admin is ever removed from the DB, the attack surface reopens permanently.
**Fix:** Delete this route after initial setup. Or gate it: `if (req.headers.get('x-bootstrap-secret') !== process.env.BOOTSTRAP_SECRET) return 401`.

### S2: IDOR on Food Order Payment
**File:** `app/api/food/[id]/orders/[orderId]/route.ts:24`
A food listing owner can mark orders from OTHER listings as paid by supplying any `orderId`. The update has no `listingId` scope.
**Fix:** `prisma.foodOrder.update({ where: { id: orderId, listingId: id }, ... })` — if no row matches, return 404.

### S3: Stock Oversell Race Condition
**File:** `app/api/redemptions/route.ts:49`
Two simultaneous redemptions of the last item both pass the out-of-stock check because it runs outside the transaction.
**Fix:** Move the stock check inside the transaction using conditional `updateMany({ where: { id, stockQuantity: { gt: 0 } } })` and check affected row count.

### S4: Firebase Token Stored in JS-Readable Cookie
**File:** `lib/auth/AuthProvider.tsx:48`
`document.cookie = 'firebase-token=...'` — any XSS on the page yields full session hijacking. Should be HttpOnly.
**Fix:** Set the cookie server-side from `/api/auth/sync` response with `Set-Cookie: ...; HttpOnly; Secure; SameSite=Strict`.

### S5: `proxy.ts` — Dead Security Middleware
**File:** `proxy.ts` (project root)
This file exports a cookie-based auth guard but is named `proxy.ts` — Next.js only runs `middleware.ts`. This entire auth guard silently does nothing. Unauthenticated requests are not blocked at the edge.
**Fix:** Rename to `middleware.ts` and rename the export to `middleware`, or delete if client-side auth is sufficient.

---

## 🔴 High Priority (This Sprint)

### H1: In-Memory Rate Limiter Bypassed in Serverless
**File:** `lib/guardrails/rateLimiter.ts`
The 20/hour AI chat limit resets on every serverless cold start. On Vercel each request can hit a fresh Map. Trivially bypassed.
**Fix:** Replace with Redis/Upstash-backed rate limiter or a Supabase table counter.

### H2: Stale Balance Used for Level-Up & Email
**Files:** `app/api/points/award/route.ts:57`, `app/api/points/award/bulk/route.ts:93`
`newBalance = recipient.pointsBalance + amount` is calculated before the transaction commits. Under concurrent awards the level-up check and email show wrong numbers.
**Fix:** Return the updated balance from inside the transaction: `tx.user.update({ ..., select: { pointsBalance: true } })`.

### H3: Game Wager Double-Join Race Condition
**File:** `app/api/minigames/sessions/[id]/join/route.ts:24`
Two players can simultaneously join the same session. Both pass the balance check before either deduction commits, causing one player to lose points silently.
**Fix:** Use conditional `updateMany({ where: { id, status: 'WAITING', guestId: null } })` — check affected count; return 409 if 0.

### H4: Employee Sync Can Re-Activate Deactivated Admins
**File:** `app/api/admin/employees/sync/route.ts:218`
The `reactivateResult` `updateMany` has no role filter — any deactivated MANAGER or HR_ADMIN whose ID is in the Excel file gets re-activated silently.
**Fix:** Add `role: 'EMPLOYEE'` to the reactivate `where` clause.

### H5: `toggleReaction` / `deleteComment` — No Error Handling or Rollback
**File:** `app/(dashboard)/feed/page.tsx:811, 589`
Optimistic updates are applied before API calls with no try/catch. On failure the UI permanently shows wrong data until reload.
**Fix:** Wrap both in try/catch, save previous state, restore on error.

### H6: `checkAndAwardBadges` — 11 DB Upserts Per Points Award
**File:** `lib/helpers/checkAndAwardBadges.ts:31`
Runs 11 sequential `prisma.badge.upsert` calls on EVERY points award. With bulk award to 200 users = 2,200 sequential DB writes.
**Fix:** Seed badge definitions once at migration time. Remove upserts from the hot path entirely.

### H7: `proxy.ts` Dead Middleware (see S5 above)

### H8: Google OAuth `hd: "*"` Wildcard — No Domain Restriction
**File:** `lib/firebase/client.ts:19`
Comment says "restrict to company accounts" but `hd: "*"` does the opposite — it's a UI hint only with zero enforcement.
**Fix:** `googleProvider.setCustomParameters({ hd: 'allianceglobalsolutions.com' })`.

### H9: 19 Accessibility WCAG-A Violations
Key issues: all modal dialogs missing `role="dialog"` + focus trap, icon-only buttons without `aria-label` (Sign out, Send, Notification bell, Ally close/send), form inputs without label association (Feedback composer, Feed composer).
**Files:** `app/(dashboard)/marketplace/page.tsx:474`, `app/(dashboard)/food/page.tsx:982`, `components/AllyWidget.tsx:211,266`, `components/notifications/NotificationBell.tsx:99`, `app/(dashboard)/feedback/page.tsx:318`.

### H10: All `<img>` Tags — Not Using `next/image`
**Scope:** 30+ files across the entire app
Raw `<img>` tags throughout — no lazy loading, no WebP conversion, no CLS prevention. This is the largest single LCP/performance issue.
**Fix:** Migrate to `next/image`. Add `remotePatterns` to `next.config.ts` first (Cloudinary, Firebase Storage, Google photos).

---

## 🟡 Medium Priority (Next Sprint)

### M1: Missing Database Indexes
**File:** `prisma/schema.prisma`
`PointTransaction.toUserId`, `PointTransaction.createdAt`, `Notification.userId`, `SocialComment.postId`, `GameSession.status+hostId`, `FeedbackReply.feedbackId` — all missing `@@index`. Will cause table scans as data grows.
**Fix:** Add `@@index` directives and run `prisma migrate dev`.

### M2: `feed/page.tsx` — 1,735 Lines, 41 State Variables
**File:** `app/(dashboard)/feed/page.tsx`
Extreme god component. Extract: `<PostComposer>`, `<FeedPost>`, `<CommentsPanel>`, `ReactionBar` into separate files.

### M3: `minigames/[id]/page.tsx` — 1,449 Lines, 11 Embedded Components
**File:** `app/(dashboard)/minigames/[id]/page.tsx`
Every game board is inlined. Extract each board to `components/minigames/boards/TTTBoard.tsx`, `C4Board.tsx`, etc.

### M4: 7 Duplicate `Avatar` Components
**Files:** `app/(dashboard)/dashboard/page.tsx`, `feed/page.tsx`, `leaderboard/page.tsx`, `minigames/stats/page.tsx`, `minigames/[id]/page.tsx`, `components/CommandPalette.tsx`, `components/dashboard/DashboardFeedCard.tsx`
Each has slightly different props and fallback styles — already diverged.
**Fix:** Create `components/UserAvatar.tsx`, delete all 7 local definitions.

### M5: `ReactionBar` + `EMOJIS` Constants Duplicated
**Files:** `app/(dashboard)/feed/page.tsx` and `components/dashboard/DashboardFeedCard.tsx`
Both define `EMOJIS`, `EMOJI_BG`, and `ReactionBar` — they have already visibly diverged in behaviour.
**Fix:** Create `lib/constants/reactions.ts` and `components/feed/ReactionBar.tsx`.

### M6: N+1 Queries — Challenges Route
**File:** `app/api/challenges/route.ts:63-90`
`C challenges × D departments` database queries per request. With 5 challenges + 10 departments = 50 queries.
**Fix:** Replace with a single `groupBy` query per challenge.

### M7: `alert()` / `confirm()` Used for User Feedback
**Files:** `app/(dashboard)/feedback/page.tsx:164`, `missions/page.tsx:44`, `feed/page.tsx:574`, `admin/rewards/page.tsx:139`
Browser-native `alert()` and `confirm()` are inconsistent with the app's design system and blocked on some mobile browsers.
**Fix:** Replace with inline error states and custom confirmation patterns.

### M8: `loadMore()` URL Construction Bug
**File:** `app/(dashboard)/feed/page.tsx:344`
DEPT_ONLY cursor creates double-query: `/api/feed?dept=mine?cursor=xxx` (two `?`).
**Fix:** Use `URLSearchParams` consistently.

### M9: Blob URLs Never Revoked — Memory Leak
**File:** `app/(dashboard)/feed/page.tsx:360`, `app/admin/medicine/page.tsx:315`
`URL.createObjectURL()` called but `revokeObjectURL()` never called on cleanup.
**Fix:** Call `URL.revokeObjectURL(url)` before clearing state arrays.

### M10: Cron Secret Fails Open If Env Var Missing
**Files:** `app/api/cron/birthdays/route.ts:54`, `app/api/cron/milestones/route.ts:12`
If `CRON_SECRET` is unset, header comparison becomes `authHeader !== 'Bearer undefined'` — any request with that literal string passes.
**Fix:** Add guard: `if (!process.env.CRON_SECRET) return 500` before the comparison.

### M11: Employee Emails Exposed to All Authenticated Users
**Files:** `app/api/employees/[id]/route.ts:11`, `app/api/search/route.ts:22`
Any employee can enumerate all other employees' email addresses, birthdays, and roles via the search and profile endpoints.
**Fix:** Strip `email` and `birthday` from responses for `EMPLOYEE` role callers.

### M12: `#111827` Hard-Coded in 88 Places
**Scope:** Project-wide
Brand colour as raw hex literal throughout. Any rebrand requires mass find-and-replace.
**Fix:** Add `--color-brand` CSS variable to `globals.css @theme` block.

---

## 🟢 Low Priority (Backlog)

- `lib/rag/embedder.ts` — empty stub file, delete it
- `lib/helpers/weightedRandom.ts` — never imported anywhere, delete it
- `timeAgo()` re-declared locally in 2 files, import from `lib/helpers/timeAgo.ts`
- Missing `server-only` import in `lib/supabase/storageClient.ts`, `lib/rag/search.ts`
- Leaderboard list entries not clickable (inconsistent with dashboard widget)
- Dashboard Top Performers rows not clickable (inconsistent with leaderboard)
- Missing role constants — `"HR_ADMIN"` string literal in 79 places
- Notification bell poll (60s) redundant alongside Realtime subscription
- Admin missions page uses shadcn/ui while all other admin pages use raw Tailwind

---

## Already Fixed (From Earlier QA Audit)
- ✅ Recipient column shows "—" in Award Points
- ✅ Admin sees only own transactions in history
- ✅ Minigames leaderboard stuck on Loading
- ✅ Broken image for "Loa Remedies"
- ✅ Engagement shows 0%

---

## Recommended Fix Order

1. **S1–S5** — Security issues, fix before any deploy
2. **H8** — 1-line fix, low risk
3. **H10** — next/image migration (add remotePatterns first)
4. **M1** — DB indexes, zero code risk, immediate speed improvement
5. **H6** — Remove badge upserts from hot path
6. **H2** — Fix stale balance in award routes
7. **H5** — Add error handling + rollback to toggleReaction/deleteComment
8. **M9** — Blob URL cleanup
9. **M7** — Replace alert()/confirm() with inline UI
10. **H9** — Accessibility pass (WCAG-A violations first)
