# Solo Arcade V1 engineering and verification notes

Date: 2026-08-21 (Asia/Manila)

Branch: `feat/ags-arcade-solo-v1`

Plan: `docs/superpowers/plans/2026-08-20-ags-arcade-solo-v1-implementation-plan.md`

## Architecture and operating limits

- Practice creates and scores a seeded challenge entirely in the browser. It makes no attempt API request and creates no database row.
- Ranked play consumes one of three per-game, per-Manila-day slots when `POST /api/minigames/solo/attempts/start` succeeds. Abandoning or refreshing does not return a slot.
- Gameplay stays local. A normal completed ranked run uses one start request and one idempotent finish request; child game components contain no network clients.
- The finish service rebuilds the stored challenge and computes the official score from bounded evidence. The client cannot submit a score field.
- Leaderboards select one best valid attempt per employee in PostgreSQL, rank company or snapshotted-department scope, and include the current employee outside the top rows.
- Solo badges are idempotent `UserBadge` awards. Weekly Company and Department championships use distinct records. None of these paths writes `PointTransaction` or changes `pointsBalance`.
- The four game components are separate `next/dynamic` imports. Lobby links set `prefetch={false}` so selecting Typing does not request sibling routes speculatively.

## Fresh automated verification

| Check | Evidence | Result |
| --- | --- | --- |
| Unit/route/component suite | `npm test` | 49 files / 275 tests passed after the Task 21 bundle guard. |
| Focused bundle/network guard | `npm test -- components/minigames/solo/SoloGameGrid.test.ts components/minigames/solo/soloGameCards.test.ts components/minigames/solo/soloGameOrchestration.test.ts components/minigames/solo/soloGameRun.test.ts` | 4 files / 7 tests passed. |
| Focused security/gameplay/a11y matrix | Fifteen attempt, route, engine, ranking, badge, champion, focus, tab, and Profile test files | 15 files / 109 tests passed. |
| TypeScript | `npx tsc --noEmit` | Exit 0. |
| Prisma schema | `npx prisma validate` | Schema valid. |
| ESLint | `npm run lint` | Exit 0; 0 errors and 26 existing warnings. The two warnings in touched minigame pages are pre-existing raw-image sites; no new solo module emits a lint warning. |
| Production build | `npm run build` | Not safely runnable while the worktree's live `next dev -p 3010` owns `.next/dev/lock`. The process and lock were left untouched. Earlier task gates compiled and type-checked, then stopped in page-data collection because local Firebase Admin credentials were absent; Task 21 does not treat those historical runs as fresh build success. |

## Browser smoke matrix

There is no committed Playwright convention, authenticated storage state, E2E credential, Firebase emulator fixture, or `.env*` file in this worktree. Browser discovery returned no controllable browser. The live port accepted TCP connections but returned no HTTP bytes within a 10-second probe while the existing dev process held its lock. Therefore no authenticated/manual row below is represented as browser-passed, and no speculative Playwright scaffold was added.

| Required row | Available evidence | Browser status |
| --- | --- | --- |
| Existing RPS create/join | The multiplayer create/join bodies and `/minigames/[id]` route are unchanged from the branch base; the landing integration is additive. | Authenticated pass unavailable. |
| Existing multiplayer active route | `app/(dashboard)/minigames/[id]/page.tsx` is unchanged from the branch base. | Authenticated pass unavailable. |
| Practice makes no attempt write | `soloGameOrchestration.test.ts` asserts zero `fetch`, ranked-start, and ranked-finish calls while returning a real local score. | Protected browser unavailable. |
| Ranked start decrements immediately | Attempt service tests assert returned remaining slots `2`, `1`, `0`; the shell applies the start response before gameplay. | Protected browser unavailable. |
| Refresh/abandon does not refund | Attempt service tests count abandoned and expired starts as occupied slots. | Protected browser unavailable. |
| Fourth start returns limit | Service test returns `kind: "limit"`; route test maps the daily limit to HTTP 429. | Protected browser unavailable. |
| Typing official result | Route/service tests rebuild the canonical passage and use server elapsed time; the result panel labels Ranked output “Official result.” | Protected browser unavailable. |
| Reaction five-trial result | Engine tests require exactly five bounded trials; service dispatch test produces a valid official result. | Protected browser unavailable. |
| Visual Memory | Deterministic board, bounds, progression, and service dispatch are covered. | Protected browser unavailable. |
| Sequence Memory | Deterministic playback/progression, cleanup, bounds, and service dispatch are covered. | Protected browser unavailable. |
| Weekly/company leaderboard updates | Ranking SQL tests cover weekly filters; champion tests cover Company winners and idempotent finalization. | Protected browser unavailable. |
| Department uses snapshot | Ranking tests bind the attempt's stored `departmentId` (captured at start); champion tests persist the snapshotted department winner/name. | Protected browser unavailable. |
| Employee outside top rows sees rank | Query and UI-helper tests retain/pin the current employee outside the top 50/visible rows. | Protected browser unavailable. |
| Badges award once | Attempt and badge tests prove one evaluation after a new valid completion and duplicate-safe award writes. | Protected browser unavailable. |
| Championships render on Profile | Profile component test renders Company and Department wins distinctly; route tests authenticate and load history lazily. | Protected browser unavailable. |

## Network and bundle evidence

- The four game components have zero `fetch`, `apiFetch`, XHR, EventSource, or WebSocket call sites.
- `SoloGameShell` has one summary read call site, one ranked-start call site, and one finish call site. Summary is read only after choosing Ranked; the finish response updates remaining attempts without a follow-up summary fetch. The single-flight/retry test proves one click sends once and a retry reuses the same compact evidence.
- Leaderboard and summary requests run only in the stats view after authenticated selection/dependency changes; there is no polling or new realtime channel for Solo Arcade.
- Feed and Marketplace have zero imports of Solo Arcade modules.
- Four separate dynamic game imports are present, and all four lobby links disable route prefetch.
- `package.json` and `package-lock.json` are unchanged from the branch base. Lockfile searches and `npm ls` find no Phaser, Pixi, Kaboom, or Matter runtime.

## Accessibility evidence

- Mode and leaderboard controls are native buttons with pressed/selected state and visible `focus-visible` rings. Stats tabs implement `tablist`/`tab`/`tabpanel`, roving tab stops, arrows, Home, and End; focused tests cover the relationship and keyboard mapping.
- Typing uses a labelled textarea and polite timer/metric updates. Reaction, Visual Memory, and Sequence Memory announce phases/levels and move focus to newly interactive controls; the shared focus boundary is tested.
- Visual Memory supports arrows plus Enter/Space and supplements colour with cell numbers, a dot, a check mark, and accessible labels. Sequence buttons have directional text labels. Reaction uses “WAIT” versus “TAP / ENTER,” not colour alone.
- Confetti is suppressed for `prefers-reduced-motion: reduce`; other motion is guarded with `motion-safe`/`motion-reduce` or uses discrete state changes rather than CSS animation.
- Representative WCAG contrast calculations: gray-500/white 4.83:1, gray-600/white 7.56:1, emerald-700/emerald-50 5.21:1, red-700/red-100 5.30:1, amber-900/amber-100 8.15:1, navy-600/white 5.26:1, and white/command-black 17.74:1. White on emerald-600 is 3.77:1 and is used for the 20px bold Reaction target, satisfying the 3:1 AA large-text threshold.
- A mounted screen-reader/browser audit remains required when authenticated browser fixtures become available.

## Security evidence

| Requirement | Evidence |
| --- | --- |
| Unauthenticated -> 401 | Direct route tests cover start, finish, summary, leaderboard, champions, personal bests, and profile championships. |
| Other employee's attempt | The repository scopes lookup by both attempt ID and user ID and returns non-leaking `not_found` / 404; focused service/route tests cover it. |
| Malformed payload -> 400 | Strict bounded Zod route tests cover malformed, extra, and oversized evidence for all four games. |
| Expired -> no score | Atomic `STARTED -> EXPIRED` service path and pre/post-body clock-crossing route tests return 410 without scoring evidence. |
| Duplicate finish | The first completion is stored once; later finishes return the stored result and do not reevaluate badges. |
| Attempt four -> 429 | Daily allocation and route mapping tests cover it, including concurrent third-slot contention. |
| Client score ignored/recomputed | Strict schemas reject extra score fields; accepted evidence is rescored against the stored challenge. Typing elapsed time comes from the server clock. |
| No AGS points transaction | Solo API/service/migration source contains zero points-ledger persistence references; the migration adds only solo attempt/champion structures. |

## Licensing

Research references were HaltType (MIT), HumanEval (MIT), MentalMint / `tusharv/mini-games` (MIT), Monkeytype (GPL-3.0, study only), FreeFocusGames (AGPL-3.0, study only), and Phaser (MIT, considered and rejected). The implementation is AGS-native React/TypeScript built from mechanics; no non-trivial source, art, sound, or other asset was copied or adapted. Consequently `THIRD_PARTY_NOTICES.md` was not created.
