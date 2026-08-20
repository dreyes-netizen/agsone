import { describe, expect, it } from "vitest";
import {
  MAX_SEQUENCE_MEMORY_INPUTS,
  MAX_SEQUENCE_MEMORY_LEVEL,
  createSequenceMemoryChallenge,
  scoreSequenceMemoryAttempt,
  type SequenceMemoryChallenge,
  type SequenceMemoryEvidence,
} from "./sequenceMemory";

const RANKED_CHALLENGE: SequenceMemoryChallenge = {
  sequence: [3, 1, 1, 3, 2, 1, 0, 3, 3, 3],
};

describe("createSequenceMemoryChallenge", () => {
  it("returns the same ranked ten-step sequence for the same seed", () => {
    expect(createSequenceMemoryChallenge(12345)).toEqual(RANKED_CHALLENGE);
  });

  it("uses one deterministic sequence whose levels are growing prefixes", () => {
    expect(createSequenceMemoryChallenge(222)).toEqual({
      sequence: [0, 2, 3, 0, 2, 3, 1, 0, 0, 0],
    });
  });
});

describe("scoreSequenceMemoryAttempt", () => {
  it("scores contiguous exact prefixes until the first wrong input and uses elapsed milliseconds as the tiebreak", () => {
    expect(
      scoreSequenceMemoryAttempt(12345, {
        responses: [
          { level: 1, inputs: [3] },
          { level: 2, inputs: [3, 1] },
          { level: 3, inputs: [3, 1, 1] },
          { level: 4, inputs: [3, 1, 1, 0] },
        ],
        claimedCompletedLevel: 3,
        clientElapsedMs: 12_345,
      }),
    ).toEqual({
      primaryScore: 3,
      secondaryScore: 12_345,
      isValid: true,
      validationReason: null,
      metrics: {
        answeredLevelCount: 4,
        clientElapsedMs: 12_345,
        completedLevel: 3,
        failedLevel: 4,
        totalInputCount: 10,
      },
    });
  });

  it("accepts a perfect ten-level run with the locked 55-input cap", () => {
    expect(
      scoreSequenceMemoryAttempt(12345, {
        responses: [
          { level: 1, inputs: [3] },
          { level: 2, inputs: [3, 1] },
          { level: 3, inputs: [3, 1, 1] },
          { level: 4, inputs: [3, 1, 1, 3] },
          { level: 5, inputs: [3, 1, 1, 3, 2] },
          { level: 6, inputs: [3, 1, 1, 3, 2, 1] },
          { level: 7, inputs: [3, 1, 1, 3, 2, 1, 0] },
          { level: 8, inputs: [3, 1, 1, 3, 2, 1, 0, 3] },
          { level: 9, inputs: [3, 1, 1, 3, 2, 1, 0, 3, 3] },
          { level: 10, inputs: [3, 1, 1, 3, 2, 1, 0, 3, 3, 3] },
        ],
        claimedCompletedLevel: 10,
        clientElapsedMs: 45_000,
      }),
    ).toEqual({
      primaryScore: 10,
      secondaryScore: 45_000,
      isValid: true,
      validationReason: null,
      metrics: {
        answeredLevelCount: 10,
        clientElapsedMs: 45_000,
        completedLevel: 10,
        failedLevel: null,
        totalInputCount: 55,
      },
    });
  });

  it("rejects a strict correct prefix that stops before the full level length", () => {
    expect(
      scoreSequenceMemoryAttempt(12345, {
        responses: [{ level: 3, inputs: [3, 1] }],
        claimedCompletedLevel: 0,
        clientElapsedMs: 3_000,
      } as unknown as SequenceMemoryEvidence),
    ).toEqual({
      primaryScore: 0,
      secondaryScore: null,
      isValid: false,
      validationReason: "NON_CONTIGUOUS_LEVELS",
      metrics: {
        answeredLevelCount: 1,
        invalidLevel: 3,
      },
    });
  });

  it("rejects truncated evidence for the current level instead of inferring a miss", () => {
    expect(
      scoreSequenceMemoryAttempt(12345, {
        responses: [
          { level: 1, inputs: [3] },
          { level: 2, inputs: [3] },
        ],
        claimedCompletedLevel: 1,
        clientElapsedMs: 3_000,
      }),
    ).toEqual({
      primaryScore: 0,
      secondaryScore: null,
      isValid: false,
      validationReason: "TRUNCATED_RESPONSE",
      metrics: {
        answeredLevelCount: 2,
        invalidLevel: 2,
        providedInputCount: 1,
        expectedInputCount: 2,
        totalInputCount: 2,
      },
    });
  });

  it("rejects any evidence after the first wrong response", () => {
    expect(
      scoreSequenceMemoryAttempt(12345, {
        responses: [
          { level: 1, inputs: [3] },
          { level: 2, inputs: [3, 1] },
          { level: 3, inputs: [3, 1, 0] },
          { level: 4, inputs: [3, 1, 1, 3] },
        ],
        claimedCompletedLevel: 2,
        clientElapsedMs: 8_000,
      }),
    ).toEqual({
      primaryScore: 0,
      secondaryScore: null,
      isValid: false,
      validationReason: "EXTRA_RESPONSES_AFTER_FAILURE",
      metrics: {
        answeredLevelCount: 4,
        completedLevel: 2,
        failedLevel: 3,
        totalInputCount: 10,
      },
    });
  });

  it("rejects non-contiguous or mismatched levels", () => {
    expect(
      scoreSequenceMemoryAttempt(12345, {
        responses: [
          { level: 1, inputs: [3] },
          { level: 3, inputs: [3, 1, 1] },
        ],
        claimedCompletedLevel: 1,
        clientElapsedMs: 4_000,
      }),
    ).toEqual({
      primaryScore: 0,
      secondaryScore: null,
      isValid: false,
      validationReason: "NON_CONTIGUOUS_LEVELS",
      metrics: {
        answeredLevelCount: 2,
        invalidLevel: 3,
      },
    });
  });

  it("rejects claimed completed levels that do not match the verified score", () => {
    expect(
      scoreSequenceMemoryAttempt(12345, {
        responses: [
          { level: 1, inputs: [3] },
          { level: 2, inputs: [3, 1] },
          { level: 3, inputs: [3, 1, 0] },
        ],
        claimedCompletedLevel: 3,
        clientElapsedMs: 7_000,
      }),
    ).toEqual({
      primaryScore: 0,
      secondaryScore: null,
      isValid: false,
      validationReason: "CLAIMED_LEVEL_MISMATCH",
      metrics: {
        answeredLevelCount: 3,
        claimedCompletedLevel: 3,
        completedLevel: 2,
        totalInputCount: 6,
      },
    });
  });

  it("rejects empty response collections and malformed elapsed time as invalid evidence", () => {
    expect(
      scoreSequenceMemoryAttempt(12345, {
        responses: [],
        claimedCompletedLevel: 0,
        clientElapsedMs: Number.POSITIVE_INFINITY,
      }),
    ).toEqual({
      primaryScore: 0,
      secondaryScore: null,
      isValid: false,
      validationReason: "INVALID_EVIDENCE",
      metrics: {
        answeredLevelCount: 0,
        totalInputCount: 0,
      },
    });
  });

  it("rejects more than ten submitted level responses", () => {
    expect(
      scoreSequenceMemoryAttempt(12345, {
        responses: [
          { level: 1, inputs: [3] },
          { level: 2, inputs: [3, 1] },
          { level: 3, inputs: [3, 1, 1] },
          { level: 4, inputs: [3, 1, 1, 3] },
          { level: 5, inputs: [3, 1, 1, 3, 2] },
          { level: 6, inputs: [3, 1, 1, 3, 2, 1] },
          { level: 7, inputs: [3, 1, 1, 3, 2, 1, 0] },
          { level: 8, inputs: [3, 1, 1, 3, 2, 1, 0, 3] },
          { level: 9, inputs: [3, 1, 1, 3, 2, 1, 0, 3, 3] },
          { level: 10, inputs: [3, 1, 1, 3, 2, 1, 0, 3, 3, 3] },
          { level: 11, inputs: [3] },
        ],
        claimedCompletedLevel: 10,
        clientElapsedMs: 45_000,
      } as unknown as SequenceMemoryEvidence),
    ).toEqual({
      primaryScore: 0,
      secondaryScore: null,
      isValid: false,
      validationReason: "TOO_MANY_LEVEL_RESPONSES",
      metrics: {
        answeredLevelCount: 11,
        maxLevel: MAX_SEQUENCE_MEMORY_LEVEL,
        totalInputCount: 56,
      },
    });
  });

  it("rejects evidence that exceeds the hard 55-input payload cap", () => {
    expect(
      scoreSequenceMemoryAttempt(12345, {
        responses: [
          { level: 1, inputs: [3, 0] },
          { level: 2, inputs: [3, 1] },
          { level: 3, inputs: [3, 1, 1] },
          { level: 4, inputs: [3, 1, 1, 3] },
          { level: 5, inputs: [3, 1, 1, 3, 2] },
          { level: 6, inputs: [3, 1, 1, 3, 2, 1] },
          { level: 7, inputs: [3, 1, 1, 3, 2, 1, 0] },
          { level: 8, inputs: [3, 1, 1, 3, 2, 1, 0, 3] },
          { level: 9, inputs: [3, 1, 1, 3, 2, 1, 0, 3, 3] },
          { level: 10, inputs: [3, 1, 1, 3, 2, 1, 0, 3, 3, 3] },
        ],
        claimedCompletedLevel: 0,
        clientElapsedMs: 45_000,
      } as unknown as SequenceMemoryEvidence),
    ).toEqual({
      primaryScore: 0,
      secondaryScore: null,
      isValid: false,
      validationReason: "TOO_MANY_BUTTON_INPUTS",
      metrics: {
        answeredLevelCount: 10,
        maxInputCount: MAX_SEQUENCE_MEMORY_INPUTS,
        totalInputCount: 56,
      },
    });
  });

  it("enforces the per-level input cap before scanning malformed contents", () => {
    expect(
      scoreSequenceMemoryAttempt(12345, {
        responses: [{ level: 1, inputs: [3, Number.NaN] as unknown as number[] }],
        claimedCompletedLevel: 0,
        clientElapsedMs: 3_000,
      }),
    ).toEqual({
      primaryScore: 0,
      secondaryScore: null,
      isValid: false,
      validationReason: "TOO_MANY_LEVEL_INPUTS",
      metrics: {
        answeredLevelCount: 1,
        invalidLevel: 1,
        inputCount: 2,
        maxLevelInputs: 1,
        totalInputCount: 2,
      },
    });
  });

  it("rejects out-of-range and non-integer button indexes", () => {
    expect(
      scoreSequenceMemoryAttempt(12345, {
        responses: [
          { level: 1, inputs: [3] },
          { level: 2, inputs: [3, 1.5] as unknown as number[] },
        ],
        claimedCompletedLevel: 1,
        clientElapsedMs: 2_000,
      }),
    ).toEqual({
      primaryScore: 0,
      secondaryScore: null,
      isValid: false,
      validationReason: "INVALID_BUTTON_INPUTS",
      metrics: {
        answeredLevelCount: 2,
        invalidLevel: 2,
        totalInputCount: 3,
      },
    });
  });
});
