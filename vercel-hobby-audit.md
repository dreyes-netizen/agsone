# Vercel Hobby Pre-Implementation Audit

Date: 2026-08-14
Branch: `feature/AGSON-85-reward-hard-delete`
Baseline worktree: clean

## Architecture discovered

- Next.js 16.3.0 App Router with React 19.2.4 and npm/package-lock.
- Most pages are client-rendered applications inside statically prerendered App Router shells.
- Firebase Auth is used in the browser; Firebase Admin verifies bearer tokens in route handlers.
- Prisma 7.8/7.9 with PostgreSQL is the primary application database.
- Supabase is used for browser Realtime broadcasts and policy-document storage/RAG.
- Cloudinary uploads go directly from the browser after a signed Vercel request.
- Upstash provides distributed rate limiting; Sentry provides client/server monitoring.
- There are 78 route handlers, two daily Vercel cron invocations, and one Next.js 16 Proxy.
- No ISR routes or Server Actions were found. The production build classifies `/` and three parameterized pages as dynamic; the other UI pages are static shells. All authenticated data APIs are dynamic, as required.

## Request traces

### Login/bootstrap before optimization

```text
Google popup
  -> POST /api/auth/sync
  -> POST /api/auth/session
  -> AuthProvider onIdTokenChanged
       -> POST /api/auth/session
       -> POST /api/auth/sync
       -> GET /api/me
```

The token-refresh callback repeats the final three calls roughly hourly. Consolidating this safely requires changing session-cookie minting and profile bootstrap together; that is valuable, but auth-critical and therefore documented rather than included in the initial low-risk patch set.

### Feed before optimization

```text
AuthProvider bootstrap
  -> session + sync + profile
Dashboard shell
  -> notifications (+ 60-second fallback poll)
  -> Ally enabled setting
Feed
  -> posts
  -> full employee picker roster (up to 500), even if compose is never opened
  -> duplicate profile
  -> leaderboard
  -> upcoming birthdays
```

### Realtime screens before optimization

```text
Supabase broadcast subscription
  + notifications GET every 60 seconds
  + minigame lobby GET every 15 seconds
  + active game GET every 10 seconds
```

Polling pauses while hidden and Realtime resyncs on wake, which is good. The intervals are nevertheless aggressive for fallback traffic when the websocket is healthy.

## CRITICAL

No critical Vercel-usage issue was found. The application has meaningful runtime usage, but no single path justifies a risky architectural rewrite.

## HIGH

### H1. Authentication bootstrap duplicates privileged work

- Files/code: `app/(auth)/login/page.tsx` sign-in flow; `lib/auth/AuthProvider.tsx` `onIdTokenChanged`; `/api/auth/sync`, `/api/auth/session`, and `/api/me`.
- Problem: one login can produce five Vercel function invocations with duplicate Firebase token verification, session-cookie creation, user sync lookup, and profile reads.
- Resource reason: repeated serverless invocations, Firebase Admin cryptography/network work, Prisma queries, and response transfer.
- Vercel metrics: Function Invocations, Fluid Active CPU, Fluid Provisioned Memory, Fast Origin Transfer.
- Relative impact: high.
- Change risk: high because the HttpOnly cookie, directory allow-list, deactivated-user gate, and first-navigation race must remain correct.
- Recommendation: later consolidate sync, session minting, and the narrow bootstrap profile into one idempotent endpoint, with dedicated auth integration tests. Do not cache auth decisions.

### H2. Realtime-enabled screens retain frequent unconditional fallback polls

- Files/code: `components/notifications/NotificationsController.tsx` (60s), `app/(dashboard)/minigames/page.tsx` (15s), and `app/(dashboard)/minigames/[id]/page.tsx` (10s).
- Problem: healthy Supabase Realtime sessions still invoke Vercel continuously.
- Resource reason: each poll invokes a function, verifies Firebase, queries the user, and runs screen-specific database reads.
- Vercel metrics: Function Invocations, Fluid Active CPU, Fast Origin Transfer, database requests.
- Relative impact: high for long-lived tabs and active games.
- Change risk: medium; polling is the delivery backstop, so it must not be removed.
- Recommendation: retain visibility-aware fallback polling but lengthen intervals to 5 minutes for notifications, 60 seconds for the lobby, and 30 seconds for active games. Realtime remains immediate; wake-up resync remains intact.

### H3. Feed bootstrap eagerly fans out to reference endpoints

- Files/code: `lib/hooks/useFeedActions.ts`, particularly the employee effect and the widget `Promise.allSettled`.
- Problem: every feed visit downloads up to 500 employees even if the user never composes, and separately calls `/api/me` even though `AuthProvider` already holds every field the feed widget uses.
- Resource reason: two avoidable function invocations, repeated auth/database work, and a potentially large employee JSON payload.
- Vercel metrics: Function Invocations, Fluid Active CPU, Fast Origin Transfer, Fast Data Transfer, database requests.
- Relative impact: high because feed is the default landing screen.
- Change risk: low to medium; roster loading must occur before mention/shoutout interaction needs it.
- Recommendation: derive feed stats from `dbUser` and fetch the roster only when the composer is expanded.

### H4. Other high-traffic pages re-fetch the current profile unnecessarily

- Files/code: `app/(dashboard)/marketplace/page.tsx` and `app/(dashboard)/leaderboard/page.tsx` call `/api/me` for fields already present in Firebase/AuthProvider state.
- Problem: each visit incurs another dynamic function and a wide profile query including badges and profile fields.
- Resource reason: redundant invocation, Firebase verification, Prisma query, serialization, and transfer.
- Vercel metrics: Function Invocations, Fluid Active CPU, Fast Origin Transfer, database requests.
- Relative impact: medium to high.
- Change risk: low; Realtime already refreshes `dbUser.pointsBalance` and the page can construct the displayed identity from `user` plus `dbUser`.
- Recommendation: consume AuthProvider state and keep only the page-specific APIs.

### H5. Global client monitoring/auth/realtime dependencies are large

- Files/code: `instrumentation-client.ts`, `lib/auth/AuthProvider.tsx`, and `lib/hooks/useRealtimeChannel.ts`.
- Relevant build evidence: approximately 459 KB uncompressed Sentry chunk, 231 KB Supabase chunk, and 150 KB Firebase chunk. Recharts is approximately 339 KB but is route-scoped to admin analytics.
- Problem: global providers make large SDK code broadly reachable.
- Resource reason: static asset transfer and browser parse/execute cost.
- Vercel metrics: Fast Data Transfer; indirectly client performance.
- Relative impact: high for first visits, but compression and CDN caching reduce repeats.
- Change risk: high; changing monitoring/auth/realtime loading can lose errors or live updates.
- Recommendation: keep monitoring and auth intact for now. Later split the points realtime controller out of the root auth provider and evaluate conditional Sentry client loading only with verified production telemetry.

## MEDIUM

### M1. Proxy still runs for some public static files

- File/code: `proxy.ts` matcher excludes Next internals, API routes, favicon, robots, and PNG only.
- Problem: public SVG/JPEG/WebP/GIF/AVIF/ICO assets can pass through Proxy.
- Resource reason: avoidable Edge Requests and Edge Request CPU Duration.
- Vercel metrics: Edge Requests, Edge Request CPU Duration.
- Relative impact: medium; current public asset set is small, but the matcher is unnecessarily narrow.
- Change risk: low if only file-extension assets are excluded; page routes and API authorization remain unchanged.
- Recommendation: exclude common image/static extensions while retaining per-route API authorization.

### M2. Tiny local brand assets create unnecessary image variants

- Files/code: repeated `next/image` use for `public/agslogo.png` at 24, 28, 32, 64, 72, and 80 pixels; `ally-eagle.svg` is also a tiny static asset.
- Problem: a 12 KB logo can create multiple optimizer transformations/cache reads for negligible transfer benefit.
- Resource reason: width variants hit Vercel Image Optimization rather than immutable public-file delivery.
- Vercel metrics: Image Optimization Transformations and Image Optimization Cache Reads.
- Relative impact: medium relative to the app's image quota, low relative to total compute.
- Change risk: low.
- Recommendation: mark these known tiny local assets `unoptimized`; keep user-uploaded Cloudinary images on direct CDN delivery and do not disable optimization globally.

### M3. Admin award roster can invoke one function per 100 employees

- Files/code: `app/admin/points/page.tsx` `loadAllEmployees`; `app/api/admin/employees/route.ts`.
- Problem: the picker pages through the full admin employee DTO, including unused dates and identifiers, and repeats the count query on every page.
- Resource reason: extra function invocations, auth checks, database counts, and payload fields.
- Vercel metrics: Function Invocations, Fluid Active CPU, Fast Origin Transfer.
- Relative impact: medium when headcount exceeds 100.
- Change risk: low with a role-gated, bounded picker response.
- Recommendation: add an explicit `picker=true` shape capped at 500 with only id, name, email, balance, role, and department; fetch once.

### M4. Admin analytics performs a large query fan-out and JS aggregation

- File/code: `app/api/admin/analytics/route.ts` runs about 18 parallel reads and aggregates daily point/redemption rows in JavaScript.
- Problem: one admin overview visit creates a high-memory, high-query function.
- Resource reason: many concurrent DB operations and raw row materialization.
- Vercel metrics: Fluid Active CPU, Fluid Provisioned Memory, Fast Origin Transfer.
- Relative impact: medium because the page is privileged and lower traffic.
- Change risk: medium to high; financial/admin metrics must remain exact.
- Recommendation: when traffic grows, move daily chart grouping to SQL and measure query latency. Do not cache confidential analytics globally.

### M5. Employee roster search is bounded but still client-filtered

- File/code: `app/api/employees/route.ts` returns up to 500; feed and minigame invite filter locally.
- Problem: payload and query grow with headcount.
- Resource reason: larger JSON responses and browser memory.
- Vercel metrics: Fast Origin Transfer, Fast Data Transfer, function memory.
- Relative impact: medium at larger headcount.
- Change risk: medium because recipient completeness and fast local search are user-visible.
- Recommendation: defer initial loading now; migrate to debounced `?q=` typeahead only when roster size or measured transfer justifies it.

### M6. Sentry build configuration emits deprecation/action warnings

- Files/code: `next.config.ts` uses deprecated `disableLogger`; `instrumentation-client.ts` omits the navigation transition hook.
- Problem: not currently a Vercel-usage multiplier, but configuration drift can compromise monitoring or tree-shaking.
- Vercel metrics: primarily Fast Data Transfer and observability quality.
- Relative impact: low to medium.
- Change risk: medium; monitoring must not be silently weakened.
- Recommendation: update in a dedicated Sentry configuration change after checking the installed SDK guidance.

## LOW

### L1. Public global settings are read dynamically

- Files/code: `/api/settings`, `/api/admin/settings`, and `lib/settings/appSettings.ts`.
- Problem: the Ally enabled flag performs a database read on the first dashboard mount and again in chat.
- Resource reason: small repeated DB reads.
- Vercel metrics: Fluid Active CPU and database requests; function count is unchanged.
- Relative impact: low.
- Change risk: medium because admin changes must be visible promptly across instances.
- Recommendation: consider a tagged cache with explicit invalidation later; do not add an ad-hoc process-local cache on serverless.

### L2. Many pages are broad Client Components

- Files/code: dashboard/admin layouts and most feature pages begin with `"use client"`.
- Problem: significant client JavaScript and hydration.
- Resource reason: Fast Data Transfer and browser work, not primarily serverless usage.
- Vercel metrics: Fast Data Transfer.
- Relative impact: medium in aggregate, but each conversion is a maintainability project.
- Change risk: high for interactive pages.
- Recommendation: refactor only when touching individual screens; preserve the current static shell classification.

## ALREADY GOOD

- The Proxy is intentionally a cheap cookie-presence UX redirect; route handlers retain real bearer-token authorization.
- API routes are excluded from Proxy, avoiding redirects and duplicate edge work for authenticated API calls.
- The production build prerenders most UI routes as static shells. Authenticated or sensitive data is not globally cached.
- No ISR is used, so there are no current ISR reads.
- Cloudinary uploads go browser-to-Cloudinary after a small signing request; image bytes do not transit Vercel functions.
- Remote/user images mostly use direct `<img>` CDN delivery, avoiding unbounded Vercel transformations.
- Feed queries paginate to 15 posts, aggregate reaction counts in the database, and fetch current-user votes/reactions selectively.
- Food seller orders are batched rather than queried per listing.
- Admin lists use pagination and selective columns; the employee sync and milestone cron paths already batch writes.
- Database indexes cover the major notification, feed, audit, points, redemption, feedback, and game-session access patterns.
- Realtime uses one browser Supabase client, disconnects hidden tabs after a grace period, and resyncs on wake.
- Notification side effects are centralized once despite three visual bell instances.
- Recharts and ExcelJS remain route/server scoped rather than global client imports.
- Cron jobs run only once daily each and fail closed when their secret is missing or invalid.

## Safe implementation set selected

1. Remove duplicate `/api/me` calls from feed, marketplace, and leaderboard by using AuthProvider state.
2. Defer the feed employee roster until the composer opens.
3. Lengthen, but retain, visibility-aware realtime fallback polling.
4. Exclude common static image extensions from Proxy.
5. Mark only the tiny local brand images as unoptimized.
6. Add a bounded admin award-picker response to replace multi-page roster fan-out.

The auth bootstrap consolidation, global SDK loading changes, confidential analytics aggregation, and server cache additions are intentionally not part of the automatic patch because their security/correctness risk is disproportionate to an unmeasured optimization.

## Realtime expansion implemented

The application now uses Supabase Realtime as a scoped invalidation layer for shared application data, not only notifications and minigames. PostgreSQL/Prisma remains the single source of truth. Browsers receive empty `update` pings and then re-fetch through the existing Firebase-authenticated API, so database rows, secrets, authorization decisions, and privileged credentials are never sent over Realtime.

### Coverage

- Public/shared scopes: feed, leaderboards, employees, departments, rewards, food, medicine inventory, settings, documents, milestones, minigame statistics, and non-confidential admin counters.
- Per-user scopes: profile/points/badges, redemption history, medicine requests, notification preferences, and existing notifications.
- Admin scopes: redemption queue, medicine request queue, points transactions, analytics, and audit activity.
- Confidential feedback: HMAC-derived opaque user, admin, and thread topics are returned only after the normal API authorization check. Feedback content is never broadcast.

Mutation routes batch related invalidations into one Supabase HTTP broadcast request. Client screens share one browser Supabase client/WebSocket and debounce related events into one authenticated refresh. A reconnect or tab wake triggers an authoritative resync to recover events missed while disconnected.

### Freshness and invalidation

- Cache scope: no server data cache was added. Existing page/API data remains request-scoped or component-scoped.
- Invalidation: successful application mutations emit the relevant scope pings after the response via Next.js `after()`.
- Expected freshness: normally near-real-time; authoritative state is recovered on reconnect, tab wake, navigation, or the existing slow fallback polling retained for notifications and active minigames.
- Security: pings contain no records or user content. Every refresh still passes Firebase authentication, role checks, tenant/data filters, and existing validation. No service-role credential is exposed to the browser.

### Vercel and Supabase tradeoff

Realtime does not eliminate the authenticated API refresh after a change; it replaces blind repeated polling with event-driven refreshes. This should reduce idle Vercel function/database traffic where polling would otherwise be needed, while increasing Supabase Realtime connections and message volume. Broadcasts are intentionally emitted by application mutation routes rather than database triggers, so manual/out-of-band database changes do not produce an immediate ping; normal resync paths still recover the current database state.

Bulk point awards can create many per-user invalidations in one request. This is correct but is the likeliest Realtime message-rate pressure point as headcount grows and should be measured against the active Supabase plan before adding any broader database-trigger fan-out.

# VERCEL HOBBY OPTIMIZATION REPORT

## 1. Original Architecture

The application used statically prerendered client shells backed by Firebase-authenticated Vercel route handlers and Prisma/PostgreSQL. Supabase Realtime was limited mainly to notifications, profile points, and minigames. Several screens repeated `/api/me`, roster loading, or background polling even when nothing changed. Proxy matched more static-file requests than necessary, and tiny local brand images used Vercel Image Optimization.

## 2. Problems Found

The meaningful issues were duplicate authenticated bootstrap/profile calls, polling while data was unchanged, eager employee-roster loading, a multi-request admin award picker, avoidable Proxy execution for static assets, tiny local image transformations, and no consistent invalidation mechanism for most shared screens. Higher-risk opportunities remain in login bootstrap consolidation, analytics query fan-out, and broad client bundles; those were not changed automatically.

## 3. Changes Made

- Duplicate `/api/me` calls were removed from feed, marketplace, and leaderboard in favor of the already-authoritative AuthProvider state.
- The feed employee roster is loaded only when the composer needs it.
- Notifications and minigame fallback polling remain as recovery mechanisms but run less aggressively and respect visibility.
- Proxy excludes common static image/file extensions without weakening API or page authorization.
- Only small immutable local brand assets bypass Vercel Image Optimization; uploaded/user media behavior is unchanged.
- The admin award picker uses one bounded, selective employee response instead of paging through full employee DTOs.
- Shared feature mutations now emit batched, empty Supabase invalidation pings. Relevant open screens debounce those pings and refresh through their existing authorized APIs.
- Reconnect and tab-wake resyncs recover authoritative state without constant polling.
- Confidential feedback uses server-derived opaque topics and never places feedback content in Realtime payloads.

## 4. Expected Impact

| Metric | Expected impact | Reason |
| --- | --- | --- |
| Fluid Active CPU | moderate reduction | fewer duplicate/polling requests; broadcasts are small and batched |
| Edge Requests | small reduction | static files bypass Proxy more consistently |
| Function Invocations | moderate reduction during idle/read-heavy use | repeated polling/bootstrap calls decrease; write-heavy fan-out can still trigger one authorized refresh per active listener |
| Fluid Provisioned Memory | small reduction | smaller picker payloads and fewer overlapping calls; major analytics memory work is unchanged |
| Fast Origin Transfer | moderate reduction | fewer repeated API responses and smaller roster payloads |
| Image Optimization Transformations | small reduction | tiny local brand variants bypass the optimizer |
| Fast Data Transfer | small to moderate reduction | fewer duplicate JSON responses and image variants; application bundles are mostly unchanged |
| ISR Reads | unchanged | the application still does not use ISR |
| Edge Request CPU Duration | small reduction | fewer static requests reach Proxy; Proxy logic remains intentionally minimal |

Supabase Realtime connection and message usage will increase. The design optimizes Vercel by avoiding idle polling, not by pretending updates are free.

## 5. Remaining Optimization Opportunities

### Worth doing now

- Resolve the current `nanoid` production dependency advisory through compatible upstream package updates once a lockfile change can be reviewed independently.
- Measure Supabase message volume during bulk point awards and large active-user sessions.

### Worth doing when traffic grows

- Consolidate the login/session/profile bootstrap with dedicated auth regression tests.
- Move admin analytics grouping into SQL after profiling query and memory cost.
- Add server-side employee search when the roster approaches the current bounded response size.
- Adopt Supabase-authenticated private Broadcast channels if Firebase-to-Supabase third-party auth and Realtime authorization policies are deliberately configured.

### Not worth the complexity now

- Database triggers for every table, a second cache/database, globally cached authenticated data, or converting interactive screens wholesale to Server Components.
- Automatic background polling on every screen; reconnect/tab-wake recovery is a better free-tier tradeoff.

## 6. Vercel Hobby Risks

Function invocations and origin transfer remain the most likely Vercel limits as active users grow because every authoritative refresh still passes through a secured route handler. High-write fan-out screens—feed, points, leaderboards, and admin analytics—are the main pressure points. Image optimization and ISR are lower risks because remote media is mostly direct-CDN and ISR is unused.

## 7. Scaling Strategy Without Vercel Pro

Keep PostgreSQL as the single source of truth, use one scoped Supabase socket per browser, broadcast only invalidations, batch related events, and fetch only the data required by the currently open screen. Continue direct-to-Cloudinary uploads and static shell delivery. As traffic grows, optimize expensive database queries and pagination before adding infrastructure. If write fan-out becomes high, coarsen invalidation scopes or refresh only visible data rather than introducing short polling.

## 8. Verification Performed

- TypeScript: passed (`npx tsc --noEmit`).
- ESLint: passed with 0 errors and 28 pre-existing-style warnings (`<img>` guidance and minigame hook dependency warnings).
- Tests: 4 files and 28 tests passed.
- Production build: passed on Next.js 16.3.0; static/dynamic route classification remained appropriate and no ISR was introduced.
- Security review: no row/user content is broadcast, authorized APIs remain authoritative, confidential feedback topics are opaque, no new browser secret exposure was found, and added-line secret/debug scanning was clean.
- Dependency audit: 10 transitive production findings (1 high `nanoid`, 9 moderate `uuid`). Automatic fixes were not applied because the reported full `uuid` fix includes a breaking ExcelJS downgrade and the advisories are unrelated to this realtime patch.
- Git review: complete working diff inspected, `git diff --check` passed, no commit created.

## 9. Files Changed

Realtime foundations: `lib/realtime/broadcast.ts`, `lib/realtime/topics.ts`, `lib/realtime/confidentialTopics.ts`, `lib/hooks/useRealtimeChannel.ts`, `lib/auth/AuthProvider.tsx`, `lib/helpers/checkLevelUp.ts`, and `lib/helpers/checkAndAwardBadges.ts`.

Realtime client consumers: onboarding; employee detail; feed; feedback; food; leaderboard; marketplace; medicine; minigame stats/profile cards; profile notification preferences; Ally settings; and the admin audit, departments, documents, employees, feedback, medicine, milestones, overview, points, redemptions, and rewards screens.

Realtime mutation producers: the changed routes under `app/api/admin/{attendance,bootstrap,departments,documents,employees,feedback,medicine,milestones,settings,users}`, `app/api/auth/{onboarding,sync}`, `app/api/cron/{birthdays,milestones}`, `app/api/feed`, `app/api/feedback`, `app/api/food`, `app/api/me`, `app/api/medicine`, `app/api/minigames/sessions`, `app/api/notifications`, `app/api/points`, `app/api/redemptions`, and `app/api/rewards`.

Earlier low-risk Hobby optimizations: `proxy.ts`, the dashboard/admin/login/not-found brand-image call sites, `components/feed/PostImages.tsx`, `components/notifications/NotificationsController.tsx`, `lib/hooks/useFeedActions.ts`, `app/admin/points/page.tsx`, `app/admin/points/types.ts`, and `app/api/admin/employees/route.ts`.

The working tree also contains the concurrent feed-revamp branch's component/UI edits. They were preserved and not attributed to this optimization work.
