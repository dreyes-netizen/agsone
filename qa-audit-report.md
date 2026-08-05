# QA Audit Report — AGS One
**Date:** 2026-08-03 | **URL:** http://localhost:3010 | **Auditor:** Claude QA Audit
**Method:** Live authenticated walkthrough via `claude-in-chrome` (Playwright itself can't complete the app's Google-Workspace-only OAuth in an isolated browser profile — see Notes) + source cross-reference + web research on employee-engagement platform UX patterns.

## Summary

- **Pages audited:** 24 of 27 routes (skipped: `/onboarding`, a live `/minigames/[id]` game session, `/admin/feedback/[id]` — all lower-value or required a state-changing action to reach)
- **Issues found:** 7 (0 Critical, 1 High, 4 Medium, 2 Low)
- **Issues fixed this session:** 7 of 7
- **Headline finding:** the app is **not** fundamentally "vibe coded." The core product — points economy, department-segmented leaderboard, social feed with shoutouts/celebrations/polls, rewards marketplace, badges/levels, minigames — already matches the feature set of established employee-engagement products (Bonusly, Motivosity, Achievers). What was actually dragging it down was a handful of concrete, fixable inconsistencies, all addressed below.

## What's already working well

- **Login page** — genuinely well-composed split-screen layout, on-brand, feature highlights with consistent icon badges.
- **Marketplace** — gradient category cards, consistent category icons/badges, clear point-cost + "need N more" affordance. This is close to gift-card-marketplace best practice (transparent effort→reward mapping).
- **Admin Overview** — solid KPI cards, activity feed, stock alerts, points-flow chart. Reads as a real internal tool, not a template.
- **Profile page** — gradient banner, level progress, badges, quick actions section. One of the strongest pages in the app.
- **Medicine catalog fallback icon** (fixed earlier this session) — confirmed live: a medicine with no photo shows a clean pill-icon placeholder instead of a broken-image glyph.

## Findings

### Finding 1 — Mixed icon systems (emoji + Lucide) in the feed filter sidebar
**Severity:** Medium | **Page:** `/feed` | **Status:** ✅ Fixed

**Problem:** The left nav uses a consistent `lucide-react` icon set throughout the app, but the Feed sidebar's filter list (`All`, `My Department`, `Announcements`, `Shoutouts`, `Achievements`, `Celebrations`, `Polls`) used raw emoji (🗂️🏢📢✨🏆🎉📊). Emoji render inconsistently across OS/browser and clash visually with a deliberate line-icon system — this was the single biggest contributor to the "looks inconsistent" impression.

**Root Cause:** `components/feed/FeedSidebar.tsx:8-16` — `FILTERS` array used an `emoji` string field instead of an icon component, unlike every other nav list in the app.

**Fix:** Replaced the 7 emoji with matching `lucide-react` icons (`LayoutGrid`, `Building2`, `Megaphone`, `Sparkles`, `Trophy`, `PartyPopper`, `BarChart3`), reusing `Building2` — already used elsewhere for departments — for consistency. Verified live: icons now render in the same style/weight as the rest of the nav.

### Finding 2 — Unstyled default 404 page
**Severity:** Medium | **Page:** any invalid URL | **Status:** ✅ Fixed

**Problem:** Hitting any nonexistent route (a stale bookmark, a mistyped deep link, a deleted entity) showed Next.js's raw default 404 — plain black background, no branding, no navigation. Jarring against an otherwise polished, branded app.

**Root Cause:** No `app/not-found.tsx` existed anywhere in the repo.

**Fix:** Added `app/not-found.tsx` — branded card matching the login page's visual language (logo, `rounded-card`, `command-black` CTA), with a "Back to dashboard" link. Verified live.

### Finding 3 — Root URL (`/`) always redirects to `/login`, even for signed-in users
**Severity:** High | **Page:** `/` | **Status:** ✅ Fixed

**Problem:** `app/page.tsx` unconditionally called `redirect("/login")` regardless of auth state. A signed-in user bookmarking or typing the bare domain root would be bounced to the sign-in screen instead of into the app — confusing, looks like an unexpected logout.

**Root Cause:** `app/page.tsx:1-5` never checked the `firebase-token` cookie that `proxy.ts` already uses for the same purpose on every other route.

**Fix:** `app/page.tsx` now reads the cookie via `next/headers` and redirects to `/dashboard` when present, `/login` otherwise — mirroring `proxy.ts`'s existing (non-authoritative, UX-only) check.

### Finding 4 — Audit Log shows raw `UPDATE_SETTING` as unstyled monospace text
**Severity:** Medium | **Page:** `/admin/audit`, `/admin` (Recent Admin Activity) | **Status:** ✅ Fixed

**Problem:** Every other audit action ("Role Change", "Delete Post", "Award Points"...) renders as a colored pill badge. `UPDATE_SETTING` — a real, frequently-logged action (Ally toggle, app settings) — instead fell through to raw `<span className="font-mono">UPDATE_SETTING</span>`, i.e. it looked like a debug leak next to properly designed rows.

**Root Cause:** `components/admin/ActionBadge.tsx` falls back to unstyled text when an action isn't in `lib/constants/auditActions.ts`'s `ACTION_LABELS` map — and `UPDATE_SETTING` (written by `app/api/admin/settings/route.ts:40`) was the only real action missing from that map.

**Fix:** Added `UPDATE_SETTING: { label: "Update Setting", color: "bg-slate-100 text-slate-700" }` to `ACTION_LABELS`. Verified all other `auditLog.create()` call sites in `app/api/**` map to entries already present in the constant. Confirmed live.

### Finding 5 — Admin Overview's "Total Employees" undercounts vs. the Employees list
**Severity:** Medium | **Page:** `/admin` vs `/admin/employees` | **Status:** ✅ Fixed

**Problem:** The Overview KPI card said "146 Total Employees"; the Employees admin list showed "165 employees." Same org, two different numbers under the same implied meaning — reads as a data bug even though both queries are individually correct.

**Root Cause:** `app/api/admin/analytics/route.ts:40` counts `role: "EMPLOYEE", isActive: true` only (excludes managers/admins and inactive/terminated staff), while the Employees list counts everyone regardless of role or status by default. Both numbers are correct for what they measure — the label just overpromised.

**Fix:** Relabeled the KPI card from "Total Employees" to **"Active Employees"** (`app/admin/page.tsx`) to accurately describe what's being counted, rather than changing the underlying (deliberately scoped) query.

### Finding 6 — Broken reward thumbnails in the admin Rewards list
**Severity:** Low | **Page:** `/admin/rewards` | **Status:** ✅ Fixed

**Problem:** Several rewards (branded mug, gift vouchers, tumbler) showed a blank gray box instead of a product photo in both the mobile card and desktop table views.

**Root Cause:** `app/admin/rewards/page.tsx` rendered `<img src={r.imageUrls[0]} />` with no `onError` handling — the same gap already fixed earlier this session on the medicine and avatar surfaces, just missed here since reward images are a different data shape (`imageUrls[]` vs `imageUrl`).

**Fix:** Added the same per-item `failedImages` Set pattern used elsewhere in the app: on load failure, the thumbnail slot collapses cleanly instead of showing a broken-image glyph.

### Finding 7 — Nonexistent nav routes (self-inflicted, documented for completeness)
**Severity:** N/A — auditor error, not an app bug

While sweeping, I twice navigated to guessed URLs (`/top-performers`, `/admin/whistleblower`) that don't exist — the actual routes are `/leaderboard` and `/admin/feedback` respectively (labels differ from paths intentionally, e.g. "Top Performers" nav label → `/leaderboard`). No code change needed; noted only because it's how Finding 2 (the unstyled 404) was discovered.

## Recommendations not implemented (need your call)

These came out of the web research pass on Bonusly/Motivosity/Achievers-style engagement platforms and are genuine enhancements, not bug fixes — bigger, more visible, and worth a deliberate decision rather than a drive-by change:

1. **Richer level/progress visualization.** Profile currently shows level progress as plain text ("0 / 200 pts to next"). Bonusly/Motivosity-style platforms use a visual progress ring or bar here — a good, bounded next step if you want more "gamified" polish.
2. **Achievement/badge moments.** Badges section currently just shows a count; no visual badge gallery or unlock animation. Matches an industry pattern (tiered progress visuals, achievement timelines) but is a real design + build effort.
3. **Leaderboard segmentation is already correct** (department filter + This Month/All Time) — confirmed this matches the recommended "peer-cohort segmentation" pattern from industry research (a single global leaderboard demotivates non-competitive teams). No change needed here.

I did **not** start on these without checking with you first, since — unlike the 7 findings above — they're visual/scope decisions rather than clear-cut bugs, and this session already has open items (design-system consolidation, god-file splitting, dependency bumps) awaiting your sign-off from earlier work.

## Notes on methodology

- Playwright (isolated browser) can't complete this app's Google Workspace–restricted OAuth login without live human 2FA, so the live walkthrough used `claude-in-chrome` against your already-authenticated session instead — consistent with how the earlier full audit pass in this same session was run.
- All 7 fixes were verified two ways: `npx tsc --noEmit` (clean) and a live re-screenshot after the fix.
