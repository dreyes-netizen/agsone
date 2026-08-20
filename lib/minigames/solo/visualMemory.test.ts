import { describe, expect, it } from "vitest";
import {
  MAX_VISUAL_MEMORY_LEVEL,
  createVisualMemoryBoard,
  scoreVisualMemoryAttempt,
  type VisualMemoryBoard,
  type VisualMemoryEvidence,
} from "./visualMemory";

const LEVEL_THREE_BOARD: VisualMemoryBoard = {
  level: 3,
  gridSize: 4,
  highlightedCellCount: 5,
  highlightedIndexes: [5, 6, 9, 11, 14],
};

describe("createVisualMemoryBoard", () => {
  it("returns the same highlighted cells for the same ranked seed and level", () => {
    expect(createVisualMemoryBoard(12345, 1)).toEqual({
      level: 1,
      gridSize: 3,
      highlightedCellCount: 3,
      highlightedIndexes: [2, 7, 8],
    });

    expect(createVisualMemoryBoard(12345, 3)).toEqual(LEVEL_THREE_BOARD);
    expect(createVisualMemoryBoard(12345, 10)).toEqual({
      level: 10,
      gridSize: 6,
      highlightedCellCount: 12,
      highlightedIndexes: [3, 7, 9, 13, 15, 17, 18, 20, 22, 23, 28, 30],
    });
  });

  it("follows the locked V1 grid progression and highlighted counts", () => {
    expect(createVisualMemoryBoard(222, 2)).toMatchObject({
      level: 2,
      gridSize: 3,
      highlightedCellCount: 4,
    });
    expect(createVisualMemoryBoard(222, 5)).toMatchObject({
      level: 5,
      gridSize: 4,
      highlightedCellCount: 7,
    });
    expect(createVisualMemoryBoard(222, 8)).toMatchObject({
      level: 8,
      gridSize: 5,
      highlightedCellCount: 10,
    });
    expect(createVisualMemoryBoard(222, 9)).toMatchObject({
      level: 9,
      gridSize: 6,
      highlightedCellCount: 11,
    });
  });

  it("rejects levels outside the accepted ranked range", () => {
    expect(() => createVisualMemoryBoard(12345, 0)).toThrow("level");
    expect(() => createVisualMemoryBoard(12345, 11)).toThrow("level");
  });
});

describe("scoreVisualMemoryAttempt", () => {
  it("scores contiguous correct levels until the first wrong answer and uses elapsed milliseconds as the tiebreak", () => {
    expect(
      scoreVisualMemoryAttempt(12345, {
        answers: [
          { level: 1, selectedIndexes: [2, 7, 8] },
          { level: 2, selectedIndexes: [1, 3, 4, 6] },
          { level: 3, selectedIndexes: [5, 6, 9, 11, 14] },
          { level: 4, selectedIndexes: [1, 4, 7, 11, 12, 13] },
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
      },
    });
  });

  it("accepts a perfect ten-level run without requiring a trailing wrong answer", () => {
    expect(
      scoreVisualMemoryAttempt(12345, {
        answers: [
          { level: 1, selectedIndexes: [2, 7, 8] },
          { level: 2, selectedIndexes: [1, 3, 4, 6] },
          { level: 3, selectedIndexes: [5, 6, 9, 11, 14] },
          { level: 4, selectedIndexes: [1, 4, 7, 11, 12, 14] },
          { level: 5, selectedIndexes: [3, 4, 8, 11, 13, 14, 15] },
          { level: 6, selectedIndexes: [3, 6, 10, 15, 16, 17, 20, 24] },
          { level: 7, selectedIndexes: [1, 2, 4, 9, 12, 14, 21, 23, 24] },
          { level: 8, selectedIndexes: [1, 2, 3, 5, 6, 8, 16, 19, 20, 23] },
          { level: 9, selectedIndexes: [2, 5, 6, 15, 19, 22, 24, 26, 27, 34, 35] },
          { level: 10, selectedIndexes: [3, 7, 9, 13, 15, 17, 18, 20, 22, 23, 28, 30] },
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
      },
    });
  });

  it("rejects evidence with duplicate selected indexes for a level", () => {
    expect(
      scoreVisualMemoryAttempt(12345, {
        answers: [{ level: 1, selectedIndexes: [2, 2, 8] }],
        claimedCompletedLevel: 0,
        clientElapsedMs: 1_000,
      }),
    ).toEqual({
      primaryScore: 0,
      secondaryScore: null,
      isValid: false,
      validationReason: "INVALID_SELECTED_INDEXES",
      metrics: {
        answeredLevelCount: 1,
        invalidLevel: 1,
      },
    });
  });

  it("rejects out-of-range selected indexes for the current grid", () => {
    expect(
      scoreVisualMemoryAttempt(12345, {
        answers: [{ level: 1, selectedIndexes: [2, 7, 9] }],
        claimedCompletedLevel: 0,
        clientElapsedMs: 1_000,
      }),
    ).toEqual({
      primaryScore: 0,
      secondaryScore: null,
      isValid: false,
      validationReason: "INVALID_SELECTED_INDEXES",
      metrics: {
        answeredLevelCount: 1,
        invalidLevel: 1,
      },
    });
  });

  it("rejects non-contiguous or mismatched answer levels instead of inferring progression", () => {
    expect(
      scoreVisualMemoryAttempt(12345, {
        answers: [
          { level: 1, selectedIndexes: [2, 7, 8] },
          { level: 3, selectedIndexes: [5, 6, 9, 11, 14] },
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

  it("rejects any evidence after the first wrong answer", () => {
    expect(
      scoreVisualMemoryAttempt(12345, {
        answers: [
          { level: 1, selectedIndexes: [2, 7, 8] },
          { level: 2, selectedIndexes: [1, 3, 4, 6] },
          { level: 3, selectedIndexes: [5, 6, 9, 11, 15] },
          { level: 4, selectedIndexes: [1, 4, 7, 11, 12, 14] },
        ],
        claimedCompletedLevel: 2,
        clientElapsedMs: 8_000,
      }),
    ).toEqual({
      primaryScore: 0,
      secondaryScore: null,
      isValid: false,
      validationReason: "EXTRA_ANSWERS_AFTER_FAILURE",
      metrics: {
        answeredLevelCount: 4,
        completedLevel: 2,
        failedLevel: 3,
      },
    });
  });

  it("rejects claimed completed levels that exceed the validated evidence", () => {
    expect(
      scoreVisualMemoryAttempt(12345, {
        answers: [
          { level: 1, selectedIndexes: [2, 7, 8] },
          { level: 2, selectedIndexes: [1, 3, 4, 6] },
          { level: 3, selectedIndexes: [5, 6, 9, 11, 15] },
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
      },
    });
  });

  it("rejects malformed elapsed times", () => {
    expect(
      scoreVisualMemoryAttempt(12345, {
        answers: [{ level: 1, selectedIndexes: [2, 7, 8] }],
        claimedCompletedLevel: 0,
        clientElapsedMs: Number.POSITIVE_INFINITY,
      }),
    ).toEqual({
      primaryScore: 0,
      secondaryScore: null,
      isValid: false,
      validationReason: "INVALID_EVIDENCE",
      metrics: {
        answeredLevelCount: 1,
      },
    });
  });

  it("rejects empty answers instead of treating them as a valid scoreless run", () => {
    expect(
      scoreVisualMemoryAttempt(12345, {
        answers: [],
        claimedCompletedLevel: 0,
        clientElapsedMs: 0,
      }),
    ).toEqual({
      primaryScore: 0,
      secondaryScore: null,
      isValid: false,
      validationReason: "INVALID_EVIDENCE",
      metrics: {
        answeredLevelCount: 0,
      },
    });
  });

  it("rejects more than ten submitted level answers as an oversized payload", () => {
    expect(
      scoreVisualMemoryAttempt(12345, {
        answers: [
          { level: 1, selectedIndexes: [2, 7, 8] },
          { level: 2, selectedIndexes: [1, 3, 4, 6] },
          { level: 3, selectedIndexes: [5, 6, 9, 11, 14] },
          { level: 4, selectedIndexes: [1, 4, 7, 11, 12, 14] },
          { level: 5, selectedIndexes: [3, 4, 8, 11, 13, 14, 15] },
          { level: 6, selectedIndexes: [3, 6, 10, 15, 16, 17, 20, 24] },
          { level: 7, selectedIndexes: [1, 2, 4, 9, 12, 14, 21, 23, 24] },
          { level: 8, selectedIndexes: [1, 2, 3, 5, 6, 8, 16, 19, 20, 23] },
          { level: 9, selectedIndexes: [2, 5, 6, 15, 19, 22, 24, 26, 27, 34, 35] },
          { level: 10, selectedIndexes: [3, 7, 9, 13, 15, 17, 18, 20, 22, 23, 28, 30] },
          { level: 11, selectedIndexes: [0] },
        ],
        claimedCompletedLevel: 10,
        clientElapsedMs: 45_000,
      } as unknown as VisualMemoryEvidence),
    ).toEqual({
      primaryScore: 0,
      secondaryScore: null,
      isValid: false,
      validationReason: "TOO_MANY_LEVEL_ANSWERS",
      metrics: {
        answeredLevelCount: 11,
        maxLevel: MAX_VISUAL_MEMORY_LEVEL,
      },
    });
  });

  it("enforces the per-level selected-index cap before scanning malformed contents", () => {
    expect(
      scoreVisualMemoryAttempt(12345, {
        answers: [
          { level: 1, selectedIndexes: [0, 1, 2, Number.NaN] as unknown as number[] },
        ],
        claimedCompletedLevel: 0,
        clientElapsedMs: 3_000,
      }),
    ).toEqual({
      primaryScore: 0,
      secondaryScore: null,
      isValid: false,
      validationReason: "TOO_MANY_SELECTED_INDEXES",
      metrics: {
        answeredLevelCount: 1,
        expectedSelectedCount: 3,
        invalidLevel: 1,
        selectedCount: 4,
      },
    });
  });

  it("rejects per-level selections larger than the locked highlighted count", () => {
    expect(
      scoreVisualMemoryAttempt(12345, {
        answers: [
          { level: 1, selectedIndexes: [0, 2, 5, 7] },
        ],
        claimedCompletedLevel: 0,
        clientElapsedMs: 3_000,
      }),
    ).toEqual({
      primaryScore: 0,
      secondaryScore: null,
      isValid: false,
      validationReason: "TOO_MANY_SELECTED_INDEXES",
      metrics: {
        answeredLevelCount: 1,
        expectedSelectedCount: 3,
        invalidLevel: 1,
        selectedCount: 4,
      },
    });
  });
});
