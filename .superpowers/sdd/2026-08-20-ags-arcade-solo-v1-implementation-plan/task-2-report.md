# Task 2 Report: Solo Arcade Persistence

## Implementation summary

- Added Prisma enums `SoloAttemptStatus` and `ArcadeChampionScope`.
- Added Prisma models `SoloGameAttempt` and `ArcadeWeeklyChampion`.
- Added required reverse relations on `User`, `Department`, and `SoloGameAttempt`.
- Created SQL migration artifact `prisma/migrations/20260821000000_solo_arcade_v1/migration.sql` with:
  - both enum types,
  - both tables,
  - required unique/index definitions,
  - the `SoloGameAttempt_attemptNumber_check` constraint,
  - foreign keys with the specified delete behavior.
- Preserved the existing multiplayer (`GameSession`) and points domain models unchanged.

## Files changed

- `prisma/schema.prisma`
- `prisma/migrations/20260821000000_solo_arcade_v1/migration.sql`

## Validation and test commands

### `npx prisma format`

Exit: `0`

```text
Loaded Prisma config from prisma.config.ts.

Prisma schema loaded from prisma\schema.prisma.
Formatted prisma\schema.prisma in 119ms 🚀
```

### `npx prisma generate`

Exit: `0`

```text
Loaded Prisma config from prisma.config.ts.

Prisma schema loaded from prisma\schema.prisma.

✔ Generated Prisma Client (7.9.1) to .\lib\generated\prisma in 1.56s
```

### `npx prisma validate`

Exit: `0`

```text
Loaded Prisma config from prisma.config.ts.

Prisma schema loaded from prisma\schema.prisma.
The schema at prisma\schema.prisma is valid 🚀
```

### `npm test`

Exit: `0`

```text
> employegames@0.1.0 test
> vitest run


 RUN  v4.1.10 C:/Users/D_Reyes/Desktop/AGS One/.worktrees/ags-arcade-solo-v1


 Test Files  21 passed (21)
      Tests  136 passed (136)
   Start at  01:59:49
   Duration  3.74s (transform 5.66s, setup 0ms, import 8.27s, tests 626ms, environment 20ms)
```

## External database safety

No external or shared database was connected to or mutated. I created the migration SQL artifact locally and ran only local Prisma format/generate/validate commands plus the unit test suite.

## Schema to migration parity review

- `SoloAttemptStatus` exists in both schema and migration with values `STARTED`, `COMPLETED`, `EXPIRED`.
- `ArcadeChampionScope` exists in both schema and migration with values `COMPANY`, `DEPARTMENT`.
- `SoloGameAttempt` columns, defaults, and nullability match schema:
  - `gameType` remains `String` / `TEXT`
  - `rankDate` and `weekStart` are `@db.Date` / `DATE`
  - `challengeVersion` defaults to `1`
  - `startedAt` and `awardedAt` default to current timestamp
  - score/metrics/validation fields match nullability
- `ArcadeWeeklyChampion` columns, defaults, and nullability match schema.
- Foreign-key delete behavior matches schema:
  - `SoloGameAttempt.userId` -> `User` uses `ON DELETE CASCADE`
  - `SoloGameAttempt.departmentId` -> `Department` uses `ON DELETE SET NULL`
  - `ArcadeWeeklyChampion.userId` -> `User` uses `ON DELETE CASCADE`
  - `ArcadeWeeklyChampion.departmentId` -> `Department` uses `ON DELETE SET NULL`
  - `ArcadeWeeklyChampion.winningAttemptId` -> `SoloGameAttempt` uses `ON DELETE RESTRICT`
- Uniques/indexes match schema:
  - `SoloGameAttempt_userId_gameType_rankDate_attemptNumber_key`
  - `SoloGameAttempt_gameType_status_weekStart_idx`
  - `SoloGameAttempt_userId_gameType_completedAt_idx`
  - `SoloGameAttempt_departmentId_gameType_weekStart_idx`
  - `ArcadeWeeklyChampion_gameType_scopeKey_weekStart_key`
  - `ArcadeWeeklyChampion_userId_weekStart_idx`
  - `ArcadeWeeklyChampion_weekStart_gameType_idx`
- The database check constraint is present exactly as required:
  - `SoloGameAttempt_attemptNumber_check`
  - `CHECK ("attemptNumber" BETWEEN 1 AND 3)`

## Self-review findings

- No schema/migration parity issues found.
- No unintended changes to `GameSession`, `Game`, `GamePlay`, or points-related models.
- `npx prisma generate` completed successfully and left no tracked generated-client diff.
- No additional schema concepts were introduced beyond the specified enums, models, reverse relations, indexes, unique constraints, and check constraint.

## Concerns

- No functional concerns from this persistence task.
- The repository still has no Prisma integration-test harness, so no DB-backed schema test was added; this matches the task brief's explicit instruction.
