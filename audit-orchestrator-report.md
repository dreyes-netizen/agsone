# Audit Orchestrator — Unified Report
**Target:** http://localhost:3010 | **Project:** agsone | **Mode:** full (5 static agents + live UX/QA/performance passes) | **Date:** 2026-08-03

## Summary

This run re-audited the app after a long session of prior fixes (Critical race conditions, rate limiting, image fallbacks, and this session's own QA audit). Five background agents ran the static passes (UI, security, backend, code, supply-chain) in parallel; I ran the UX, QA, and performance passes live against the app (QA reused the 24-page walkthrough + 6 fixes already completed and filed earlier this session rather than repeating it).

**Two important bugs were found and fixed mid-run, both verified live against the real database, not just `tsc`:**
1. A genuine points-balance race condition in `/api/points/deduct` (found by the code-audit agent, confirmed by reading the code, fixed, and verified end-to-end through the real route: requesting 100 points against a 40-point balance correctly clamped to a -40 transaction and a 0 final balance, not negative).
2. **A regression in this session's own earlier work**: the `employees/sync` route's raw SQL (fixed in an earlier phase to wrap writes in a transaction) casts `${userId}::uuid` and compares it against `User.id`, but that column is Prisma `String` (Postgres `text`), not native `uuid` — so the "update existing employees" step would 500 on every real sync upload that touches an existing employee (i.e. almost every real upload). This was never caught because `tsc --noEmit` can't see SQL type errors; it was only caught by directly testing the deduct-route fix against the live database and then applying the same live-verification discipline backward to the sibling raw-SQL route. Both are now fixed and verified against the real Postgres instance.

## Scorecard

| Domain | Score | Critical | High | Medium | Low |
|--------|-------|----------|------|--------|-----|
| UI | 43 | 1 | 3 | 2 | 3 |
| UX | — (qualitative, see below) | 0 | 0 | 1 | 1 |
| Security | 87 | 0 | 0 | 1 | 2 |
| Backend | 88 | 0 | 0 | 1 | 5 |
| QA | — (see qa-audit-report.md, 7/7 fixed) | 0 | 1 (fixed) | 4 (fixed) | 2 (fixed) |
| Code | 64 | 0 | 3 | 3 | 1 |
| Performance | 95+ (Lighthouse 93/100/92/67, LCP 98ms, CLS 0.00) | 0 | 0 | 2 (fixed) | 0 |
| Supply-chain | 52 → improved after fix | 1 (fixed) | 1 (open) | 1 (fixed) | 1 |
| **Self-found (this run)** | — | 1 (fixed) | 0 | 0 | 0 |

Backend and Performance are in strong shape. UI (43) and supply-chain's open xlsx item are the two areas that most need attention, and both require a genuine decision from you rather than a mechanical fix (see below).

## Fixed this run (verified live, not just type-checked)

| Severity | Finding | Fix |
|---|---|---|
| Critical (self-found) | `employees/sync` raw SQL casts a `text` id column to `::uuid` — breaks the "update existing employee" step on every real sync upload | Changed casts to `::text`; verified with a direct query against real user/department rows |
| High | `points/deduct` balance race — floor-at-zero clamp computed from a stale pre-transaction read, so two concurrent deductions could drive balance negative | Rewrote as one atomic `WITH ... FOR UPDATE` + `UPDATE ... RETURNING` statement; verified end-to-end (100 requested against 40 balance → -40 transaction, 0 final balance) |
| Critical | `websocket-driver@0.7.4` — critical message-corruption CVE (transitive via firebase's Realtime Database module) | `npm audit fix` (dry-run verified no major-version bumps); also resolved a batch of High/Moderate dev-tooling CVEs (brace-expansion, js-yaml, fast-uri) and bumped `next` to the CVE-patched 16.2.12 as a side effect, all non-breaking |
| Medium (a11y) | `maximumScale: 1` in `app/layout.tsx` disabled pinch-zoom — flagged by Lighthouse as a low-vision accessibility violation | Removed the cap |
| Medium (SEO) | `/robots.txt` had no route, so `proxy.ts` redirected unauthenticated requests (including Lighthouse/crawlers) to `/login` instead of serving robots.txt — Lighthouse flagged this as "invalid robots.txt" | Added `app/robots.ts` (disallow-all, since this is an internal auth-gated tool) and excluded `robots.txt` from the proxy's auth matcher |

## Top Open Findings (by severity)

- **[Critical, needs your judgment]** `components/ui/*` shadcn primitives (Button, Badge, Card, Input, Avatar, etc.) are installed but used in only 11 files (all `Pagination`) — every button/badge/card/input in the app is hand-rolled Tailwind. This is the same design-system-consolidation item already tracked in agshub as "Unify table and card styling across the app" — I did **not** file a duplicate ticket; recommend deciding whether to close one in favor of the other, since this pass's evidence (zero real usage of 10 of 11 primitives) is more precise than the original ticket's framing.
- **[High]** `xlsx` (SheetJS) has a Prototype Pollution + ReDoS vulnerability with **no fix published to npm** — SheetJS moved patched releases to their own CDN. Used in `employees/sync` and `attendance/award` (both HR_ADMIN-gated, so exposure is reduced but real). Needs a decision: install from SheetJS's CDN directly, or migrate to `exceljs`.
- **[High]** `npm run lint` currently fails with 40 errors — mostly `react-hooks/set-state-in-effect` (×24) and `react-hooks/refs` (×6), a repo-wide pattern from newly-enforced React Compiler ESLint rules, not something newly broken. Needs a decision: refactor the pattern repo-wide, or scope an intentional eslint override if the team wants to keep the current idiom.
- **[High]** 5 more "god files" beyond the 2 already tracked: `food/page.tsx` (1413 lines), `profile/page.tsx` (1076), `admin/medicine/page.tsx` (1033), `admin/employees/page.tsx` (908), `admin/points/page.tsx` (866).
- **[High]** ~15 files hand-roll their own modal overlay instead of a shared Dialog component.
- **[High]** 13 files each duplicate their own toast/notification state and markup instead of one shared component.
- **[High]** Icon-only remove/close buttons in 6+ locations (food, feed, admin/rewards, admin/documents) lack `aria-label` — the correct pattern already exists in-repo (other close buttons do this right), just applied inconsistently.
- **[Medium]** Rate limiting (`checkRateLimit`) only covers 6 of ~50+ mutating routes — employee-facing writes (feed posts/comments, medicine requests, minigame sessions, food orders) have no per-user throughput cap.
- **[Medium]** `requireRole()` returns `boolean` instead of a type predicate (`user is AuthUser`), forcing 20+ non-null assertions (`actor!`) across API routes instead of TypeScript narrowing.
- **[Medium]** The broken-image `onError` fallback pattern (built organically across this session's fixes) is now implemented 3 different ways across 10 files — worth consolidating into one shared hook/component.

## agshub Work Items Filed

All filed to **AGS One** (`AGSON`) in `alliance-global-solutions`.

| State | Priority | Title |
|---|---|---|
| Done | Urgent | employees/sync raw SQL casts text id column to ::uuid, breaks update-existing-employee step |
| Done | High | points/deduct balance race — floor-at-zero clamp computed from stale pre-transaction read |
| Done | Urgent | npm audit: websocket-driver critical CVE |
| Todo | High | npm run lint fails with 40 errors — react-hooks/set-state-in-effect and react-hooks/refs, repo-wide |
| Todo | High | 5 more god-files beyond the 2 already tracked |
| Todo | High | ~15 files hand-roll their own modal overlay instead of a shared Dialog component |
| Todo | High | 13 files duplicate their own toast/notification state and markup |
| Todo | High | Icon-only remove/close buttons missing aria-label in 6+ locations |
| Todo | High | xlsx (SheetJS) has unfixable Prototype Pollution + ReDoS CVEs — needs a source decision |

Not filed (overlaps an existing item, needs your triage rather than a duplicate ticket): the Critical "shadcn primitives unused" finding vs. the already-open "Unify table and card styling across the app" item.

## Notes

- **Sentry / Render MCP augmentation**: not configured in this session (would require a fresh OAuth flow) — degraded gracefully per the orchestrator's design, no runtime error/production-log correlation was available for the security/backend/QA passes.
- **Serena / Endor**: not attached — code pass used manual analysis instead of the symbol graph; supply-chain used `npm audit` + Sonatype instead of Endor.
- **QA pass**: reused this session's already-completed 24-page walkthrough (7 findings, all fixed and filed to agshub) rather than repeating it — see `qa-audit-report.md`.
- **UX pass**: no dedicated multi-page heuristic sweep was run separately from QA/UI (which already cover most of the same ground); did verify mobile responsiveness (login page, clean) and note loading-state style inconsistency (generic spinner text vs skeleton shimmer, varies by page) as a Low finding, not filed individually.
- Live-testing the fixes required real writes to the dev database (test point awards/deductions against employee "Larinz Padullano", clearly labeled in the transaction notes, e.g. "Race-fix verification test award") — this is dev/seed data, not production.
