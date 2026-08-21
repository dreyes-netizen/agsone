# AGS Arcade Solo Games V1 — Design and Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add four lightweight single-player ranked games to AGS One with practice mode, three ranked attempts per game per day, personal bests, company/department leaderboards, achievement badges, and permanent weekly champion records — without touching the existing AGS Points economy.

**Architecture:** Keep the existing realtime 1v1 `GameSession` subsystem unchanged. Add a parallel Solo Arcade domain built around server-issued ranked attempts and server-recomputed scores. Practice gameplay is browser-only; ranked gameplay uses exactly one start request and one finish request per completed attempt. Solo game code is first-party React/TypeScript and is lazy-loaded; no game engine is added.

**Tech Stack:** Existing Next.js 16.3, React 19.2, TypeScript, Tailwind CSS 4, Prisma 7 + PostgreSQL, Firebase Auth, Supabase Realtime where already appropriate, Upstash rate limiting, Vitest, Playwright, existing `canvas-confetti`.

**Spec:** This document, section **Approved Product and Architecture Specification**.

## Global Constraints

- Keep existing multiplayer `GameSession`, multiplayer W/L/D stats, wager flow, realtime topics, and minigame move APIs functionally unchanged.
- V1 solo games: `TYPING`, `REACTION`, `VISUAL_MEMORY`, `SEQUENCE_MEMORY`.
- Practice is unlimited and does not create database rows or API writes.
- Ranked mode allows **3 attempts per game per employee per Philippine calendar day**.
- A ranked attempt is consumed when it starts, including refresh, close, disconnect, or abandonment.
- Official timezone is **`Asia/Manila`**.
- Leaderboard scopes: **Company** and **Department**.
- Leaderboard periods: **This Week** and **All-Time**.
- Only the employee's **best valid ranked attempt** counts for each leaderboard period.
- No AGS Points, marketplace credits, `PointTransaction`, wagers, or Arcade XP are awarded by solo games.
- Achievement badges are permanent; weekly champion records are repeatable historical awards.
- Weekly champion records: **#1 Company + #1 per Department, per game, per week**.
- Champion recognition appears only in Minigames/Arcade and Profile; no automatic Feed posts in V1.
- Ranked anti-cheat is **casual leaderboard integrity**, not a prize-grade anti-cheat system.
- No keystroke-by-keystroke, click-by-click, or frame-by-frame network requests.
- No new game framework or game-specific runtime npm dependency in V1.
- Lazy-load each solo game so unrelated AGS One pages and other games do not ship all solo-game code.
- Respect existing AGS design rules: flat/familiar UI, earned gamification, WCAG AA, keyboard accessibility, focus states, reduced motion.
- Before modifying Next.js behavior, the implementing agent must follow `AGENTS.md` and read the applicable installed Next.js documentation in `node_modules/next/dist/docs`.
- Run Vitest, ESLint, TypeScript/build verification, and targeted Playwright/manual browser verification before completion.
- Use TDD for scoring, time-window, attempt-limit, validation, ranking, badge, and champion logic.
- Do not modify GitHub/repository data from this planning artifact; implementation happens in the user's working repo/worktree.

---

# Approved Product and Architecture Specification

## 1. Product Rules Locked During Brainstorming

### 1.1 Progression and rewards

Solo games have:

- game-native scores;
- ranked personal bests;
- company rankings;
- department rankings;
- achievement badges;
- permanent weekly champion history.

Solo games do **not** have:

- AGS Points;
- marketplace spendable rewards;
- Arcade XP in V1;
- automatic Feed announcements.

This separation is intentional. A manipulated browser-game result can affect a recreational leaderboard, but it must never affect the employee's spendable AGS Points balance.

### 1.2 Practice vs Ranked

**Practice**
- Unlimited.
- Browser-only.
- No ranked-attempt consumption.
- No server score submission.
- No leaderboard effect.
- May keep a device-local practice best in `localStorage`.
- The official personal best displayed by AGS One is always the ranked personal best.

**Ranked**
- Three starts per game per employee per Philippine day.
- Attempt is consumed at `POST /start`, not at completion.
- Same standardized ranked rules for everyone.
- Server issues an `attemptId` and deterministic challenge seed/reference.
- Game runs locally.
- Client submits the final evidence once.
- Server recomputes/validates the official score.
- Best valid attempt counts.

### 1.3 Time windows

Official timezone: `Asia/Manila`.

At attempt creation the server computes and stores:
- `rankDate`: the Philippine local calendar date as PostgreSQL `DATE`;
- `weekStart`: the Monday of that Philippine local week as PostgreSQL `DATE`.

This prevents browser timezone differences and removes complicated timezone math from leaderboard queries.

Daily attempt reset:
- 12:00 AM Philippine Time.

Weekly ranking:
- Monday through Sunday Philippine Time.

An attempt belongs to the day/week in which it **started**, even if it finishes after midnight.

### 1.4 Leaderboards

Each game exposes:

- Company / This Week
- Company / All-Time
- Department / This Week
- Department / All-Time

Ranking uses one best valid ranked attempt per employee per selected period.

Department membership is snapshotted on the attempt at start time. A later department transfer must not retroactively move an old score to another department.

API should return:
- top 50 rows;
- current user's row/rank even if outside top 50;
- current user's ranked personal best;
- selected period/scope metadata.

Do not display bottom-performer lists.

### 1.5 Weekly champions

After a week closes:

- #1 Company for each game receives a Company Champion historical record.
- #1 in every department with at least one valid score receives a Department Champion historical record.
- Company Champion can also be their Department Champion.
- Awards are recognition only.
- Awards are historical/repeatable; the same employee may win the same title many weeks.

V1 uses **lazy idempotent finalization** rather than a Vercel cron:
- when a relevant Solo Arcade summary/leaderboard/champion endpoint is read after a week closes, call `finalizePreviousWeekIfNeeded()`;
- insert all winners in one transaction;
- unique constraints make retries safe;
- if no one played during a week, repeated no-op finalization is acceptable and cheap.

This avoids introducing recurring serverless work just to maintain recreational rankings.

---

## 2. Architecture Boundary

```text
/minigames
│
├── Existing Multiplayer Domain                  NEW Solo Arcade Domain
│   ├── GameSession                              ├── SoloGameAttempt
│   ├── /api/minigames/sessions                  ├── /api/minigames/solo/attempts/start
│   ├── /api/minigames/sessions/[id]/move        ├── /api/minigames/solo/attempts/[id]/finish
│   ├── W/L/D stats                              ├── /api/minigames/solo/summary
│   ├── W/L/D leaderboard                        ├── /api/minigames/solo/leaderboard
│   └── wager / AGS Points                       ├── /api/minigames/solo/champions
│                                                 ├── ranked PBs
│                                                 ├── achievement badges
│                                                 └── weekly champion history
│
└── Shared Minigames landing/profile presentation only
```

Do not generalize the working multiplayer subsystem into a universal competition engine in V1. The scoring semantics are fundamentally different:
- multiplayer: winner/loser/draw;
- solo: WPM, milliseconds, memory level, sequence length.

Do not reuse `Game` / `GamePlay` for Solo Arcade. Those models already represent another standalone reward-game concept and would make semantics muddy.

---

## 3. Database Design

### 3.1 `SoloGameAttempt`

Recommended Prisma shape:

```prisma
enum SoloAttemptStatus {
  STARTED
  COMPLETED
  EXPIRED
}

model SoloGameAttempt {
  id              String            @id @default(uuid())
  userId          String
  departmentId    String?
  gameType        String
  status          SoloAttemptStatus @default(STARTED)
  attemptNumber   Int

  // Company-local date keys, stored without timezone semantics.
  rankDate        DateTime          @db.Date
  weekStart       DateTime          @db.Date

  // Minimal deterministic challenge descriptor:
  // e.g. { "version": 1, "seed": 1234, "passageId": "typing-017" }
  challenge       Json
  challengeVersion Int             @default(1)

  startedAt       DateTime          @default(now())
  expiresAt       DateTime
  completedAt     DateTime?

  primaryScore    Int?
  secondaryScore  Int?
  metrics         Json?
  isValid         Boolean           @default(false)
  validationReason String?

  user            User              @relation(fields: [userId], references: [id], onDelete: Cascade)
  department      Department?       @relation(fields: [departmentId], references: [id], onDelete: SetNull)

  @@unique([userId, gameType, rankDate, attemptNumber])
  @@index([gameType, status, weekStart])
  @@index([userId, gameType, completedAt])
  @@index([departmentId, gameType, weekStart])
}
```

Migration SQL should add a database check:

```sql
ALTER TABLE "SoloGameAttempt"
ADD CONSTRAINT "SoloGameAttempt_attemptNumber_check"
CHECK ("attemptNumber" BETWEEN 1 AND 3);
```

The unique key plus the check constraint prevents more than three numbered slots per user/game/day even under concurrent requests.

Do not persist Practice attempts.

### 3.2 `ArcadeWeeklyChampion`

```prisma
enum ArcadeChampionScope {
  COMPANY
  DEPARTMENT
}

model ArcadeWeeklyChampion {
  id                     String               @id @default(uuid())
  userId                 String
  gameType               String
  scope                  ArcadeChampionScope
  scopeKey               String
  departmentId           String?
  departmentNameSnapshot String?
  weekStart              DateTime             @db.Date

  winningAttemptId       String
  primaryScore           Int
  secondaryScore         Int?
  awardedAt              DateTime             @default(now())

  user                   User                 @relation(fields: [userId], references: [id], onDelete: Cascade)
  department             Department?          @relation(fields: [departmentId], references: [id], onDelete: SetNull)
  winningAttempt         SoloGameAttempt       @relation(fields: [winningAttemptId], references: [id], onDelete: Restrict)

  @@unique([gameType, scopeKey, weekStart])
  @@index([userId, weekStart])
  @@index([weekStart, gameType])
}
```

`scopeKey` is deliberate:
- Company: `"company"`
- Department: `"department:<departmentId>"`

Do not rely on a compound unique index containing nullable `departmentId`; PostgreSQL permits multiple `NULL` values in ordinary unique constraints.

### 3.3 Existing `Badge` / `UserBadge`

Keep the existing one-time achievement mechanism.

Do not represent repeatable weekly championships as `UserBadge`, because `UserBadge` is unique by `(userId, badgeId)`.

Add reverse relations to `User` / `Department` / `SoloGameAttempt` as required by Prisma.

---

## 4. Game Registry and Score Semantics

Create one server-safe registry containing static metadata and ranking direction. Keep React icons/UI metadata in a separate client-safe constant module if necessary.

Canonical V1 keys:

```ts
export type SoloGameType =
  | "TYPING"
  | "REACTION"
  | "VISUAL_MEMORY"
  | "SEQUENCE_MEMORY";
```

Routes use slugs:

```text
typing
reaction
visual-memory
sequence-memory
```

### 4.1 Typing Sprint

Ranked rules:
- Fixed 60 seconds.
- Server chooses an internal passage ID.
- Paste/cut/drop disabled in the UI.
- Server recomputes metrics from submitted typed text and canonical passage.
- `primaryScore`: WPM integer.
- `secondaryScore`: accuracy in basis points (`9850` = `98.50%`).
- Ranked score is eligible only when accuracy is at least `9500` (95%).
- Higher WPM wins.
- Tie: higher accuracy, then earlier completion.

Server score:

```text
correctChars = character positions matching the target passage
typedChars   = submitted typed characters
minutes      = authoritative elapsed seconds / 60
WPM          = floor((correctChars / 5) / minutes)
accuracyBp   = round((correctChars / max(typedChars, 1)) * 10000)
```

The server must clamp authoritative elapsed time to the ranked 60-second rules and compare request arrival time to `startedAt`. Do not trust a client-provided WPM.

### 4.2 Reaction Rush

Ranked rules:
- Five trials.
- Seeded random wait windows.
- Client submits five reaction values plus false-start count.
- `primaryScore`: rounded average reaction milliseconds.
- `secondaryScore`: total elapsed milliseconds for deterministic tie-breaking only if needed.
- Lower primary score wins.
- Tie: lower secondary score, then earlier completion.
- Values below a conservative plausibility floor (e.g. 100 ms) invalidate the attempt.
- A false start records a 1000 ms value for that trial instead of allowing infinite free retries.

This is a recreational integrity rule, not a medical/cognitive assessment.

### 4.3 Visual Memory

Ranked rules:
- Deterministic seeded board patterns.
- Increasing levels.
- Client submits compact per-level answers/outcomes.
- Server reconstructs expected patterns and verifies the submitted evidence.
- `primaryScore`: highest completed level.
- `secondaryScore`: elapsed milliseconds.
- Higher level wins.
- Tie: lower elapsed time, then earlier completion.

### 4.4 Sequence Memory

Ranked rules:
- Deterministic seeded sequence.
- Client submits compact sequence responses.
- Server reconstructs the expected sequence and verifies progression.
- `primaryScore`: longest completed sequence/level.
- `secondaryScore`: elapsed milliseconds.
- Higher primary wins.
- Tie: lower elapsed time, then earlier completion.

---

## 5. Anti-Cheat Boundary

V1 deliberately aims for **casual leaderboard integrity**.

It protects against:
- changing a WPM field in DevTools;
- submitting a fourth ranked attempt;
- replaying a completed attempt;
- finishing another user's attempt;
- posting scores after expiration;
- basic impossible reaction values;
- fabricated score totals that do not match submitted evidence;
- browser timezone manipulation.

It does **not** fully protect against:
- custom scripts that automate correct gameplay in the browser;
- a determined employee reverse-engineering seeded challenges;
- OS/browser-level input automation.

That level of security is not justified because V1 awards no money, spendable points, or prizes.

If AGS later attaches material rewards to game results, create a separate hardening project before enabling those rewards.

---

## 6. API Contract

### `POST /api/minigames/solo/attempts/start`

Input:

```json
{ "gameType": "TYPING" }
```

Server:
1. `verifyAuth`.
2. dedicated `arcade` rate limit.
3. validate game key.
4. calculate Manila `rankDate` and `weekStart`.
5. snapshot current `departmentId`.
6. count/find occupied attempt numbers for user/game/date.
7. allocate next slot 1..3.
8. create minimal deterministic challenge.
9. create `SoloGameAttempt`.
10. return only challenge data needed by the client.

Success:

```json
{
  "data": {
    "attemptId": "uuid",
    "gameType": "TYPING",
    "attemptNumber": 2,
    "attemptsRemaining": 1,
    "expiresAt": "ISO",
    "challenge": {
      "version": 1,
      "passageId": "typing-017",
      "text": "..."
    }
  }
}
```

Limit reached: HTTP `429`.

### `POST /api/minigames/solo/attempts/:id/finish`

Input is game-specific evidence, not a claimed official score.

Typing example:

```json
{
  "typedText": "The submitted partial text...",
  "clientElapsedMs": 60012
}
```

Server:
1. authenticate;
2. rate limit;
3. fetch attempt by id and user;
4. if already completed, return the stored result idempotently;
5. reject/expire if past `expiresAt`;
6. validate evidence with game engine;
7. compute official scores;
8. atomically transition STARTED -> COMPLETED;
9. award any one-time achievement badges idempotently;
10. return score, PB comparison, attempts remaining.

### `GET /api/minigames/solo/summary?gameType=TYPING`

Returns:
- today's starts / remaining starts;
- ranked PB;
- this-week company rank;
- this-week department rank;
- all-time company rank;
- all-time department rank;
- recent valid ranked attempts;
- recently earned solo achievement badges if useful.

### `GET /api/minigames/solo/leaderboard`

Query:

```text
gameType=TYPING
period=week|alltime
scope=company|department
```

Returns top 50 plus current user row.

### `GET /api/minigames/solo/champions`

Returns:
- current user's championship history;
- optional recent company champions for Arcade presentation.

No realtime socket is required for Solo Arcade V1. A leaderboard refresh after score completion is sufficient and avoids a new realtime invalidation stream.

---

## 7. Badge Set for V1

Keep the set small and understandable.

General:
- `Arcade Debut` — complete first valid ranked solo attempt.
- `Arcade All-Rounder` — complete at least one valid ranked attempt in all four V1 games.

Typing:
- `Typing 50` — >=50 WPM and >=95% accuracy.
- `Typing 80` — >=80 WPM and >=95% accuracy.
- `Typing 100` — >=100 WPM and >=95% accuracy.

Reaction:
- `Quick Reflexes` — <=300 ms.
- `Fast Reflexes` — <=250 ms.
- `Lightning Reflexes` — <=200 ms.

Visual Memory:
- `Visual Memory 5` — complete level 5.
- `Visual Memory 8` — complete level 8.
- `Visual Memory 10` — complete level 10.

Sequence Memory:
- `Sequence 5` — complete sequence/level 5.
- `Sequence 8` — complete sequence/level 8.
- `Sequence 10` — complete sequence/level 10.

Badge evaluation is server-side after a valid ranked completion.

Badge creation should be an idempotent sync operation, not a runtime "create badge if missing" side effect.

---

# Open-Source Research and Dependency Decision

Research reviewed on 2026-08-20.

## Recommended references

### 1. HaltType
Repository: https://github.com/artistatbl/halttype

- MIT.
- Next.js 15, React 19, TypeScript, Tailwind/Radix.
- 60-second typing modes, WPM/accuracy, multiple languages and typing options.
- Good reference for typing UX, caret/error presentation, and score concepts.
- Low adoption, so treat it as source inspiration rather than a production dependency.

**Decision:** Reference only. Reimplement AGS-specific typing engine/UI. Do not install the project.

### 2. HumanEval
Repository: https://github.com/ShaikhWarsi/HumanEval

- MIT.
- Next.js + TypeScript + Tailwind + shadcn.
- Includes Reaction Time, Sequence Memory, Visual Memory, Typing Test, Aim Trainer and other cognitive games.
- Its file decomposition is useful for understanding isolated game components.

**Decision:** Best reference for Reaction Rush, Visual Memory and Sequence Memory mechanics. Reimplement inside AGS One; no package/dependency.

### 3. MentalMint / `tusharv/mini-games`
Repository: https://github.com/tusharv/mini-games

- MIT.
- Next.js 14 + TypeScript + Tailwind.
- Includes Memory Flip, Tap Master and score/personal-best ideas.

**Decision:** Secondary reference only.

## Reference-only because of copyleft licensing

### Monkeytype
Repository: https://github.com/monkeytypegame/monkeytype

- Mature typing product with excellent typing UX and extensive score/history behavior.
- GPL-3.0.

**Decision:** Use for product/UX study only. Do not copy source into AGS One under this plan.

### FreeFocusGames
Repository: https://github.com/loethen/freefocusgames

- Next.js 15 + TypeScript cognitive games including reaction time and block memory.
- AGPL-3.0.

**Decision:** Product/mechanics study only. Do not copy source into AGS One.

## Game engine considered and rejected for V1

### Phaser
Repository: https://github.com/phaserjs/phaser

- MIT.
- Mature 2D Canvas/WebGL game framework.
- Current repository documents a full minified build around 345 KB gzip.

**Decision:** Do **not** install Phaser for Typing, Reaction, Visual Memory or Sequence Memory. React state + timers + CSS/grid rendering are enough. Reconsider Phaser only for future sprite/physics/canvas-heavy games such as endless runners, brick breakers, platformers or action games.

## Licensing rule for implementation

Default implementation rule: study the behavior, then write AGS-native code.

If an implementer copies a non-trivial portion of MIT-licensed source instead of independently implementing the mechanics:
1. preserve the required copyright/license notice;
2. record the source repository and file;
3. add/update `THIRD_PARTY_NOTICES.md`;
4. do not copy repository art, sounds, icons or other assets unless their asset license is explicitly compatible.

Do not copy GPL/AGPL code into this V1 implementation.

## Dependency outcome

**New game runtime dependencies: 0.**

Reuse existing:
- React / Next.js;
- TypeScript;
- Tailwind;
- Lucide;
- existing `canvas-confetti` through AGS's existing helper;
- Prisma/PostgreSQL;
- Zod;
- Vitest;
- Playwright.

---

# File Structure to Create / Modify

The implementer should adjust exact filenames only when the existing repository pattern makes an equivalent location clearly better.

```text
app/
├── (dashboard)/minigames/
│   ├── page.tsx                                  # integrate Solo Games section
│   ├── solo/
│   │   └── [game]/
│   │       └── page.tsx                          # solo game route + lazy renderer
│   └── stats/
│       └── page.tsx                              # add Solo leaderboard view
│
└── api/minigames/solo/
    ├── attempts/
    │   ├── start/route.ts
    │   └── [id]/finish/route.ts
    ├── summary/route.ts
    ├── leaderboard/route.ts
    └── champions/route.ts

components/minigames/
├── MultiplayerLobby.tsx                          # optional extraction from existing page
└── solo/
    ├── SoloGameGrid.tsx
    ├── SoloGameShell.tsx
    ├── SoloResultPanel.tsx
    ├── SoloLeaderboardPanel.tsx
    ├── TypingGame.tsx
    ├── ReactionGame.tsx
    ├── VisualMemoryGame.tsx
    └── SequenceMemoryGame.tsx

lib/minigames/solo/
├── types.ts
├── registry.ts
├── time.ts
├── random.ts
├── attempts.ts
├── leaderboard.ts
├── badges.ts
├── champions.ts
├── typing.ts
├── typingPassages.ts
├── reaction.ts
├── visualMemory.ts
└── sequenceMemory.ts

lib/minigames/solo/*.test.ts

scripts/
└── sync-arcade-badges.ts

prisma/
├── schema.prisma
└── migrations/<timestamp>_solo_arcade_v1/migration.sql

app/(dashboard)/profile/
├── page.tsx
├── types.ts
└── components/
    ├── BadgesTab.tsx
    └── ArcadeChampionships.tsx

lib/guardrails/rateLimiter.ts
```

Avoid adding all four games into one giant component file.

---

# Implementation Plan

## Task 1: Establish Solo Arcade domain types, registry, deterministic random, and Manila date keys

**Files:**
- Create: `lib/minigames/solo/types.ts`
- Create: `lib/minigames/solo/registry.ts`
- Create: `lib/minigames/solo/random.ts`
- Create: `lib/minigames/solo/time.ts`
- Test: `lib/minigames/solo/random.test.ts`
- Test: `lib/minigames/solo/time.test.ts`

**Interfaces:**
- Produces `SoloGameType`, `SoloGameResult`, `SoloRankPeriod`, `SoloRankScope`.
- Produces `SOLO_GAME_REGISTRY`.
- Produces `createSeededRandom(seed)`.
- Produces `getManilaRankKeys(now)`.

- [ ] **Step 1: Write failing time-window tests**

Test exact boundary cases:
- Sunday 2026-08-23 23:59:59 PHT belongs to week starting 2026-08-17.
- Monday 2026-08-24 00:00:00 PHT belongs to week starting 2026-08-24.
- UTC timestamps are interpreted using `Asia/Manila`, not the machine timezone.

Example expectation:

```ts
expect(getManilaRankKeys(new Date("2026-08-23T15:59:59.000Z"))).toEqual({
  rankDate: "2026-08-23",
  weekStart: "2026-08-17",
});
expect(getManilaRankKeys(new Date("2026-08-23T16:00:00.000Z"))).toEqual({
  rankDate: "2026-08-24",
  weekStart: "2026-08-24",
});
```

- [ ] **Step 2: Run tests and confirm failure**

```bash
npm test -- lib/minigames/solo/time.test.ts
```

Expected: FAIL because helpers do not exist.

- [ ] **Step 3: Implement timezone helper using `Intl.DateTimeFormat(..., { timeZone: "Asia/Manila" })` and `formatToParts`**

Do not use browser locale strings as parseable dates.

- [ ] **Step 4: Write deterministic RNG tests**

```ts
const a = createSeededRandom(123456);
const b = createSeededRandom(123456);
expect([a(), a(), a()]).toEqual([b(), b(), b()]);
```

Also assert different seeds produce a different sequence.

- [ ] **Step 5: Implement the registry**

Each entry must include:
- key;
- slug;
- label;
- score label;
- primary direction (`higher` / `lower`);
- secondary direction;
- ranked TTL;
- practice/ranked copy.

- [ ] **Step 6: Run targeted tests**

```bash
npm test -- lib/minigames/solo/time.test.ts lib/minigames/solo/random.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add lib/minigames/solo
git commit -m "feat: add solo arcade domain primitives"
```

---

## Task 2: Add Solo Arcade persistence with concurrency-safe daily attempt slots

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_solo_arcade_v1/migration.sql`
- Test: add a focused schema/service test where the repo's current Prisma test pattern allows it

**Interfaces:**
- Produces Prisma models `SoloGameAttempt` and `ArcadeWeeklyChampion`.
- Adds relations from `User` and `Department`.
- Enforces 1..3 attempt numbers.

- [ ] **Step 1: Add the two models and enums from this spec to Prisma schema**

Keep `gameType` as `String`; validate it through the registry rather than requiring a database enum migration every time AGS adds a future solo game.

- [ ] **Step 2: Generate migration**

Use the repository's established Prisma migration workflow. Do not recreate or rebaseline migration history.

- [ ] **Step 3: Add the database check constraint**

```sql
ALTER TABLE "SoloGameAttempt"
ADD CONSTRAINT "SoloGameAttempt_attemptNumber_check"
CHECK ("attemptNumber" BETWEEN 1 AND 3);
```

- [ ] **Step 4: Generate Prisma client**

```bash
npx prisma generate
```

- [ ] **Step 5: Validate schema**

```bash
npx prisma validate
```

Expected: success.

- [ ] **Step 6: Commit**

```bash
git add prisma
git commit -m "feat: add solo arcade persistence"
```

---

## Task 3: Implement and test Typing Sprint scoring

**Files:**
- Create: `lib/minigames/solo/typingPassages.ts`
- Create: `lib/minigames/solo/typing.ts`
- Test: `lib/minigames/solo/typing.test.ts`

**Interfaces:**
- Produces `createTypingChallenge(seed)`.
- Produces `scoreTypingAttempt(challenge, evidence, authoritativeElapsedMs)`.

Suggested types:

```ts
export type TypingEvidence = {
  typedText: string;
  clientElapsedMs: number;
};

export type SoloScore = {
  primaryScore: number;
  secondaryScore: number | null;
  isValid: boolean;
  validationReason: string | null;
  metrics: Record<string, number | string | boolean>;
};
```

- [ ] **Step 1: Add a first-party ranked passage bank**

Use original/public-domain/internal text, not copied Monkeytype quote assets.

Give each passage a stable ID.

- [ ] **Step 2: Write failing scoring tests**

Cover:
- perfect 60-second typing;
- typo accuracy calculation;
- <95% accuracy invalidation;
- empty input;
- impossible/invalid evidence lengths;
- server elapsed time overriding claimed client WPM.

- [ ] **Step 3: Run test and verify failure**

```bash
npm test -- lib/minigames/solo/typing.test.ts
```

- [ ] **Step 4: Implement scoring without external libraries**

Official WPM must be derived from correct characters and authoritative duration.

- [ ] **Step 5: Run tests**

```bash
npm test -- lib/minigames/solo/typing.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/minigames/solo/typing*
git commit -m "feat: add ranked typing scoring engine"
```

---

## Task 4: Implement and test Reaction Rush scoring

**Files:**
- Create: `lib/minigames/solo/reaction.ts`
- Test: `lib/minigames/solo/reaction.test.ts`

**Interfaces:**
- Produces `createReactionChallenge(seed)`.
- Produces `scoreReactionAttempt(challenge, evidence)`.

Evidence:

```ts
export type ReactionEvidence = {
  reactionMs: [number, number, number, number, number];
  falseStartTrials: number[];
  clientElapsedMs: number;
};
```

- [ ] **Step 1: Write failing challenge determinism tests**

Same seed must produce the same five wait durations.

- [ ] **Step 2: Write failing score tests**

Cover:
- five normal reactions -> rounded average;
- a false start -> that trial scores 1000ms;
- any non-false-start value <100ms -> invalid;
- wrong number of trials -> invalid;
- non-finite/negative values -> invalid.

- [ ] **Step 3: Run failing tests**

```bash
npm test -- lib/minigames/solo/reaction.test.ts
```

- [ ] **Step 4: Implement the pure engine**

Do not read `window`, timers, React state or database code from this module.

- [ ] **Step 5: Run tests and commit**

```bash
npm test -- lib/minigames/solo/reaction.test.ts
git add lib/minigames/solo/reaction*
git commit -m "feat: add reaction rush scoring engine"
```

---

## Task 5: Implement and test Visual Memory scoring

**Files:**
- Create: `lib/minigames/solo/visualMemory.ts`
- Test: `lib/minigames/solo/visualMemory.test.ts`

**Interfaces:**
- Produces deterministic board patterns by seed and level.
- Produces official highest completed level and elapsed-time tie-break.

- [ ] **Step 1: Define a bounded V1 progression**

The engine must deterministically define:
- grid size by level;
- highlighted cell count;
- expected cells;
- maximum level accepted by the server.

Keep limits finite to prevent oversized submitted payloads.

- [ ] **Step 2: Write failing tests**

Cover:
- deterministic cells;
- correct level progression;
- wrong answer stops progression;
- duplicate/out-of-range cell indexes invalid;
- claimed level cannot exceed evidence;
- payload size cap.

- [ ] **Step 3: Run, implement, rerun**

```bash
npm test -- lib/minigames/solo/visualMemory.test.ts
```

- [ ] **Step 4: Commit**

```bash
git add lib/minigames/solo/visualMemory*
git commit -m "feat: add visual memory scoring engine"
```

---

## Task 6: Implement and test Sequence Memory scoring

**Files:**
- Create: `lib/minigames/solo/sequenceMemory.ts`
- Test: `lib/minigames/solo/sequenceMemory.test.ts`

**Interfaces:**
- Deterministic expected sequence from a seed.
- Official completed sequence level plus elapsed-time tie-break.

- [ ] **Step 1: Write failing deterministic sequence tests**
- [ ] **Step 2: Write validation tests for correct, wrong, truncated, oversized and out-of-range sequences**
- [ ] **Step 3: Run failing test**

```bash
npm test -- lib/minigames/solo/sequenceMemory.test.ts
```

- [ ] **Step 4: Implement pure engine**
- [ ] **Step 5: Run test and commit**

```bash
npm test -- lib/minigames/solo/sequenceMemory.test.ts
git add lib/minigames/solo/sequenceMemory*
git commit -m "feat: add sequence memory scoring engine"
```

---

## Task 7: Add dedicated Arcade rate limiting and ranked-attempt service

**Files:**
- Modify: `lib/guardrails/rateLimiter.ts`
- Create: `lib/minigames/solo/attempts.ts`
- Test: `lib/minigames/solo/attempts.test.ts`

**Interfaces:**
- Add rate-limit scope: `arcade`.
- Produces `startRankedAttempt(userId, gameType, now)`.
- Produces `finishRankedAttempt(userId, attemptId, evidence, now)`.

Recommended rate scope:

```ts
arcade: { limit: 30, window: "5 m" as const, windowMs: 5 * 60 * 1000 }
```

This is separate from admin writes and leaves plenty of headroom for legitimate game starts/finishes.

- [ ] **Step 1: Write failing tests for attempt allocation**

Cover:
- first start -> attempt 1;
- second -> 2;
- third -> 3;
- fourth -> limit error;
- expired/abandoned STARTED rows still consume slots;
- different game has separate three slots;
- next Manila date resets slots.

- [ ] **Step 2: Write a concurrency regression test**

Two simultaneous requests near the third slot must never produce attempt number 4.

The service should handle Prisma unique-conflict by re-reading occupied slots and returning either the next valid slot or a limit result.

- [ ] **Step 3: Implement challenge creation**

Use Node `crypto` to create a numeric seed. Store only minimal descriptors:
- typing: seed + passage ID;
- reaction/memory: seed.

- [ ] **Step 4: Implement finish as idempotent**

Rules:
- owner only;
- STARTED only;
- expired attempts transition to EXPIRED;
- completed attempts return stored result on duplicate finish;
- official score comes from the pure game engine;
- update uses an atomic STARTED -> COMPLETED guard.

- [ ] **Step 5: Run tests**

```bash
npm test -- lib/minigames/solo/attempts.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add lib/guardrails/rateLimiter.ts lib/minigames/solo/attempts*
git commit -m "feat: add ranked solo attempt service"
```

---

## Task 8: Add ranked start/finish API routes

**Files:**
- Create: `app/api/minigames/solo/attempts/start/route.ts`
- Create: `app/api/minigames/solo/attempts/[id]/finish/route.ts`
- Test: route/service tests using the repository's established API test style

**Interfaces:**
- Implements the API contract in this spec.
- Uses `verifyAuth`.
- Uses `checkRateLimit(user.id, "arcade")`.
- Uses Zod to bound all inputs.

- [ ] **Step 1: Write failing unauthorized, invalid-game and limit tests**
- [ ] **Step 2: Implement start route as a thin adapter over `startRankedAttempt`**
- [ ] **Step 3: Write failing finish tests for wrong owner, expired, duplicate and malformed evidence**
- [ ] **Step 4: Implement finish route as a thin adapter over `finishRankedAttempt`**
- [ ] **Step 5: Verify route tests**
- [ ] **Step 6: Commit**

```bash
git add app/api/minigames/solo/attempts
git commit -m "feat: add solo ranked attempt APIs"
```

---

## Task 9: Implement leaderboard and personal-best query service

**Files:**
- Create: `lib/minigames/solo/leaderboard.ts`
- Test: `lib/minigames/solo/leaderboard.test.ts`

**Interfaces:**
- Produces `getSoloLeaderboard(...)`.
- Produces `getSoloSummary(...)`.
- Produces deterministic tie ordering.

Use PostgreSQL window functions for "best attempt per user" instead of fetching an unbounded all-time history into Node.

Conceptual SQL shape:

```sql
WITH ranked_attempts AS (
  SELECT
    a.*,
    ROW_NUMBER() OVER (
      PARTITION BY a."userId"
      ORDER BY
        -- direction is selected from a trusted server registry, never user SQL
        a."primaryScore" DESC,
        a."secondaryScore" DESC NULLS LAST,
        a."completedAt" ASC
    ) AS best_row
  FROM "SoloGameAttempt" a
  WHERE
    a."gameType" = $1
    AND a."status" = 'COMPLETED'
    AND a."isValid" = true
)
SELECT ...
FROM ranked_attempts
WHERE best_row = 1;
```

Create separate trusted query fragments for higher-is-better and lower-is-better games. Do not concatenate request strings into raw SQL.

- [ ] **Step 1: Write ranking tests**

Cover:
- multiple attempts by same user -> only best counts;
- weekly filter vs all-time;
- company vs department snapshot;
- typing primary/accuracy tie;
- reaction lower-is-better;
- exact tie -> earlier completion;
- current user returned outside top 50.

- [ ] **Step 2: Implement query service with bound parameters**
- [ ] **Step 3: Run tests**
- [ ] **Step 4: Commit**

```bash
npm test -- lib/minigames/solo/leaderboard.test.ts
git add lib/minigames/solo/leaderboard*
git commit -m "feat: add solo arcade leaderboard queries"
```

---

## Task 10: Add leaderboard and summary API routes

**Files:**
- Create: `app/api/minigames/solo/leaderboard/route.ts`
- Create: `app/api/minigames/solo/summary/route.ts`

- [ ] **Step 1: Add Zod query schemas**
- [ ] **Step 2: Authenticate all requests**
- [ ] **Step 3: Department scope must derive department from the authenticated employee / stored attempt snapshots, not accept arbitrary department access as an authorization shortcut**
- [ ] **Step 4: Return top 50 + current user's rank**
- [ ] **Step 5: Return attempts remaining from start-count rows for today's Manila `rankDate`**
- [ ] **Step 6: Add targeted API tests**
- [ ] **Step 7: Commit**

```bash
git add app/api/minigames/solo/leaderboard app/api/minigames/solo/summary
git commit -m "feat: expose solo arcade rankings"
```

---

## Task 11: Add achievement badge rules and idempotent badge sync

**Files:**
- Create: `lib/minigames/solo/badges.ts`
- Test: `lib/minigames/solo/badges.test.ts`
- Create: `scripts/sync-arcade-badges.ts`
- Modify: `prisma/seed.ts` only if the current seed convention supports shared upsert definitions
- Modify: `app/(dashboard)/profile/components/BadgesTab.tsx`

**Interfaces:**
- Produces a code-defined `ARCADE_BADGES` catalog.
- Produces `awardSoloAchievementBadges(userId, attemptResult)`.
- Sync script upserts badge definitions by stable unique name.

- [ ] **Step 1: Write failing threshold/idempotency tests**
- [ ] **Step 2: Implement badge catalog exactly as specified above**
- [ ] **Step 3: Implement award evaluation server-side**

Use `createMany({ skipDuplicates: true })` or equivalent against the existing `(userId, badgeId)` uniqueness.

- [ ] **Step 4: Add idempotent sync script**

It must be safe to run repeatedly in dev/test/prod.

- [ ] **Step 5: Update Badge empty-state copy**

Replace point-specific copy such as:

```text
Keep earning points to unlock your first badge!
```

with neutral copy such as:

```text
Keep participating to unlock achievements.
```

- [ ] **Step 6: Wire badge evaluation into successful ranked finish**
- [ ] **Step 7: Test and commit**

```bash
npm test -- lib/minigames/solo/badges.test.ts
git add lib/minigames/solo/badges* scripts/sync-arcade-badges.ts prisma/seed.ts app/'(dashboard)'/profile/components/BadgesTab.tsx
git commit -m "feat: add solo arcade achievements"
```

---

## Task 12: Implement weekly champion finalization

**Files:**
- Create: `lib/minigames/solo/champions.ts`
- Test: `lib/minigames/solo/champions.test.ts`
- Create: `app/api/minigames/solo/champions/route.ts`

**Interfaces:**
- Produces `finalizePreviousWeekIfNeeded(now)`.
- Produces `getUserChampionships(userId)`.
- Produces recent company champions if requested.

- [ ] **Step 1: Write failing winner tests**

For each game:
- company winner is best valid score;
- each department winner is best valid score among snapshotted department attempts;
- company winner may also win department;
- no score -> no award;
- invalid attempts ignored;
- same week finalized twice -> no duplicates.

- [ ] **Step 2: Implement one-transaction finalization**
- [ ] **Step 3: Snapshot department display name into champion record**
- [ ] **Step 4: Call finalization lazily from champions/summary/leaderboard read path after week boundary**
- [ ] **Step 5: Add API route returning the authenticated user's history**
- [ ] **Step 6: Run tests and commit**

```bash
npm test -- lib/minigames/solo/champions.test.ts
git add lib/minigames/solo/champions* app/api/minigames/solo/champions
git commit -m "feat: record weekly arcade champions"
```

---

## Task 13: Build shared Solo Game shell with lazy-loading and mode handling

**Files:**
- Create: `app/(dashboard)/minigames/solo/[game]/page.tsx`
- Create: `components/minigames/solo/SoloGameShell.tsx`
- Create: `components/minigames/solo/SoloResultPanel.tsx`

**Interfaces:**
- Route resolves slug to `SoloGameType`.
- Shell owns Practice/Ranked mode selection, ranked start call, remaining attempts, completion submission, PB/result presentation.
- Game components receive a small prop contract and do not know about auth/API implementation details.

Recommended game prop contract:

```ts
export type SoloGameProps<TChallenge, TEvidence> = {
  mode: "practice" | "ranked";
  challenge: TChallenge;
  disabled?: boolean;
  onComplete: (evidence: TEvidence) => void;
};
```

- [ ] **Step 1: Implement route validation with `notFound()` for unknown slugs**
- [ ] **Step 2: Use `next/dynamic` so each game component is a separate client chunk**
- [ ] **Step 3: Implement Practice mode with local seed generation and no API call**
- [ ] **Step 4: Implement Ranked start/finish lifecycle**
- [ ] **Step 5: Display "3 / 2 / 1 / 0 attempts remaining today" using server data**
- [ ] **Step 6: On refresh during a ranked game, do not silently restore the consumed attempt in V1**
- [ ] **Step 7: Respect reduced motion for result celebration; reuse existing AGS confetti helper only when allowed**
- [ ] **Step 8: Verify keyboard/focus flow manually and commit**

```bash
git add app/'(dashboard)'/minigames/solo components/minigames/solo/SoloGameShell.tsx components/minigames/solo/SoloResultPanel.tsx
git commit -m "feat: add solo arcade game shell"
```

---

## Task 14: Build Typing Sprint UI

**Files:**
- Create: `components/minigames/solo/TypingGame.tsx`

- [ ] **Step 1: Render canonical passage with current/error/correct character states**
- [ ] **Step 2: Use one controlled or carefully isolated text input; do not POST keystrokes**
- [ ] **Step 3: Disable paste, cut and drop in Ranked**
- [ ] **Step 4: Start timer only when the game is actually active**
- [ ] **Step 5: End ranked run at 60 seconds and submit only evidence**
- [ ] **Step 6: Show live WPM/accuracy as provisional client feedback; label final server result as official**
- [ ] **Step 7: Ensure keyboard-only operation and visible focus**
- [ ] **Step 8: Verify mobile viewport does not cause horizontal overflow**
- [ ] **Step 9: Commit**

```bash
git add components/minigames/solo/TypingGame.tsx
git commit -m "feat: add typing sprint UI"
```

---

## Task 15: Build Reaction Rush UI

**Files:**
- Create: `components/minigames/solo/ReactionGame.tsx`

- [ ] **Step 1: Implement seeded wait sequence from the pure challenge engine**
- [ ] **Step 2: Support pointer and keyboard activation**
- [ ] **Step 3: A click/key before target is ready marks that trial as false-start and 1000ms**
- [ ] **Step 4: Run exactly five ranked trials**
- [ ] **Step 5: Submit only the compact five-trial evidence**
- [ ] **Step 6: Use `performance.now()` for client timing**
- [ ] **Step 7: Do not present reaction result as a medical/cognitive diagnosis**
- [ ] **Step 8: Commit**

```bash
git add components/minigames/solo/ReactionGame.tsx
git commit -m "feat: add reaction rush UI"
```

---

## Task 16: Build Visual Memory UI

**Files:**
- Create: `components/minigames/solo/VisualMemoryGame.tsx`

- [ ] **Step 1: Generate board from shared deterministic engine**
- [ ] **Step 2: Show pattern, hide it, then enable selection**
- [ ] **Step 3: Keep cell hit areas large enough for mobile**
- [ ] **Step 4: Provide keyboard grid navigation/activation**
- [ ] **Step 5: Submit compact answer evidence only at game end**
- [ ] **Step 6: Do not rely on color alone to communicate selected/correct/incorrect states**
- [ ] **Step 7: Commit**

```bash
git add components/minigames/solo/VisualMemoryGame.tsx
git commit -m "feat: add visual memory UI"
```

---

## Task 17: Build Sequence Memory UI

**Files:**
- Create: `components/minigames/solo/SequenceMemoryGame.tsx`

- [ ] **Step 1: Render a compact button grid consistent with AGS styling**
- [ ] **Step 2: Play sequence using shared deterministic sequence**
- [ ] **Step 3: Respect `prefers-reduced-motion`; use state/contrast rather than motion alone**
- [ ] **Step 4: Support keyboard input**
- [ ] **Step 5: Submit response evidence once at the end**
- [ ] **Step 6: Commit**

```bash
git add components/minigames/solo/SequenceMemoryGame.tsx
git commit -m "feat: add sequence memory UI"
```

---

## Task 18: Integrate Solo Games into the existing Minigames landing page without breaking multiplayer

**Files:**
- Modify: `app/(dashboard)/minigames/page.tsx`
- Create: `components/minigames/solo/SoloGameGrid.tsx`
- Optional Create/Modify: `components/minigames/MultiplayerLobby.tsx` if extraction keeps the page maintainable

**Interfaces:**
- Existing challenge create/join/cancel behavior stays the same.
- Existing horizontal multiplayer selector remains inside a clear Multiplayer section.
- Solo cards navigate to `/minigames/solo/<slug>`.

- [ ] **Step 1: Capture current multiplayer behavior with a targeted manual/Playwright smoke checklist before refactor**
- [ ] **Step 2: Add a `Solo Games` grid before or beside the Multiplayer section**
- [ ] **Step 3: Each card shows game label, score unit, official PB if available, and a Play action**
- [ ] **Step 4: Do not add four more items to the existing horizontal multiplayer game tabs**
- [ ] **Step 5: If extracting multiplayer lobby code, make it a behavior-preserving move before adding new UI**
- [ ] **Step 6: Keep route `/minigames` and existing navigation stable in V1**
- [ ] **Step 7: Verify create/join/cancel and active-game banners still work**
- [ ] **Step 8: Commit**

```bash
git add app/'(dashboard)'/minigames/page.tsx components/minigames
git commit -m "feat: add solo games to minigames lobby"
```

---

## Task 19: Add Solo rankings to Stats & Leaderboard

**Files:**
- Modify: `app/(dashboard)/minigames/stats/page.tsx`
- Create: `components/minigames/solo/SoloLeaderboardPanel.tsx`

**Interfaces:**
- Preserve current Multiplayer W/L/D stats.
- Add a clear Multiplayer / Solo switch or section separation.
- Solo controls: game, Company/Department, This Week/All-Time.

- [ ] **Step 1: Keep current multiplayer API calls lazy when Solo view is selected where practical**
- [ ] **Step 2: Solo view loads selected leaderboard only**
- [ ] **Step 3: Show top rows plus a pinned/current-user row if outside visible top ranks**
- [ ] **Step 4: Show PB and current rank**
- [ ] **Step 5: Show recent weekly champions without Feed integration**
- [ ] **Step 6: Ensure table/list is readable on mobile**
- [ ] **Step 7: Commit**

```bash
git add app/'(dashboard)'/minigames/stats/page.tsx components/minigames/solo/SoloLeaderboardPanel.tsx
git commit -m "feat: add solo arcade leaderboards"
```

---

## Task 20: Add weekly championships to Profile

**Files:**
- Create: `app/(dashboard)/profile/components/ArcadeChampionships.tsx`
- Modify: `app/(dashboard)/profile/page.tsx`
- Modify: `app/(dashboard)/profile/types.ts`
- Prefer Create: `app/api/me/arcade-championships/route.ts`
  rather than widening `PROFILE_SELECT` if that would make every bootstrap/profile request heavier.

**Interfaces:**
- Profile Badges continues to use existing `/api/me` badge payload.
- Championship history loads separately/lazily when relevant.

- [ ] **Step 1: Add authenticated championships endpoint**
- [ ] **Step 2: Fetch championships only on the Profile view that displays them**
- [ ] **Step 3: Render title, game, scope, week and score**
- [ ] **Step 4: A user who won Company + Department in the same week displays both**
- [ ] **Step 5: Do not call these awards AGS Points or performance awards**
- [ ] **Step 6: Commit**

```bash
git add app/'(dashboard)'/profile app/api/me/arcade-championships
git commit -m "feat: show arcade championships on profiles"
```

---

## Task 21: Full verification, performance guardrails, accessibility, and documentation

**Files:**
- Modify/add Playwright tests under the repo's existing Playwright convention
- Modify: `CLAUDE.md` only if necessary to correct stale minigame/test architecture documentation
- Create/update: `THIRD_PARTY_NOTICES.md` only if implementation actually copied non-trivial MIT source
- Add implementation notes to the project's normal docs location

- [ ] **Step 1: Run all unit tests**

```bash
npm test
```

Expected: all existing + new tests pass.

- [ ] **Step 2: Run lint**

```bash
npm run lint
```

Expected: no new warnings/errors.

- [ ] **Step 3: Run production build**

```bash
npm run build
```

Expected: success.

- [ ] **Step 4: Run a Playwright/browser smoke matrix**

Verify:
1. existing RPS challenge still creates/joins;
2. existing multiplayer active-game route still loads;
3. Practice game causes no solo attempt DB write;
4. Ranked start decrements remaining attempts immediately;
5. refresh/abandon does not refund an attempt;
6. fourth ranked start returns limit state;
7. typing official result is returned by server;
8. reaction five-trial result works;
9. visual memory works;
10. sequence memory works;
11. weekly/company leaderboard updates;
12. department leaderboard uses snapshot department;
13. employee outside top rows still sees own rank;
14. badges award once;
15. championships render on Profile.

- [ ] **Step 5: Check network behavior**

During a ranked game, confirm:
- one start API request;
- no per-input gameplay requests;
- one finish request;
- leaderboard/summary refresh only after completion or explicit navigation.

- [ ] **Step 6: Check bundle behavior**

Use the Next.js build output / browser network panel to verify:
- Feed/Marketplace routes do not load solo-game modules;
- opening Typing does not eagerly fetch all other game chunks if Next's prefetch behavior is disabled/controlled for those links;
- Phaser/Pixi/other new game engine is absent from lockfile.

- [ ] **Step 7: Accessibility pass**

Keyboard test:
- mode switch;
- game start;
- Typing;
- Reaction;
- Visual Memory;
- Sequence Memory;
- leaderboard controls.

Check:
- focus visibility;
- screen-reader labels/status updates;
- reduced-motion behavior;
- color contrast;
- no color-only correctness signal.

- [ ] **Step 8: Security regression**

Verify:
- unauthenticated API requests -> 401;
- other user's attempt -> 404/403 without data leak;
- malformed payload -> 400;
- expired -> no score;
- duplicate finish -> idempotent stored result;
- attempt 4 -> 429;
- score fields sent by client are ignored/recomputed;
- no AGS `PointTransaction` is created by solo games.

- [ ] **Step 9: Documentation/licensing pass**

If code was only independently implemented from mechanics:
- record researched repos in engineering notes; no third-party code notice needed.

If code was copied/adapted:
- include compatible MIT notice and exact source.
- ensure no GPL/AGPL source or unlicensed assets entered the codebase.

- [ ] **Step 10: Final commit**

```bash
git add .
git commit -m "feat: complete solo arcade v1"
```

---

# Recommended Execution Order and Review Gates

Use one fresh implementation/review gate per task or tightly coupled task group.

Recommended grouping if using subagent-driven development:

1. Tasks 1-2 — domain + persistence.
2. Task 3 — typing engine.
3. Task 4 — reaction engine.
4. Task 5 — visual memory engine.
5. Task 6 — sequence memory engine.
6. Tasks 7-8 — attempt service + API.
7. Tasks 9-10 — ranking service + API.
8. Task 11 — badges.
9. Task 12 — weekly champions.
10. Task 13 — shared solo shell.
11. Task 14 — Typing UI.
12. Task 15 — Reaction UI.
13. Task 16 — Visual Memory UI.
14. Task 17 — Sequence Memory UI.
15. Task 18 — landing integration.
16. Task 19 — leaderboard UI.
17. Task 20 — profile integration.
18. Task 21 — system verification.

Do not have parallel agents edit `prisma/schema.prisma`, the same route, or the same Minigames page simultaneously.

Pure game engine tasks 3-6 can be parallelized only after Task 1's interfaces are committed and each agent owns separate files.

---

# Vercel / Cost Guardrails

This design is intentionally low-request:

```text
Practice
browser only
0 game API requests
0 game DB writes

Ranked attempt
1 start request
+ local gameplay
+ 1 finish request
= ~2 game-write requests per completed attempt
```

Maximum normal ranked starts per employee per day:

```text
4 games × 3 attempts = 12 starts/day
```

If all 12 are completed:

```text
12 starts + 12 finishes = 24 write requests/day/employee
```

Leaderboard/summary reads add some traffic, but there is no high-frequency polling or per-keystroke API load.

Important hosting note: Vercel's current Terms state Hobby is for personal/non-commercial use. AGS One is an internal company application, so Hobby should not be treated as the long-term production entitlement even if the technical usage fits. This architecture remains efficient on Pro or another Next.js host and does not depend on Hobby-only behavior.

---

# Rollout Strategy

## Rollout 0 — developer/internal QA
- schema;
- engines;
- APIs;
- one test employee;
- no broad discoverability until rate/score validation passes.

## Rollout 1 — Typing Sprint only behind existing Minigames UI
Validate:
- ranked attempt lifecycle;
- ranking query;
- department snapshot;
- PB;
- badges;
- Vercel request behavior.

Do this before exposing all four games to all employees, even though all four can be implemented in the same V1 project.

## Rollout 2 — Reaction + Visual + Sequence
Enable once the shared lifecycle has proven stable.

## Rollout 3 — weekly champion presentation
Let the first real weekly boundary finalize awards, verify them, then keep the feature visible.

---

# Explicitly Deferred From V1

Do not implement these while executing this plan:

- Arcade XP;
- monthly seasons;
- Hall of Fame beyond weekly champion history;
- daily featured challenge;
- prizes or AGS Points for solo results;
- automatic Feed posts;
- team/manager-group leaderboards;
- live realtime leaderboard updates;
- multiplayer refactor;
- universal competition engine;
- Phaser/Pixi;
- server streaming of gameplay events;
- sophisticated bot/automation detection;
- admin-configurable game rules;
- public external leaderboards.

Each can be a later independently designed project.

---

# Plan Self-Review

## Spec coverage

Covered:
- four chosen V1 games;
- Practice + 3 Ranked attempts/day;
- attempt consumed on start;
- Asia/Manila;
- best score counts;
- Company + Department;
- This Week + All-Time;
- badges;
- #1 Company + #1 Department weekly champions;
- champions in Arcade/Profile only;
- server-issued attempts;
- separate Solo domain;
- no points/XP;
- low Vercel request volume;
- open-source review and licensing;
- no game engine;
- lazy loading;
- testing/security/accessibility.

## Placeholder scan

This plan contains no unresolved placeholder requirements. Where the implementation must follow an existing repository convention (migration timestamp, Playwright folder naming), the plan says to use that current convention rather than inventing a conflicting path.

## Type consistency

Canonical game keys:
- `TYPING`
- `REACTION`
- `VISUAL_MEMORY`
- `SEQUENCE_MEMORY`

Canonical attempt modes:
- Practice is not persisted.
- Persisted rows are Ranked attempts only.

Canonical leaderboard:
- period: `week | alltime`
- scope: `company | department`.

---

# Source Notes

Open-source research:
- HaltType — https://github.com/artistatbl/halttype — MIT
- HumanEval — https://github.com/ShaikhWarsi/HumanEval — MIT
- MentalMint mini-games — https://github.com/tusharv/mini-games — MIT
- Monkeytype — https://github.com/monkeytypegame/monkeytype — GPL-3.0
- FreeFocusGames — https://github.com/loethen/freefocusgames — AGPL-3.0
- Phaser — https://github.com/phaserjs/phaser — MIT

Current AGS One repo areas reviewed for this plan:
- `prisma/schema.prisma`
- `package.json`
- `app/(dashboard)/minigames/page.tsx`
- `app/(dashboard)/minigames/[id]/page.tsx`
- `app/(dashboard)/minigames/stats/page.tsx`
- `app/api/minigames/sessions/**`
- `app/api/minigames/leaderboard/route.ts`
- `app/api/minigames/stats/route.ts`
- `lib/constants/gameTypes.ts`
- `lib/minigames/**`
- `lib/guardrails/rateLimiter.ts`
- `app/(dashboard)/profile/**`
- `app/api/me/route.ts`
- `lib/auth/profileSelect.ts`
- `AGENTS.md`
- `CLAUDE.md`
- `PRODUCT.md`
- `DESIGN.md`

