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

## Phase 7 — Design-system compliance sweep (REVISED 2026-08-13 — see note)

**Revision note:** AGSON-47 and AGSON-40 were marked Done in agshub, but this ledger never
checked them off, and a fresh full-app sweep on 2026-08-13 confirms why — the code was never
actually changed. Both tickets' original file lists undercounted the problem; the sweep found
live violations of the exact hue/emoji patterns those tickets described, plus new ones in files
touched since. The line items below supersede AGSON-47/40's scope with the current, verified
state (agshub items filed 2026-08-13, comments left on 59833d28/e7df96a3 with the specific
regression evidence). AGSON-46 is unaffected by this revision — still pending, not touched by
the 2026-08-13 sweep (it's a typography finding, out of that sweep's color/icon scope).

**AGSON-46** (font-mono) stays deferred — out of scope for this pass, still pending for a later
round.

**Not a fix task — decision needed**: `red-` vs. documented `rose-` for error states is used so
consistently app-wide (30+ files) it reads as a de facto convention (agshub `dc81d86a`, filed the
same way as AGSON-51). **Excluded from Tasks 1-7 below** — do not implement a mass find-replace,
raise it for a design-doc decision first.

### Global Constraints (all Task 1-7 implementers)

- Design tokens: Command Black (`#111827`) + Brand Navy (`navy-50`...`navy-900`, interactive/
  accent only, never decorative) are the only two "real" colors. Three semantic accents, paired
  with an icon or text label, never decorative: `emerald-*` = success, `amber-*` = warning,
  `rose-*` = error. Neutral (`gray-*`/`zinc-*`/`slate-*`/`neutral-*`/`stone-*`/white/black) is
  free to use anywhere.
- Do not touch `red-*` usages as part of any task below — that's the excluded decision item.
  Leave every existing `red-*` occurrence exactly as it is, even inside a file you're otherwise
  editing for an off-palette fix.
- Preserve exact existing Tailwind shade numbers where the hue swap is 1:1 (e.g. `blue-100
  text-blue-700` → `navy-100 text-navy-700`, not an arbitrary different shade) unless a task
  explicitly says otherwise.
- Every task's target files are Next.js 16 / React 19 / TypeScript strict / Tailwind v4. Run
  `npm run lint` and confirm `npm run build` succeeds before reporting DONE — there is no test
  runner in this repo (see Phase 11), so lint + build + manual verification via `npm run dev`
  (port 3010) is the verification bar.
- Commit with a `fix:` or `refactor:` prefix per this repo's existing convention (see recent
  `git log`), referencing the agshub item id in the body.
- Do not fix, rename, or touch anything belonging to a *different* task's file list, even if you
  notice something else off-palette while in a file — note it in your report instead.

### Task 1 — Root cause: recolor 6 shared `lib/constants/*.ts` files

Agshub item: `aa7dbfd0-1d6a-4b4b-a484-f465b439dcc1` (Critical). This is the root cause — it's
imported across most of the files in later tasks, so land this first.

Fix each occurrence below by swapping the off-palette hue for the matching on-token hue at the
**same shade number** (e.g. `blue-100`→`navy-100`, `red-700`→`rose-700`), unless noted otherwise:

1. `lib/constants/auditActions.ts:4` — `DELETE_POST` color `bg-red-100 text-red-700` — **leave
   as-is** (red is the excluded decision item, not this task's scope).
2. `lib/constants/auditActions.ts:5` — `DELETE_COMMENT` — same, **leave as-is**.
3. `lib/constants/auditActions.ts:9` — `ATTENDANCE_AWARD` color `bg-blue-100 text-blue-700` →
   `bg-navy-100 text-navy-700`.
4. `lib/constants/auditActions.ts:10` — `DEDUCT_POINTS` color `bg-orange-100 text-orange-700` →
   `bg-amber-100 text-amber-700`.
5. `lib/constants/feedbackCategories.ts:20` — `HARASSMENT_DISCRIMINATION`
   `bg-red-100 text-red-700` — **leave as-is**.
6. `lib/constants/feedbackCategories.ts:21` — `ETHICAL_FRAUD` `bg-orange-100 text-orange-700` →
   `bg-amber-100 text-amber-700`.
7. `lib/constants/feedbackCategories.ts:26` — `COMPANY_CULTURE` `bg-blue-100 text-blue-700` →
   `bg-navy-100 text-navy-700`.
8. `lib/constants/feedbackCategories.ts:27` — `TEAM_DYNAMICS` `bg-orange-100 text-orange-700` →
   `bg-amber-100 text-amber-700`. **Note:** this creates the same resulting hue as #6
   (`ETHICAL_FRAUD`) — both categories will now render identically. Flag this in your report; do
   not invent a third hue to differentiate them without a design-token justification, since
   `amber`/`emerald`/`rose`/`navy` are the only sanctioned accents and none of the other three fit
   "category" semantics better than the other two already assigned. Leave both `amber` and note
   it as a residual visual-distinction gap for follow-up.
9. `lib/constants/medicineRequestStatus.ts:6` — `REJECTED` `bg-red-100 text-red-600` — **leave
   as-is**.
10. `lib/constants/redemptionStatus.ts:14` — `REJECTED` `bg-red-100 text-red-700` — **leave
    as-is**.
11. `lib/constants/redemptionStatus.ts:15` — `FULFILLED` `bg-blue-100 text-blue-700` →
    `bg-navy-100 text-navy-700`.
12. `lib/constants/roles.ts:13` — `MANAGER` `bg-blue-100 text-blue-700` → `bg-navy-100
    text-navy-700`.
13. `lib/constants/roles.ts:15` — `SUPER_ADMIN` `bg-red-100 text-red-700` — **leave as-is**.
14. `lib/constants/rewardCategories.ts:16` — `PHYSICAL`: `iconClass: "text-orange-600"` →
    `"text-amber-600"`; `accent: "from-orange-400 to-amber-400"` → `"from-amber-400
    to-amber-600"` (both stops now on-token, keep it a visible 2-stop gradient rather than a flat
    fill); `badge: "bg-orange-50 text-orange-700 border-orange-200"` →
    `"bg-amber-50 text-amber-700 border-amber-200"`.
15. `lib/constants/rewardCategories.ts:17` — `VOUCHER`: `iconClass: "text-blue-600"` →
    `"text-navy-600"`; `accent: "from-blue-500 to-navy-500"` → `"from-navy-400 to-navy-600"`;
    `badge: "bg-blue-50 text-blue-700 border-blue-200"` → `"bg-navy-50 text-navy-700
    border-navy-200"`.
16. `lib/constants/rewardCategories.ts:18` — `PRIVILEGE`: `accent: "from-navy-500 to-blue-500"`
    → `"from-navy-500 to-navy-700"` (only the `to-` stop is off-token; the base entry is
    otherwise fine).

Also fix the file's own header comment in `rewardCategories.ts` if it still claims full palette
compliance while any entry doesn't hold — make the comment match the code, not the other way
around.

**Report:** list every file changed, confirm `npm run lint` and `npm run build` pass, and flag
the #6/#8 identical-hue residual gap explicitly.

### Task 2 — Off-palette colors direct in admin pages/components

Agshub item: `ea7a1479-afe3-4984-aaf2-b3510e1e9116` (High). Depends on Task 1 having landed
first (for a consistent target palette to match against), but touches entirely different files.

1. `app/admin/redemptions/page.tsx:271` — Fulfill button: `bg-blue-50 text-blue-600 border
   border-blue-200 ... focus-visible:ring-blue-600` → swap every `blue-*` to the matching
   `navy-*` shade.
2. `app/admin/redemptions/page.tsx:333` — identical pattern on the desktop-table variant of the
   same button — same fix.
3. `app/admin/points/utils.ts:5` — `CATEGORY_BADGE.TEAMWORK` `bg-blue-50 text-blue-700` →
   `bg-navy-50 text-navy-700`.
4. `app/admin/points/components/AttendanceAwardPanel.tsx:31-33` — info callout:
   `bg-blue-50 border-blue-100` → `bg-navy-50 border-navy-100`, `text-blue-800` →
   `text-navy-800`, `text-blue-600` → `text-navy-600`.
5. `app/admin/medicine/components/EditMedicineDialog.tsx:83` — `text-blue-600 hover:underline` →
   `text-navy-600 hover:underline` (match the pattern already used in
   `components/admin/RecentActivity.tsx:67` and `ActionQueue.tsx:87-98`).
6. `components/admin/ActionQueue.tsx:16` — `KIND_META.REDEMPTION.iconColor: "bg-blue-500"` →
   `"bg-navy-500"`.

**Report:** list every file changed, confirm `npm run lint` and `npm run build` pass.

### Task 3 — Off-palette colors direct across dashboard/profile/employee pages

Agshub item: `22159a8a-6335-4c1b-a72e-855c57f40983` (High). Depends on Task 1 having landed.

1. `app/(dashboard)/profile/utils.ts:35,38,39,41,45,46` — the `PointTransaction` color map:
   `text-yellow-600` (Contest) → `text-amber-600`; `text-orange-500` (Game) → `text-amber-500`;
   `text-teal-600` (Refund) → `text-navy-600`; `text-red-600` (Deduction) — **leave as-is**
   (excluded decision item); `bg-violet-50 text-violet-700` (Performance) → `bg-navy-50
   text-navy-700`; `bg-blue-50 text-blue-700` (Teamwork) → `bg-emerald-50 text-emerald-700`
   (differentiate from Performance's navy since both were previously distinct hues — pick
   emerald since it isn't otherwise used in this map).
2. `app/(dashboard)/profile/components/OverviewStatsGrid.tsx:13` — `text-violet-600
   bg-violet-50` (Level stat) → `text-navy-600 bg-navy-50`.
3. `app/(dashboard)/profile/components/PointsTab.tsx:25` — `bg-violet-100 text-violet-700` →
   `bg-navy-100 text-navy-700`.
4. `app/(dashboard)/profile/components/QuickActionsWidget.tsx:10-11` — `text-violet-500`
   (Redeem Points) → `text-navy-500`; `text-indigo-500` (Play a Minigame) → `text-navy-700`
   (differentiate the two navy shades since both actions are on the same widget).
5. `app/(dashboard)/profile/components/BirthdayHireCard.tsx:25-26` — `bg-blue-50`,
   `text-blue-500` → `bg-navy-50`, `text-navy-500`.
6. `app/(dashboard)/profile/components/BioSection.tsx:14-15` — `bg-sky-50`, `text-sky-500` →
   `bg-navy-50`, `text-navy-500`.
7. `app/(dashboard)/profile/components/SkillsSection.tsx:29,34,56` — `bg-blue-50 text-blue-700
   border-blue-100`, `hover:text-blue-900`, `focus-visible:ring-blue-500` → the matching
   `navy-*` shades throughout.
8. `app/(dashboard)/employees/[id]/page.tsx:64,315-316,341` — `text-orange-500 bg-orange-50`
   (Game Entry) → `text-amber-500 bg-amber-50`; `text-yellow-500`/`text-yellow-600` (rank medal)
   → `text-amber-500`/`text-amber-600`; `bg-blue-50 text-blue-700 border-blue-100` (skill pill)
   → `bg-navy-50 text-navy-700 border-navy-100`.
9. `app/(dashboard)/employees/[id]/page.tsx:366` — avatar-fallback gradient
   `bg-gradient-to-br from-amber-400 to-orange-500` → `bg-gradient-to-br from-navy-600
   to-navy-800` (match the avatar-fallback convention already used elsewhere, e.g.
   `components/feed/Avatar.tsx:10`, rather than a semantic-accent color used decoratively).
10. `app/(dashboard)/leaderboard/page.tsx:60-61` — 3rd-place medal `bg-orange-50`,
    `text-orange-400` → `bg-amber-50`, `text-amber-400`.
11. `app/(dashboard)/minigames/stats/page.tsx:36,112,140` — `rankColors` map: `1:
    "text-yellow-500"` → `"text-amber-500"`, `3: "text-orange-500"` → `"text-amber-700"`
    (differentiate 1st/3rd), plus `text-orange-600 bg-orange-50` → `text-amber-600 bg-amber-50`.
    Also extract this rank-color map into `lib/constants/` as a shared constant alongside
    `profile/utils.ts`'s equivalent (item 1 above) rather than leaving two independent copies —
    note in your report if this refactor is out of scope for a mechanical color-only task and you
    left them as two files with matching values instead.
12. `app/(dashboard)/feed/page.tsx:149,306,426` — mention pill `text-blue-600 bg-blue-50
    hover:bg-blue-100` → `text-navy-600 bg-navy-50 hover:bg-navy-100`; food icon
    `text-orange-400` → `text-amber-400`; `hover:bg-blue-50` → `hover:bg-navy-50`.
13. `app/(dashboard)/feed/page.tsx:269` — Star icon `text-yellow-500` → `text-amber-500`.
14. `app/(dashboard)/feed/page.tsx:247` — Birthdays widget card `bg-gradient-to-br
    from-rose-50 to-navy-50` → `bg-gradient-to-br from-navy-50 to-navy-100` (rose was being used
    decoratively here, which the design doc bans — drop it, keep the card on-brand navy/neutral
    only).
15. `app/(dashboard)/feed/page.tsx:708` — pinned-post accent bar `bg-gradient-to-r
    from-amber-400 to-yellow-300` → `bg-gradient-to-r from-amber-400 to-amber-600` (amber used
    decoratively here is also against the doc's letter, but pinned-post is a persistent status
    indicator arguably close enough to "labeled" — at minimum fix the off-palette `yellow-300`
    stop; note the decorative-amber judgment call in your report rather than resolving it
    yourself).
16. `app/(dashboard)/food/components/FoodListingCard.tsx:166` and
    `FoodListingDetailModal.tsx:173` — `text-sky-600` (delivery-truck label) → `text-navy-600`.
17. `components/feed/ReactionBar.tsx:16,18` — `EMOJI_BG` map: thumbs-up `bg-blue-50
    text-blue-700 border-blue-200` → `bg-navy-50 text-navy-700 border-navy-200`; fire
    `bg-orange-50 text-orange-600 border-orange-200` → `bg-amber-50 text-amber-600
    border-amber-200`.

**Report:** list every file changed, confirm `npm run lint` and `npm run build` pass, and include
your judgment call on item 15 (decorative amber) explicitly.

### Task 4 — Minigames board components ignore their own established color tokens

Agshub item: `ba5e500e-1306-4900-9a90-1eca741f8cd9` (Medium). These are **functional game-state
colors**, not pure decoration — preserve the existing win/lose/hit/miss/player semantics exactly,
only change which token expresses each state.

1. `components/minigames/boards/BSBoard.tsx:77-83,131` — grid-cell states currently use raw
   `bg-red-700/800` (sunk), `bg-red-500/600` (hit), `bg-orange-400/500` (?), `bg-blue-50/200/100`
   (water/miss). The file's own `SHIP_COLORS` map (lines 13-17) already defines
   `navy-600`/`amber-600`/`rose-500` for ship identity — read that map first, then remap the
   grid-cell states onto the closest semantically-appropriate token from
   `navy-*`/`amber-*`/`rose-*`/neutral, preserving which states are currently visually distinct
   from each other (don't collapse two different states onto the same color). Water/miss should
   land on navy or neutral (not the banned blue); hit/sunk should land on rose (loss/damage
   semantics) or amber depending on which reads as more severe in context — use your judgment on
   the hit-vs-sunk severity ordering and state it in your report.
2. `components/minigames/boards/C4Board.tsx:50,87,100-101` and
   `DnBBoard.tsx:31,67,80,108-109` — both use `bg-yellow-400`/`text-yellow-600`/`bg-yellow-200`
   for the "host/player-1" identity color, paired with `rose-500`/`rose-600` for guest. Switch
   player-1 from yellow to `navy-600` (matching `TTTBoard.tsx`'s host/guest convention of
   navy-600/rose-500 exactly) across every cell/label/dot in both files. Verify after the change
   that host and guest are still visually distinguishable in the actual rendered board (navy vs
   rose has good contrast — this should hold, but check).
3. `components/minigames/GameResultOverlay.tsx:66,68,69` — `bgGradient` ternary: draw state
   `from-[#451a03] to-[#78350f]` → `from-amber-950 to-amber-900` (token classes instead of raw
   hex, same visual result); win state `from-[#1e1b4b] to-[#312e81]` (indigo, banned) →
   `from-navy-900 to-navy-800`; loss state `from-[#1c1917] to-[#292524]` → `from-stone-900
   to-stone-800` is already neutral/acceptable, but switch to the token classes for consistency
   with the other two (or leave as-is if `stone-*` doesn't have a defined scale in this project's
   Tailwind config — check `app/globals.css` `@theme` block first and use whatever neutral scale
   is actually configured there).

**Report:** list every file changed, confirm `npm run lint` and `npm run build` pass, explicitly
state your hit-vs-sunk severity judgment call from item 1, and confirm you visually checked (via
`npm run dev`, joining/hosting a quick game of each type) that host/guest and hit/sunk/miss/water
remain distinguishable after the recolor — this is the one task in this phase where a bad color
choice could make the game state unreadable, not just off-brand.

### Task 5 — Emoji fixes: re-verify AGSON-40's original scope, then fix 6 new instances

Agshub item: `847f3bef-a658-4f95-b015-b777b38a5606` (Medium), plus re-verification of AGSON-40's
original scope (agshub `e7df96a3`, marked Done in agshub but never actually implemented per this
ledger).

**Step 1 — re-verify before touching anything.** AGSON-40's original description lists 5
patterns across 8 files: birthday/celebration icons in `feed/page.tsx`, `profile/page.tsx`,
`admin/page.tsx`, `employees/[id]/page.tsx`; section-header icons in `profile/page.tsx` (x2),
`food/page.tsx`; button-label icon prefixes in `minigames/[id]/page.tsx` (x4),
`employees/[id]/page.tsx`; badge/status-tag icons in `feed/page.tsx` (x4),
`admin/feedback/page.tsx`, `admin/feedback/[id]/page.tsx`, `profile/page.tsx`; and a duplicated
game-icon map in `components/minigames/HowToPlayModal.tsx`. Grep each file for emoji at the
cited line numbers first (line numbers may have shifted since Aug 7 — search by content, not
just line number) — some may already be fixed by later refactor commits on this branch. Fix
whatever is still emoji, using a `lucide-react` icon that matches the concept (birthday →
`Cake` or `Gift`, celebration → `PartyPopper`, section headers → context-appropriate icon already
used elsewhere in the file if one exists, confidential/lock → the app already uses a proper icon
for this elsewhere per prior findings, check `WhistleIcon.tsx`/lock icon usage in
`components/admin/`).

**Step 2 — fix the 6 new instances found 2026-08-13:**
1. `components/minigames/boards/BSBoard.tsx:117` — anchor emoji in the "Fleet deployed!" empty
   state. The file already imports and correctly uses `Anchor` from `lucide-react` at line 156 —
   just replace the emoji span with `<Anchor className="w-12 h-12 text-navy-300"
   aria-hidden="true" />` (adjust sizing/color to match the empty-state's existing visual
   treatment).
2. `app/(dashboard)/food/components/SellerOrdersPanel.tsx:90` — "checkmark Paid" badge text →
   add a `Check` or `CheckCircle2` icon from `lucide-react` next to the "Paid" label.
3. `app/(dashboard)/food/components/FoodListingDetailModal.tsx:309` — memo-emoji prefix on order
   notes → `FileText` (already imported/used elsewhere, e.g.
   `profile/components/BioSection.tsx`) or `StickyNote`.
4. `components/minigames/InvitePanel.tsx:97` — "Sent checkmark" button-state label → add a small
   `Check` icon.
5. `components/minigames/boards/C4Board.tsx:101` and `DnBBoard.tsx:109` — player-identity emoji
   label. Both files already render the real player color as a CSS-colored dot elsewhere in the
   same component (e.g. `DnBBoard.tsx:80,86`) — replace the emoji with the same inline
   `<span className="inline-block w-2.5 h-2.5 rounded-full bg-navy-600" />` (or the guest
   equivalent) pattern instead of introducing a new icon. Coordinate with Task 4's player-color
   change (navy replaces yellow) if Task 4 hasn't landed yet — use `navy-600`/`rose-500` here
   regardless of Task 4's exact landing order, since that's the target either way.
6. `components/minigames/GameResultOverlay.tsx:57,116` — win/loss/draw hero-graphic emoji, mixed
   with `lucide-react` icons used for the buttons in the same file. Lower severity — use your
   judgment: either replace with a lucide equivalent (`Trophy` for win is a clean match; draw and
   loss don't have as clean a match) or leave as-is and note the judgment call in your report
   rather than forcing a poor icon substitute.

**Report:** list every file changed, note which of AGSON-40's original 8 file/pattern list were
already fixed vs. needed fixing, confirm `npm run lint` and `npm run build` pass.

### Task 6 — Auth pages hardcode raw `red-` instead of the shadcn `destructive` token

Agshub item: `c4e1b6c1-af70-4da0-993d-2a2e2a1f6e7b` (Low).

1. `app/(auth)/login/page.tsx:207-208` — error banner `bg-red-50 border-red-100` /
   `text-red-600` → the shadcn destructive tokens already used throughout `components/ui/`
   (`bg-destructive/10 border-destructive/20`, `text-destructive`, or whatever exact tint
   convention the codebase already uses elsewhere for a destructive-tinted surface — check
   `components/ui/alert-dialog.tsx` or similar for the established pattern before inventing one).
2. `app/(auth)/onboarding/page.tsx:148-149` — identical pattern, same fix.

Do not touch `login/page.tsx:197-200`'s Google "G" logo SVG colors (`#4285F4` etc.) — those are
Google's own trademarked brand colors for the sign-in button icon, not app UI colors.

**Report:** list every file changed, confirm `npm run lint` and `npm run build` pass.

### Task 7 — `pagination.tsx`: fix both the token-bypass and the pending aria-label gap (AGSON-55)

Agshub item: `b83baf6b-9ddc-4c64-90d6-5d68b24c1d6f` (Low), bundled with the `pagination.tsx`
portion of AGSON-55 (Phase 6) per the plan's own file-grouping principle — **do not** also fix
AGSON-55's other 6 files (`marketplace/page.tsx`, `food/page.tsx`, `admin/rewards/page.tsx`,
`admin/medicine/page.tsx`, `feed/page.tsx`, `CommandPalette.tsx`) — those stay a separate, still-
open Phase 6 item for a later pass.

1. `components/ui/pagination.tsx:38,44,51,53-54,65,70` — replace the raw `gray-50/200/500/900`
   with the semantic tokens every sibling `components/ui/` file uses: `border`, `bg-muted`,
   `text-muted-foreground`, `ring-ring`, `bg-primary`/`text-primary-foreground` for the active
   page state. Match each raw gray usage to whichever semantic token plays that same role in a
   sibling component (e.g. `button.tsx`, `select.tsx`) — don't guess a mapping, read a sibling
   file first.
2. `components/ui/pagination.tsx:34-40,60-66` (AGSON-55 scope) — add context-appropriate
   `aria-label` to the icon-only prev/next/page buttons (e.g. `aria-label="Previous page"`,
   `aria-label="Go to page {n}"`, `aria-label="Next page"`).

**Report:** list every file changed, confirm `npm run lint` and `npm run build` pass, and confirm
(via `npm run dev`) that an admin list page using pagination (e.g. `/admin/employees`) still
renders and paginates correctly after the token swap.

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
| 7 | 46, agshub aa7dbfd0/ea7a1479/22159a8a/ba5e500e, 40 (revised), c4e1b6c1, b83baf6b+55 | 6-7 (constants-file item alone recommended) |
| 8 | 52, 53 (51 blocked) | 1 |
| 9 | 67, 66 | 1-2 |
| 10 | 68, 69, 70 | 3 |
| 11 | 20 | 1 (move earlier) |

36 tickets → roughly 20-24 PRs once genuinely-coupled items are batched, down from 35 individually
scheduled due dates.
