## Task 3 Report: Typing Sprint scoring

### Implementation and files

- Added [lib/minigames/solo/typingPassages.ts](/C:/Users/D_Reyes/Desktop/AGS%20One/.worktrees/ags-arcade-solo-v1/lib/minigames/solo/typingPassages.ts) with four first-party ranked passages and stable internal IDs.
- Added [lib/minigames/solo/typing.ts](/C:/Users/D_Reyes/Desktop/AGS%20One/.worktrees/ags-arcade-solo-v1/lib/minigames/solo/typing.ts) with deterministic challenge creation, authoritative elapsed-time clamping, bounded evidence validation, and ranked WPM / accuracy scoring.
- Added [lib/minigames/solo/typing.test.ts](/C:/Users/D_Reyes/Desktop/AGS%20One/.worktrees/ags-arcade-solo-v1/lib/minigames/solo/typing.test.ts) covering deterministic challenge selection, perfect scoring, 95.00% threshold behavior, below-threshold invalidation, empty input, oversized evidence, malformed evidence, and client-time mistrust.

### RED verification

Command:

```bash
npm test -- lib/minigames/solo/typing.test.ts
```

Output:

```text
> employegames@0.1.0 test
> vitest run lib/minigames/solo/typing.test.ts


 RUN  v4.1.10 C:/Users/D_Reyes/Desktop/AGS One/.worktrees/ags-arcade-solo-v1

 ❯ lib/minigames/solo/typing.test.ts (0 test)

⎯⎯⎯⎯⎯⎯ Failed Suites 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  lib/minigames/solo/typing.test.ts [ lib/minigames/solo/typing.test.ts ]
Error: Cannot find module './typingPassages' imported from C:/Users/D_Reyes/Desktop/AGS One/.worktrees/ags-arcade-solo-v1/lib/minigames/solo/typing.test.ts
 ❯ lib/minigames/solo/typing.test.ts:2:1
      1| import { describe, expect, it } from "vitest";
      2| import { TYPING_PASSAGES } from "./typingPassages";
       | ^
      3| import { createTypingChallenge, scoreTypingAttempt, type TypingChallen…
      4|

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯


 Test Files  1 failed (1)
      Tests  no tests
   Start at  02:08:16
   Duration  403ms (transform 43ms, setup 0ms, import 0ms, tests 0ms, environment 0ms)
```

Reason:

- This was the correct RED state: the new test file failed because the production modules did not exist yet, proving the tests were ahead of the implementation.

### GREEN verification

Command:

```bash
npm test -- lib/minigames/solo/typing.test.ts
```

Output:

```text
> employegames@0.1.0 test
> vitest run lib/minigames/solo/typing.test.ts


 RUN  v4.1.10 C:/Users/D_Reyes/Desktop/AGS One/.worktrees/ags-arcade-solo-v1


 Test Files  1 passed (1)
      Tests  8 passed (8)
   Start at  02:09:17
   Duration  739ms (transform 118ms, setup 0ms, import 150ms, tests 10ms, environment 0ms)
```

### Full-suite verification

Command:

```bash
npm test
```

Output:

```text
> employegames@0.1.0 test
> vitest run


 RUN  v4.1.10 C:/Users/D_Reyes/Desktop/AGS One/.worktrees/ags-arcade-solo-v1


 Test Files  22 passed (22)
      Tests  144 passed (144)
   Start at  02:09:25
   Duration  3.16s (transform 3.77s, setup 0ms, import 5.93s, tests 552ms, environment 15ms)
```

### Passage provenance

- All ranked passages were written directly in this task as original first-party copy for the repo. No Monkeytype assets or third-party quote banks were copied.

### Mutation-style test review

- If the scorer used `clientElapsedMs` for WPM, `uses authoritative elapsed time instead of claimed client speed` would fail.
- If accuracy were computed from words, elapsed time, or rounded incorrectly instead of `correctChars / max(typedChars, 1)`, the `basis points` and `below 95 percent` tests would fail.
- If the threshold check were `> 9500` instead of `>= 9500`, the one-typo threshold test would fail.
- If empty input skipped its dedicated invalidation path, `rejects empty text submissions` would fail.
- If oversized text were truncated instead of rejected, `rejects oversized submissions before scoring` would fail.
- If malformed evidence were accepted or crashed during validation, `rejects malformed evidence payloads` would fail.
- If same-seed challenge generation became nondeterministic or stopped returning canonical passages, `returns the same ranked challenge for the same seed` would fail.

### Self-review

- The scorer stays pure TypeScript and does not depend on browser, database, API, or third-party libraries.
- Validation is intentionally narrow: malformed evidence returns `INVALID_EVIDENCE`, oversized text returns `TEXT_TOO_LONG`, and low-accuracy attempts still produce comparable WPM / accuracy metrics while being marked invalid.
- Authoritative elapsed time is clamped to the fixed 60-second ranked duration exactly as the approved ranked rules require.
- The staged diff is limited to the three requested typing files.

### Concerns

- None for Task 3 within the current brief. Future consumers should treat `validationReason` string literals as part of this module’s contract if they branch on them.

## Fix Round 1

### What changed

- Reworked the typing tests to use canonical passages from `TYPING_PASSAGES` instead of synthetic challenge IDs and passage text.
- Added focused tests for authoritative elapsed times of `0`, negative, `< 60_000`, exactly `60_000`, and `> 60_000`.
- Added a negative test for tampered challenge data to enforce server-issued canonical passage validation.
- Updated the scorer to reject nonpositive authoritative times as `INVALID_EVIDENCE`, reject sub-minute authoritative times as `INVALID_ELAPSED_TIME`, clamp only times above `60_000`, and require `challenge.passageId`, `challenge.passageText`, and `durationMs` to match the internal passage bank.

### Fix Round 1 RED verification

Command:

```bash
npm test -- lib/minigames/solo/typing.test.ts
```

Output:

```text
> employegames@0.1.0 test
> vitest run lib/minigames/solo/typing.test.ts


 RUN  v4.1.10 C:/Users/D_Reyes/Desktop/AGS One/.worktrees/ags-arcade-solo-v1

 ❯ lib/minigames/solo/typing.test.ts (14 tests | 4 failed) 25ms
     × rejects zero authoritative elapsed time 11ms
     × rejects negative authoritative elapsed time 2ms
     × rejects authoritative elapsed time below the fixed ranked minute 2ms
     × rejects challenges that do not match the canonical passage bank 1ms

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 4 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  lib/minigames/solo/typing.test.ts > scoreTypingAttempt > rejects zero authoritative elapsed time
AssertionError: expected { primaryScore: 23, …(4) } to deeply equal { primaryScore: +0, …(4) }

 FAIL  lib/minigames/solo/typing.test.ts > scoreTypingAttempt > rejects negative authoritative elapsed time
AssertionError: expected { primaryScore: 23, …(4) } to deeply equal { primaryScore: +0, …(4) }

 FAIL  lib/minigames/solo/typing.test.ts > scoreTypingAttempt > rejects authoritative elapsed time below the fixed ranked minute
AssertionError: expected { primaryScore: 23, …(4) } to deeply equal { primaryScore: +0, …(4) }

 FAIL  lib/minigames/solo/typing.test.ts > scoreTypingAttempt > rejects challenges that do not match the canonical passage bank
AssertionError: expected { primaryScore: 4, …(4) } to deeply equal { primaryScore: +0, …(4) }

 Test Files  1 failed (1)
      Tests  4 failed | 10 passed (14)
   Start at  02:15:50
   Duration  467ms (transform 84ms, setup 0ms, import 122ms, tests 25ms, environment 0ms)
```

### Fix Round 1 focused GREEN verification

Command:

```bash
npm test -- lib/minigames/solo/typing.test.ts
```

Output:

```text
> employegames@0.1.0 test
> vitest run lib/minigames/solo/typing.test.ts


 RUN  v4.1.10 C:/Users/D_Reyes/Desktop/AGS One/.worktrees/ags-arcade-solo-v1


 Test Files  1 passed (1)
      Tests  14 passed (14)
   Start at  02:16:10
   Duration  1.68s (transform 131ms, setup 0ms, import 179ms, tests 15ms, environment 0ms)
```

### Fix Round 1 full-suite verification

Command:

```bash
npm test
```

Output:

```text
> employegames@0.1.0 test
> vitest run


 RUN  v4.1.10 C:/Users/D_Reyes/Desktop/AGS One/.worktrees/ags-arcade-solo-v1


 Test Files  22 passed (22)
      Tests  150 passed (150)
   Start at  02:16:18
   Duration  3.70s (transform 5.49s, setup 0ms, import 7.85s, tests 716ms, environment 9ms)
```
