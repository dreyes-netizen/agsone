# Task 5-6 Type-Check Regression Correction Report

## Scope

- Revised only the completed-game metric shape for solo Visual Memory and Sequence Memory.
- Left shared metric typing, progression, scoring rules, persistence, and API code unchanged.

## RED

Command:

```powershell
npx vitest run lib/minigames/solo/visualMemory.test.ts lib/minigames/solo/sequenceMemory.test.ts
```

Output:

```text
2 failed | 28 passed (30)
FAIL accepts a perfect ten-level run without requiring a trailing wrong answer
FAIL accepts a perfect ten-level run with the locked 55-input cap
```

Expected failure reason:
- both perfect-run tests were updated to require omission of `metrics.failedLevel`
- production still emitted `failedLevel: null`

## GREEN

Command:

```powershell
npx vitest run lib/minigames/solo/visualMemory.test.ts lib/minigames/solo/sequenceMemory.test.ts
```

Output:

```text
Test Files  2 passed (2)
Tests  30 passed (30)
```

Minimal production change:
- in `visualMemory.ts` and `sequenceMemory.ts`, the success metrics now spread `failedLevel` only when it is a number
- terminal-wrong completed runs still include numeric `failedLevel`
- all-success completed runs now omit the property entirely

## Typecheck

Command:

```powershell
npx tsc --noEmit
```

Output:

```text
exit 0
```

## Full Test Suite

Command:

```powershell
npm test
```

Output:

```text
3 failed | 203 passed (206)
```

Observed unrelated failures already present in the worktree:
- `lib/minigames/solo/attempts.test.ts`
- `app/api/minigames/solo/attempts/routes.test.ts`

Failure details:
- expected `attemptsRemaining: 0`, received `2`
- expected expired inspected attempt route status `410`, received `400`
- expected non-UUID route parameter status `400`, received `404`

## Files Changed

- `lib/minigames/solo/visualMemory.test.ts`
- `lib/minigames/solo/visualMemory.ts`
- `lib/minigames/solo/sequenceMemory.test.ts`
- `lib/minigames/solo/sequenceMemory.ts`

## Self-Review

- The tests now lock the intended contract directly at the scoring boundary.
- The implementation change is local to success-payload assembly and does not alter invalid-result or terminal-failure payloads.
- The correction satisfies the established `Record<string, string | number | boolean>` metrics contract without loosening types or adding sentinel values.
