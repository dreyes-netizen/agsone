# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project

**AGS One** — an internal employee engagement and rewards platform for Alliance Global Solutions. Employees earn points (attendance, tasks, KPIs, peer recognition) and spend them in a rewards marketplace. One shell hosts a social feed, minigames, a food-ordering board, a medicine request board, and HR admin workflows (employees, feedback, redemptions, audit logs, milestones). See `PRODUCT.md` for users/purpose and `DESIGN.md` (+ `.impeccable/design.json`) for the visual design system (colors, type scale, spacing, radii — style is `base-nova` shadcn, base color `neutral`).

## Stack

Next.js 16 (App Router) + React 19 + TypeScript (strict) + Tailwind v4 + shadcn/ui. Prisma 7 (`prisma-client` generator, client output to `lib/generated/prisma`, **not** the default location) over Postgres via `@prisma/adapter-pg`. Auth is Firebase Auth (client SDK + `firebase-admin`), not NextAuth/Supabase Auth. Supabase is used only for Postgres hosting, file storage, and Realtime broadcast — not auth. Deployed to Vercel, region `syd1`.

## Commands

```bash
npm install               # also runs `prisma generate` via postinstall
npm run dev               # next dev -p 3010 — 3000 is taken by an unrelated local Chatwoot/Docker container on this machine
npm run build             # prisma generate && next build
npm run start
npm run lint               # eslint (flat config: eslint-config-next core-web-vitals + typescript)
npm test                   # Vitest unit/route/component-boundary suite
npm run test:watch         # Vitest watch mode
npm run setup:hooks         # installs the secret/PII-blocking pre-commit hook (scripts/git-hooks/pre-commit)
npx prisma migrate dev      # apply/create a migration
npx prisma generate         # regenerate the client into lib/generated/prisma after schema.prisma changes (also runs automatically on npm install)
npx tsx prisma/seed.ts      # seed (also runs via `prisma db seed`)
```

Requires a `.env.local` with Firebase client/admin, `DATABASE_URL`, Supabase, Cloudinary, Groq, and Upstash Redis credentials — see the `process.env.*` reads across `lib/` and `app/api/` for the full list; there's no committed `.env.example`.

Vitest is the automated test runner; tests use the `**/*.test.ts` convention in a Node environment. Verify changes with focused Vitest tests, `npm test`, `npm run lint`, `npx tsc --noEmit`, and an authenticated browser pass when the flow depends on Firebase or live data. The repository has Playwright installed but no committed Playwright configuration or authenticated fixture yet; do not claim protected E2E coverage without one.

## Architecture

**Routing.** `app/` uses route groups: `(auth)` for `/login` and `/onboarding`, `(dashboard)` for the employee-facing app (dashboard, feed, marketplace, leaderboard, food, medicine, minigames, profile, feedback), `admin/` for HR/manager tooling, and `api/` for all backend routes. Middleware is named **`proxy.ts`**, not `middleware.ts` — this is a breaking convention change from stock Next.js (see `AGENTS.md`). `proxy.ts` only does a page-level redirect to `/login` based on the presence of a `firebase-token` cookie; it explicitly excludes `/api/*` so API routes can return their own JSON 401s. It is a UX convenience only, **not** the authorization boundary.

**Auth model — two layers, don't confuse them:**
1. `proxy.ts` — cookie presence check, page-level redirect only.
2. `verifyAuth(req)` (`lib/auth/verifyAuth.ts`) — the real authorization boundary, used at the top of every API route handler. Verifies the Firebase ID token from the `Authorization: Bearer` header via `adminAuth.verifyIdToken`, loads the matching `User` row, and rejects deactivated users (`isActive`) even though their Firebase token is still technically valid. Returns an `AuthUser` that deliberately omits `pointsBalance` (changes too fast to trust a request-time snapshot — see the double-spend comment in that file) and `isActive`. Pair with `requireRole(user, [...roles])` for role gating. Roles: `EMPLOYEE < MANAGER < HR_ADMIN < SUPER_ADMIN` (`lib/constants/roles.ts`).
3. Shared-secret headers for non-user callers, not Firebase-backed: `/api/cron/*` (Vercel Cron, scheduled in `vercel.json`) checks `Authorization: Bearer $CRON_SECRET`; `/api/admin/bootstrap` (a one-time, self-disabling route that promotes the caller to `HR_ADMIN` — refuses once any `HR_ADMIN` exists) checks an `x-bootstrap-secret` header against `BOOTSTRAP_SECRET`. Both compare via `timingSafeCompare` (`lib/auth/timingSafeCompare.ts`), not `===`, to avoid a timing side-channel on the secret.

Client-side, all authenticated requests go through `apiFetch`/`streamFetch` (`lib/hooks/useApiClient.ts`), which attaches the Firebase ID token, retries once with a forced token refresh on a 401, and only signs the user out if Firebase itself has no session (avoids false-positive logouts on a transient endpoint error).

**API route conventions** (see `app/api/points/award/route.ts` as the reference example): `verifyAuth` → `requireRole` → `zod` schema `safeParse` → business validation → `prisma.$transaction` for anything that must be atomic (e.g. balance update + transaction row) → fire-and-forget side effects run concurrently via `Promise.all`/`.catch(() => {})` (notifications, feed posts, email, `broadcast()`) → `AuditLog` write. Success responses are `{ data: ... }`, errors are `{ error: ... }`.

**Data model** (`prisma/schema.prisma`) centers on the points economy: `User` → `PointTransaction` (typed: `MANUAL_AWARD`, `ATTENDANCE`, `TASK`, `KPI`, `CONTEST`, `REDEMPTION`, `GAME_WIN`/`GAME_SPEND`, `REFUND`, `MILESTONE`, `DEDUCTION`) drives `pointsBalance`; `Reward`/`Redemption` is the marketplace; `Badge`/`UserBadge` and levels are earned via `lib/helpers/checkAndAwardBadges.ts` / `checkLevelUp.ts`; manager award budgets are enforced by `lib/helpers/checkManagerBudget.ts`. Social feed (`SocialPost`/`SocialComment`/`SocialReaction`/`PollOption`/`PollVote`/`ShoutoutRecipient`) is a separate domain that cross-references points activity (e.g. an award auto-creates a `CELEBRATION` post). `GameSession` holds authoritative server-side state for realtime 1v1 minigames; `Game`/`GamePlay` are for the standalone reward-games (spin wheel, raffle, mystery box, quiz, prediction).

**Realtime.** `lib/realtime/broadcast.ts` sends an empty "something changed" ping over Supabase Realtime (stateless HTTP broadcast, not a websocket held open in the serverless function) so subscribed clients know to re-fetch through the normal authed API — game/points state itself is never put on the Realtime payload. `broadcast()` never throws; a slow client-side poll is the fallback if a broadcast is missed. Client side: `lib/hooks/useRealtimeChannel.ts`, `lib/realtime/tabState.ts` + `useTabState`/`useVisibleInterval` coordinate polling/subscriptions across tabs and visibility state. When a piece of state is read by multiple mounted instances of the same component (e.g. the notification bell renders in the desktop sidebar, mobile drawer, and mobile top bar simultaneously), hoist the fetch/poll/subscribe side effects into a shared `zustand` store (`lib/stores/notifications.ts`) instead of letting each instance run its own — otherwise every mount multiplies the request/subscription count.

**Minigames.** Multiplayer games (`battleship`, `connectfour`, `dotsandboxes`, `memory`, `rps`, `tictactoe`) each have a pure logic module under `lib/minigames/` and use the shared authoritative `GameSession` model; opponents' hidden state never reaches the other client. Solo Arcade (`typing`, `reaction`, `visual-memory`, `sequence-memory`) is separate under `lib/minigames/solo/`, with local-only Practice play and server-scored Ranked attempts (three starts per game per Manila day). Solo games never award or spend AGS Points. The client performs one ranked start request, local gameplay with no per-input requests, and one idempotent finish request; rankings, badges, and weekly championships are separate read/award paths.

**AI features.** `lib/rag/` (chunker/embedder/search) backs a policy-document assistant (`ChatSession`/`ChatMessage` models, `app/api/assistant`); providers are Groq (`lib/groq/client.ts`) and Google Generative AI. `lib/guardrails/jailbreak.ts` and `lib/guardrails/rateLimiter.ts` (Upstash) sit in front of the assistant.

**Storage/uploads.** Cloudinary is primary for user-uploaded images (`lib/cloudinary/upload.ts`); Supabase storage client also exists (`lib/supabase/storageClient.ts`) — check which a given feature actually uses before assuming.

**Email.** `nodemailer` + `lib/email/templates.ts`; sends are fire-and-forget from API routes, not queued.

**Constants over enums-in-code.** Domain vocabularies that aren't Prisma enums live as typed const objects/arrays in `lib/constants/` (`awardActivities`, `feedbackCategories`, `redemptionStatus`, `stock`, `auditActions`) — check there before hardcoding a string literal that looks like a status or category.

**Security headers/CSP** are centralized in `next.config.ts` (`headers()`); when adding a new external domain (image host, API, auth popup), update the relevant CSP directive there rather than working around it client-side.

**Secrets hygiene.** `scripts/git-hooks/pre-commit` blocks commits containing private keys, Supabase/Firebase/Cloudinary/Groq secret patterns, and blocks `.xlsx/.xls/.csv/.pdf/.pem/.p12/.pfx/.key` files and known sensitive filenames (`.env`, `firebase-service-account.json`, etc). Install it with `npm run setup:hooks` — it is not installed by default (lives outside `.git/hooks`).

## Feature history

`docs/superpowers/plans/` and `docs/superpowers/specs/` contain the plan + design doc for most major features (food board, shoutouts, milestone rewards, feedback, department challenges, AI assistant, medicine section, minigames polish, etc.), dated. Check there for the reasoning behind a feature's shape before assuming current behavior is incidental.
