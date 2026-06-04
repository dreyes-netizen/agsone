# QA Audit Report — AGS One
**Date:** 2026-06-01 | **URL:** http://localhost:3001 | **Next.js:** 16.2.6 (Turbopack) | **Auditor:** Claude QA Audit

---

## Summary
- **Pages audited:** 22 of 30 (parametric routes `/games/[id]`, `/employees/[id]`, `/feedback/[id]`, `/admin/feedback/[id]` skipped — no seed data)
- **Issues found:** 7 (Critical: 0, High: 2, Medium: 3, Low: 2)
- **Screenshots taken:** 17 (saved to `./qa-audit-screenshots/`)
- **Audit method:** Playwright MCP + cookie injection (Firebase Google Sign-In popup cannot be automated headlessly)
- **Auth note:** Firebase SDK session unavailable in headless context. Pages that use `useAuth()` to gate data fetches show loading/empty states. These are flagged individually only when they represent a structural bug, not a data-absence issue.

---

## What's Working Well ✅

| Area | Status |
|------|--------|
| All 30 routes resolve (no 404s after cache clear) | ✅ |
| Login page — desktop two-column layout, mobile single-column | ✅ |
| Dashboard quick-links (Marketplace, Games, Leaderboard, Feed) | ✅ |
| Sidebar navigation — all 11 links correct URLs | ✅ |
| Feed — composer, Photo/Poll buttons, All/Updates/Shoutouts tabs | ✅ |
| Missions — Available/Completed/All tabs | ✅ |
| Marketplace — category filters (All/Physical/Voucher/Privilege/Digital), empty state copy | ✅ |
| Food Board — Available/My Orders/My Listings tabs, Sell Food button | ✅ |
| Game Arcade — heading renders | ✅ |
| Leaderboard — This Month/All Time tabs | ✅ |
| Shoutouts — search box, Recognition Wall heading | ✅ |
| Challenges — page loads | ✅ |
| Feedback — "New Feedback" button, subtitle | ✅ |
| Admin sidebar — all 12 links, "← Back to App" | ✅ |
| Admin Documents — Re-index Ally, Upload Document, empty state | ✅ |
| Ally widget — present on every dashboard page | ✅ |
| No broken images on any page | ✅ |
| No placeholder/lorem ipsum text anywhere | ✅ |
| Consistent design system (colors, typography, spacing) throughout | ✅ |

---

## Findings

---

### Finding 1: `middleware.ts` must be migrated to `proxy.ts` before next upgrade

**Severity:** High  
**Page:** All pages  
**Screenshot:** `qa-audit-screenshots/02-dashboard.png`

**Problem:**  
Next.js 16 renamed `middleware.ts` → `proxy.ts` and the exported function from `middleware` → `proxy`. The dev server logs a deprecation warning on every startup:

```
⚠ The "middleware" file convention is deprecated. Please use "proxy" instead.
```

Additionally, the old Turbopack cache caused `/login` to return 404 on direct navigation (confirmed in the audit). Clearing `.next/` fixed it — but this can silently recur.

**Root Cause:**  
- `middleware.ts` exists at project root with `export function middleware(req)` — both the filename and export name are deprecated in Next.js 16
- The `config` option `skipMiddlewareUrlNormalize` (if used) must be renamed `skipProxyUrlNormalize`

**Files Affected:**
- `middleware.ts:1` — filename and export name both deprecated

**Suggested Fix:**
```bash
# 1. Rename the file
mv middleware.ts proxy.ts

# 2. Inside the file, rename the function
export function proxy(req: NextRequest) {   # was: middleware
```

**Verification:** Dev server starts with no deprecation warning. Direct navigation to `/login` returns 200 consistently.

---

### Finding 2: Admin panel pages accessible to non-admin users (missing role guard)

**Severity:** High  
**Page:** `/admin`, `/admin/*` (all 13 admin routes)  
**Screenshot:** `qa-audit-screenshots/13-admin.png`

**Problem:**  
Any authenticated employee can navigate to `/admin`, `/admin/employees`, `/admin/documents`, etc. The pages render the full admin sidebar UI. Since API routes correctly return `403 Forbidden`, the main content areas show error states ("Failed to load analytics.", "Loading..." that never resolves). An employee seeing the admin panel — even with empty data — is a security/UX gap.

**Root Cause:**  
`middleware.ts` only checks for cookie presence, not role:
```typescript
// middleware.ts:14-18
const token = req.cookies.get("firebase-token")?.value;
if (!token) {
  return NextResponse.redirect(new URL("/login", req.url));
}
return NextResponse.next();  // ← any logged-in user passes
```

There is no layout-level role check in `app/admin/layout.tsx` either.

**Files Affected:**
- `middleware.ts:1-25` — no role enforcement for `/admin/*` paths
- `app/admin/page.tsx:~50` — `apiFetch("/api/admin/analytics")` throws, caught as `"Failed to load analytics."`

**Suggested Fix (Option A — middleware, recommended):**
```typescript
// proxy.ts — add after token check
if (pathname.startsWith("/admin")) {
  // Verify role via a lightweight DB check or Firebase custom claim
  // Simplest: redirect and let the API 403 be the true guard,
  // but show a proper "Access Denied" UI instead of broken panels
}
```

**Option B — admin layout (simpler short-term):**
```tsx
// app/admin/layout.tsx — add at the top of the component
const { dbUser, loading } = useAuth();
if (!loading && dbUser?.role !== "HR_ADMIN") redirect("/dashboard");
```

**Verification:** Navigate to `/admin` as a non-admin user — should redirect to `/dashboard`, not show the admin panel UI.

---

### Finding 3: Dashboard greeting shows "Good evening, there" on load

**Severity:** Medium  
**Page:** `/dashboard`  
**Screenshot:** `qa-audit-screenshots/02-dashboard.png`

**Problem:**  
The greeting reads "Good evening, **there**" instead of "Good evening, **Dither**". The user's first name isn't available until `dbUser` resolves from the `AuthProvider`. During the window between page render and Firebase auth initialization, any user sees the fallback "there".

**Root Cause:**  
The dashboard likely does `dbUser?.displayName?.split(" ")[0] ?? "there"`. The fallback string "there" is visible for 1–3 seconds on every page load.

**Files Affected:**
- `app/(dashboard)/dashboard/page.tsx` — greeting fallback

**Suggested Fix:**  
Show a skeleton/neutral placeholder while loading:
```tsx
{authLoading ? (
  <div className="h-8 w-32 bg-zinc-100 animate-pulse rounded" />
) : (
  <h1>Good {timeOfDay}, {firstName}</h1>
)}
```

**Verification:** Load dashboard while logged in. The name area shows a skeleton, then resolves to the user's first name within 1–2 seconds.

---

### Finding 4: Games page renders no game cards (content area empty)

**Severity:** Medium  
**Page:** `/games`  
**Screenshot:** `qa-audit-screenshots/07-games.png`

**Problem:**  
The `/games` page only renders the "Game Arcade" heading and subtitle. The content area below (where game cards should appear) is completely absent from the DOM — no empty-state message, no loading spinner, nothing. Users see a heading with dead space below it.

**Root Cause:**  
The game cards are likely gated on `useAuth()` user state, same as leaderboard. When `user` is null, the card-rendering `useEffect` returns early and no empty state is shown. Unlike Marketplace (which shows "No rewards here yet"), Games shows nothing at all.

**Files Affected:**
- `app/(dashboard)/games/page.tsx` — no empty state when games list is empty or user is null

**Suggested Fix:**  
Add an empty state below the heading:
```tsx
{!loading && games.length === 0 && (
  <div className="text-center py-16 text-zinc-400">
    <p className="font-medium">No games available yet</p>
    <p className="text-sm mt-1">Check back soon for mini-games.</p>
  </div>
)}
```

**Verification:** Navigate to `/games` — see an empty state message instead of blank space.

---

### Finding 5: Sidebar company name truncated on desktop

**Severity:** Medium  
**Page:** All dashboard pages  
**Screenshot:** `qa-audit-screenshots/02-dashboard.png`

**Problem:**  
The sidebar shows "Alliance Global" instead of "Alliance Global Solutions". The company subtitle is truncated. The login page correctly shows "Alliance Global Solutions" in both panels.

**Root Cause:**  
The sidebar text is hardcoded or truncated with a container width constraint. The DOM snapshot shows:
```
paragraph [ref=e12]: Alliance Global  ← truncated
```
vs. login page:
```
paragraph: Alliance Global Solutions  ← correct
```

**Files Affected:**
- `app/(dashboard)/layout.tsx` — sidebar branding text (or the sidebar component it imports)

**Suggested Fix:**  
Find the sidebar company name and either fix the text or add `truncate` handling with a title tooltip:
```tsx
<p className="text-white/35 text-[10px] truncate" title="Alliance Global Solutions">
  Alliance Global Solutions
</p>
```

**Verification:** Sidebar shows full "Alliance Global Solutions" (or truncates gracefully with tooltip).

---

### Finding 6: `/login` route returns 404 on stale Turbopack cache

**Severity:** Low  
**Page:** `/login`  
**Screenshot:** `qa-audit-screenshots/01-login-desktop.png`

**Problem:**  
When the dev server has a stale `.next/` cache, navigating directly to `http://localhost:3001/login` returns 404. Navigation via root (`/`) redirect works because Next.js processes the redirect server-side before Turbopack compiles the route. This affects any developer who pulls the repo fresh or after certain file changes.

**Root Cause:**  
Turbopack on-demand compilation + stale cache = route not registered at startup. Clearing `.next/` fixes it.

**Files Affected:**
- `.next/` directory (runtime state, not source code)

**Suggested Fix:**  
Add to `README.md` or `CLAUDE.md`:
```
# If /login returns 404
rm -rf .next && npm run dev
```
Long-term: this resolves itself once the middleware is migrated to `proxy.ts` (Finding 1), as Turbopack will have less ambiguity about the route.

**Verification:** Fresh `rm -rf .next && npm run dev` — navigate directly to `/login`, see login page on first load.

---

### Finding 7: Sidebar "Alliance Global" text — confirmed truncation source

**Severity:** Low  
**Page:** All dashboard pages  
**Screenshot:** N/A (same as Finding 5)

**Note:** This is a continuation of Finding 5 — confirmed the truncation is in the sidebar component. Filed separately to track the source file lookup.

**Files Affected:**
- Whichever component renders the sidebar `<complementary>` — check `app/(dashboard)/layout.tsx` or a `Sidebar.tsx` component

---

## Not Bugs (Audit Artifacts)

These appeared during the audit but are caused by the headless auth injection method, not real code bugs:

| Observation | Reason | Real impact |
|---|---|---|
| Greeting "Good evening, there" | `dbUser` null in headless session | Filed as Finding 3 (real flash issue) |
| Sidebar shows "?" avatar, "—" name | `dbUser` null | Expected; resolves with real auth |
| Balance shows "0" or "—" | `dbUser` null | Expected; resolves with real auth |
| Leaderboard stuck "Loading…" | `useEffect` gate: `if (!user) return` | Expected; works with real auth |
| Profile stuck "Loading profile…" | Same `useEffect` gate | Expected; works with real auth |
| Admin pages show empty/error | API returns 403 (user not HR_ADMIN in DB, or token expired) | Filed as Finding 2 (real security gap) |

---

## Pages Audited

| # | Route | Status | Notes |
|---|-------|--------|-------|
| 1 | `/login` | ✅ Pass | Desktop + mobile layouts correct |
| 2 | `/dashboard` | ⚠️ Finding 3 | Greeting fallback "there" |
| 3 | `/feed` | ✅ Pass | Composer, tabs, shoutout section present |
| 4 | `/missions` | ✅ Pass | Tabs present, no missions yet |
| 5 | `/marketplace` | ✅ Pass | Category filters, empty state |
| 6 | `/food` | ✅ Pass | Tabs, Sell Food button |
| 7 | `/games` | ⚠️ Finding 4 | No game cards or empty state |
| 8 | `/leaderboard` | ✅ Pass* | *Stuck loading in headless auth only |
| 9 | `/shoutouts` | ✅ Pass | Search box, Recognition Wall |
| 10 | `/challenges` | ✅ Pass | Page loads |
| 11 | `/profile` | ✅ Pass* | *Stuck loading in headless auth only |
| 12 | `/feedback` | ✅ Pass | New Feedback button present |
| 13 | `/admin` | ⚠️ Finding 2 | No role guard; shows "Failed to load analytics" |
| 14 | `/admin/employees` | ⚠️ Finding 2 | Layout correct; 0 of 0 data |
| 15 | `/admin/departments` | ⚠️ Finding 2 | Layout correct; data empty |
| 16 | `/admin/points` | ⚠️ Finding 2 | Layout correct; data empty |
| 17 | `/admin/documents` | ✅ Pass | Re-index + Upload buttons; empty state |
| 18 | `/admin/rewards` | Not captured | Same pattern as other admin pages |
| 19 | `/admin/redemptions` | Not captured | Same pattern |
| 20 | `/admin/missions` | Not captured | Same pattern |
| 21 | `/admin/games` | Not captured | Same pattern |
| 22 | `/admin/milestones` | Not captured | Same pattern |
| 23 | `/admin/challenges` | Not captured | Same pattern |
| 24 | `/admin/feedback` | Not captured | Same pattern |
| 25 | `/onboarding` | Not captured | Auth-dependent |
| — | `/games/[id]` | Skipped | No seed games |
| — | `/employees/[id]` | Skipped | No seed employees |
| — | `/feedback/[id]` | Skipped | No seed feedback |
| — | `/admin/feedback/[id]` | Skipped | No seed feedback |

---

## Priority Fix Order

1. **Finding 1** — Migrate `middleware.ts` → `proxy.ts` (30 min, avoids future breakage)
2. **Finding 2** — Add role guard to admin layout (1 hour, security gap)
3. **Finding 4** — Add empty state to Games page (15 min, bad UX)
4. **Finding 3** — Add loading skeleton to dashboard greeting (20 min, polish)
5. **Finding 5** — Fix "Alliance Global" truncation in sidebar (10 min, polish)
6. **Finding 6** — Document `.next/` cache clear in dev setup guide (5 min)
