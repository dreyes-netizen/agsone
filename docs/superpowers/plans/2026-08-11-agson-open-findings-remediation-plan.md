# AGS One — Open Audit Findings Remediation Plan

Source: all 36 open work items in the AGSON project (agshub) as of 2026-08-11 — 5 Critical,
29 High, 1 Medium, 1 low-priority cleanup, 1 test-infra item. Every fix below is taken directly
from the ticket's own `Fix:` recommendation; file:line references are as filed, not re-derived.

**Correction note:** due dates on these tickets were set assuming "today" was 2026-08-08; actual
today is 2026-08-11 (Tuesday). AGSON-41, 42, 48, 72 (due 8/10) are already overdue; 43/45 (due
8/11) are due today. Recommend re-running the due-date pass with the correct anchor date before
treating the calendar as authoritative — this plan's phase order is independent of that and can
be worked regardless.

## Sequencing principle

Phases are ordered by **implementation dependency and risk**, not by the ticket due-date
calendar (which was sequenced for one assignee's serial capacity, not for logical batching).
Where a phase's items share a root cause or a file, they're grouped into one PR — splitting them
would mean two people re-deriving the same guard logic or touching the same lines twice.

---

## Phase 0 — Verify before building (near-zero effort, unblocks the rest)

Two tickets may already be resolved or need rescoping before anyone writes new code:

- **AGSON-48** (hand-rolled modal/toast → Dialog/AlertDialog/sonner) — commit `94780c8`
  ("refactor: consolidate toast + modal implementations onto shadcn primitives") is already on
  `main`. Diff the ticket's file list (feed, food, admin/feedback, admin/departments,
  admin/rewards, admin/medicine, admin/documents) against what that commit actually touched;
  close what's covered, re-file what isn't as a smaller follow-up.
- **AGSON-72** (xlsx CVE on 2 admin upload routes) — this is a genuinely separate, still-open
  finding from the already-Done AGSON-36; don't skip it as a duplicate. Confirm the two routes
  (`employees/sync`, `attendance/award`) are still on `xlsx@0.18.5` before scoping the exceljs
  migration in Phase 3.
- **AGSON-74** (ponytail cleanup: drop `@tanstack/react-query`, `@tanstack/react-query-devtools`,
  `framer-motion`; hardcode `sonner`'s theme instead of `next-themes`; delete the dead re-export in
  `checkLevelUp.ts`) — trivial, zero-risk, do it as a warm-up PR whenever convenient.

## Phase 1 — Critical launch blockers (5 items, one PR each — isolated, don't batch)

| Ticket | Fix | File(s) |
|---|---|---|
| AGSON-41 | Restore `Geist`/`Geist_Mono` from `next/font/google`, remove `Inter` | `app/layout.tsx:2,7-11` |
| AGSON-42 | Stock guard must treat `-1` as unlimited: `OR: [{stockQuantity:-1},{stockQuantity:{gt:0}}]`, skip decrement when `-1` | `app/api/redemptions/route.ts:92-98` |
| AGSON-43 | Change `addOnSchema.price` from `.positive()` to `.min(0)` to match listing schemas | `app/api/food/[id]/order/route.ts:6` |
| AGSON-45 | Add `budget.remaining === 0` guard to Single + Bulk Award submit buttons (mirror `employees/[id]/page.tsx:481`) | `app/admin/points/page.tsx:~622-626,~745-748` |
| AGSON-44 | Add `maskMemoryState(state, viewerIsHost)` in `lib/minigames/memory.ts`, call from both the session GET and move routes, mirroring the RPS/Battleship mask pattern | `lib/minigames/memory.ts`, `app/api/minigames/sessions/[id]/route.ts:34-43`, `.../move/route.ts:203-209` |

AGSON-44 is the heaviest of the five (new masking function + two call sites) — give it its own
day/PR rather than bundling with the other four, which are single-guard or single-line fixes.

## Phase 2 — Privilege-escalation family (4 items, ONE PR — same root cause, same two routes)

All four trace to the same bug shape: a guard that checks the role being *assigned* but never the
target's *current* role, plus no self-action/last-admin protection.

- **AGSON-56**: `app/api/admin/users/[id]/role/route.ts:27-31` — reject when target's current role
  is `HR_ADMIN`/`SUPER_ADMIN` and caller isn't `SUPER_ADMIN`. Fetch target's existing role first,
  or use `updateMany({ where: { id, role: { notIn: elevatedRoles } } })` for non-`SUPER_ADMIN` callers.
- **AGSON-57**: identical gap in `app/api/admin/employees/[id]/route.ts:37-51`, plus unrestricted
  `isActive`/`email` changes on the same target — same fix, same route family.
- **AGSON-59**: exclude the acting admin's own id from the editable role dropdown
  (`app/admin/employees/page.tsx:126-144`); server-side, reject a role change that would leave zero
  `HR_ADMIN`/`SUPER_ADMIN` users.
- **AGSON-50**: `app/admin/employees/page.tsx:790-800` Edit Employee dialog's Role `<select>`
  unconditionally offers `SUPER_ADMIN` — wrap in `{isSuperAdmin && ...}` matching the other 3
  selectors on the page. Its own ticket explicitly says to cross-check the server guard — which is
  AGSON-56 — so this is the client-side half of the same PR, not a separate one.

Do this phase early despite its later due date (8/13-8/18 in the current calendar) — it's an
active privilege-escalation hole, not a polish item.

## Phase 3 — Dependency / CVE remediation (3 items — 2 quick bumps + 1 migration)

- **AGSON-58**: `npm install next@16.3.0` — clears the Turbopack proxy-bypass + Server Actions
  DoS/SSRF CVEs. Re-verify `proxy.ts` behavior post-upgrade specifically (the advisory names
  Turbopack middleware bypass, and `proxy.ts` is this app's UX auth gate).
- **AGSON-73**: `npm install nodemailer@9.0.5` (semver-major — check the changelog). Not currently
  exploitable (`lib/email/mailer.ts:50` never passes the vulnerable `raw` option), so lower urgency
  than 58, but do it in the same dependency-hygiene pass.
- **AGSON-72**: migrate `app/api/admin/employees/sync/route.ts:82-89` and
  `app/api/admin/attendance/award/route.ts:45-59` off `xlsx` onto `exceljs` (2 call sites — no
  patched `xlsx` version exists). This is a real migration, not a bump — give it its own PR and
  test pass (re-verify the employee-sync and attendance-award upload flows end to end), don't
  bundle with the two one-line version bumps above.

## Phase 4 — Reliability bug sweep (5 independent items, batchable into one PR except AGSON-64)

- **AGSON-60**: reject medicine request POST if a `PENDING` request already exists for user+item
  (mirror food orders' 409 pattern); wire the already-fetched `pendingMedicineIds` into
  `medicine/page.tsx`'s button-disable logic.
- **AGSON-61**: add `selectedAddOns: true` to the `orders.select` clause in `app/api/food/route.ts`
  GET — one-line fix, but flag as high-impact (currently silently deletes paid-for add-ons on
  post-reload edit).
- **AGSON-62**: `app/(dashboard)/profile/page.tsx:268-286` — track failure explicitly
  (`setLoadError`) instead of a no-op `.catch()`; render an error+retry state when
  `loading === false && profile === null`.
- **AGSON-65**: `app/api/search/route.ts:17-31` — always include `role`/`email` in the select, or
  make `CommandPalette.tsx`'s `SearchResult` type mark them optional and render conditionally.
- **AGSON-64** (heavier, separate PR): wrap the move-application read+write in
  `app/api/minigames/sessions/[id]/move/route.ts:152-161` in a Serializable transaction, or switch
  to `updateMany` gated on previously-read state with retry-on-0-count — mirror the existing
  join/forfeit atomic pattern in the same file.

## Phase 5 — Observability foundation (1 item, do before/alongside Phase 4-10 for visibility into them)

- **AGSON-71**: replace the 28 empty `.catch(() => {})` fire-and-forget handlers (notification
  creation, email sends, badge/level checks, audit log writes, realtime broadcasts — see ticket for
  full file list) with at minimum `console.error('<context>', err)`; add a lightweight
  error-tracking SDK (Sentry or similar). Prioritize the audit-log write path first — it's the
  compliance trail for point/role changes. Recommend pulling this earlier than its current 8/28 due
  date: every other phase's rollout benefits from having real error signal in place first.

## Phase 6 — Accessibility sweep (3 items, one PR)

- **AGSON-54**: add `role="button" tabIndex={0}` + `onKeyDown` (Enter/Space) to the card `<div>`s
  in `food/page.tsx:612-616`, `marketplace/page.tsx:253-260`, `medicine/page.tsx:182-188` (also fix
  Medicine's wrong `role="group"`) — copy the existing correct pattern from
  `admin/feedback/page.tsx:127-133`.
- **AGSON-55**: add context-appropriate `aria-label` to icon-only buttons — `components/ui/pagination.tsx:34-40,60-66`
  fixes it app-wide since every admin list page imports it; also `marketplace/page.tsx`,
  `food/page.tsx`, `admin/rewards/page.tsx`, `admin/medicine/page.tsx`, `feed/page.tsx`,
  `CommandPalette.tsx`.
- **AGSON-49**: bump ~25 `text-gray-400` instances across 8 files (see ticket for full list) to
  `text-gray-500` minimum per DESIGN.md's documented contrast floor; consider a shared
  `text-muted` utility or lint rule since this recurs independently across files.

## Phase 7 — Design-system compliance sweep (3 items, do together — same review lens)

- **AGSON-46**: point `--font-mono` (`app/globals.css:70`) at Geist Mono instead of
  Cascadia Code/Fira Mono, or drop `font-mono` from table headers in favor of Geist Sans +
  letter-spacing. Natural pairing with AGSON-41 (both are the typeface-mandate fix) even though
  41 is in Phase 1 — do 46 right after 41 lands so there's no window running two wrong fonts.
- **AGSON-47**: recolor all 146 off-palette occurrences (16 files, see ticket for full list) onto
  navy + neutral-gray + the 3 sanctioned semantic hues; consolidate the duplicated
  marketplace/admin-rewards `categoryConfig` into one shared constant. This is the single largest
  UI batch in the whole plan — give it its own PR and a design/QA pass before merge, don't rush it
  into a mixed PR.
- **AGSON-40**: replace emoji-as-UI-chrome with one shared `lucide-react` icon constant across the
  5 patterns in the ticket (birthday/celebration icons, section headers, button-label prefixes,
  badge/status-tag icons, the duplicated game-icon map). Fix once per concept, not per file — the
  ticket already maps concept → icon.

## Phase 8 — IA & copy (1 fixable item; 1 blocked)

- **AGSON-52**: split the 11 flat admin nav items (`app/admin/layout.tsx:14-26,80`) into 2-3
  labeled clusters (e.g. "People", "Points & Rewards", "System & Trust"), mirroring the employee
  sidebar's existing Navigate/Management split.
- **AGSON-53**: remove or replace the "Missions & Streaks" login feature card
  (`app/(auth)/login/page.tsx:18-24`) — that system doesn't exist in the product. Audit the other 3
  feature cards on the same screen for the same gap while touching this file.
- **AGSON-51 — BLOCKED, not schedulable.** ui-audit and ux-audit reached opposite conclusions on
  the admin sidebar's white-vs-dark styling (documented DESIGN.md carve-out vs. Jakob's Law
  violation). This needs a product decision, not code — raise it with whoever owns DESIGN.md before
  putting it in any sprint.

## Phase 9 — Type-safety & lint (2 items — do 67 before 66, they overlap)

- **AGSON-67**: change `requireRole()` (`lib/auth/verifyAuth.ts:85`) from returning `boolean` to a
  type predicate (`user is AuthUser`); remove the 57 now-unnecessary `!` assertions across 43 call
  sites (points/award, points/award/bulk, points/deduct, admin/attendance/award, redemptions,
  medicine, user-role, settings, milestones, rewards routes). Mechanical but touches a lot of
  files — good candidate for a single large, low-risk PR.
- **AGSON-66**: fix the 39 lint errors / 50 warnings. **Overlap worth calling out explicitly:** the
  5 `react-hooks/refs` errors (`CommandPalette.tsx:49`, `ImageLightbox.tsx:19`,
  `lib/auth/AuthProvider.tsx:113`, `lib/hooks/useRealtimeChannel.ts:39`,
  `lib/hooks/useVisibleInterval.ts:20`) sit in files also touched by AGSON-65 (`CommandPalette.tsx`)
  and the god-file refactors in Phase 10 — fix the ref-in-render bug in each file the same PR that
  already has that file open, rather than a separate lint-only pass touching everything twice.

## Phase 10 — God-file refactors (heaviest phase, do last — benefits from stable code beneath it)

- **AGSON-68**: split `app/(dashboard)/feed/page.tsx` (2136 lines) — extract `ReactionBar`,
  `PollBlock`, `Avatar` into `components/feed/`; extract the ~20 inline async handlers into
  `lib/hooks/useFeedActions.ts` mirroring the existing `useApiClient` pattern.
- **AGSON-69**: split `app/(dashboard)/minigames/[id]/page.tsx` (1517 lines) — move each
  `*Board` component to `components/minigames/boards/{Game}Board.tsx` (mirrors the existing
  one-module-per-game pattern in `lib/minigames/*.ts`); move `ForfeitModal`/`InvitePanel`/
  `MobileBar`/`RightPanel` alongside the existing `components/minigames/GameResultOverlay.tsx`.
- **AGSON-70**: same extract-sub-sections + data-hook pattern for the 5 previously-tracked god
  files — `food/page.tsx` (1380), `profile/page.tsx` (1076), `admin/medicine/page.tsx` (993),
  `admin/employees/page.tsx` (860), `admin/points/page.tsx` (847). Do this *after* 68/69 so the
  extraction pattern is proven once rather than invented twice. Prioritize `food/page.tsx`
  (largest) and `admin/medicine` (most duplicated form/modal logic) first within this batch.

Note: Phase 2, 5, and 6 all touch `admin/employees/page.tsx` / `app/api/food/route.ts` /
`app/api/admin/employees/[id]/route.ts` files that Phase 10 will also restructure — land Phases
1-9 before starting Phase 10 so the refactor moves already-correct logic instead of moving bugs
around.

## Phase 11 — Test infrastructure (AGSON-20)

No test runner exists in `package.json`; all verification today is `npm run dev` + `npm run lint`.
**Recommend moving this earlier than its current tail-of-calendar (8/28, `none` priority)
placement** — every phase above is easier to land safely with even minimal test coverage, and
retrofitting tests after 10 phases of changes land is much more expensive than adding the runner
now and covering new fixes as they're written. At minimum, stand up the runner before Phase 10
(the god-file refactors are the highest-risk, highest-regression-surface work in this plan).

---

## Summary table

| Phase | Tickets | PRs |
|---|---|---|
| 0 | 48 (verify), 72 (verify), 74 | up to 2 |
| 1 | 41, 42, 43, 45, 44 | 5 (one each) |
| 2 | 56, 57, 59, 50 | 1 |
| 3 | 58, 73, 72 | 2 (bump PR + migration PR) |
| 4 | 60, 61, 62, 65, 64 | 2 (sweep PR + 64 alone) |
| 5 | 71 | 1 |
| 6 | 54, 55, 49 | 1 |
| 7 | 46, 47, 40 | 2-3 (47 alone recommended) |
| 8 | 52, 53 (51 blocked) | 1 |
| 9 | 67, 66 | 1-2 |
| 10 | 68, 69, 70 | 3 |
| 11 | 20 | 1 (move earlier) |

36 tickets → roughly 20-24 PRs once genuinely-coupled items are batched, down from 35 individually
scheduled due dates.
