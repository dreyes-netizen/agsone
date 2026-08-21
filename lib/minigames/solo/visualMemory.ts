import type { SoloGameResult } from "./types";
import { createSeededRandom } from "./random";

const LEVEL_GRID_SIDES = [
  { maxLevel: 2, gridSize: 3 },
  { maxLevel: 5, gridSize: 4 },
  { maxLevel: 8, gridSize: 5 },
  { maxLevel: 10, gridSize: 6 },
] as const;

const BOARD_SEED_MULTIPLIER = 0x9e3779b1;
const BOARD_SEED_OFFSET = 0x85ebca6b;

export const MAX_VISUAL_MEMORY_LEVEL = 10;

export type VisualMemoryBoard = {
  level: number;
  gridSize: number;
  highlightedCellCount: number;
  highlightedIndexes: number[];
};

export type VisualMemoryAnswer = {
  level: number;
  selectedIndexes: number[];
};

export type VisualMemoryEvidence = {
  answers: VisualMemoryAnswer[];
  claimedCompletedLevel: number;
  clientElapsedMs: number;
};

export function createVisualMemoryBoard(seed: number, level: number): VisualMemoryBoard {
  assertValidLevel(level);

  const gridSize = getGridSize(level);
  const highlightedCellCount = getHighlightedCellCount(level);
  const random = createSeededRandom(mixBoardSeed(seed, level));
  const highlightedIndexes = pickUniqueIndexes(random, gridSize * gridSize, highlightedCellCount);

  highlightedIndexes.sort((left, right) => left - right);

  return {
    level,
    gridSize,
    highlightedCellCount,
    highlightedIndexes,
  };
}

export function scoreVisualMemoryAttempt(seed: number, evidence: VisualMemoryEvidence): SoloGameResult {
  const answeredLevelCount = Array.isArray(evidence?.answers) ? evidence.answers.length : 0;

  if (
    !Array.isArray(evidence?.answers) ||
    evidence.answers.length === 0 ||
    !Number.isFinite(evidence?.clientElapsedMs) ||
    evidence.clientElapsedMs < 0 ||
    !Number.isInteger(evidence?.claimedCompletedLevel) ||
    evidence.claimedCompletedLevel < 0
  ) {
    return {
      primaryScore: 0,
      secondaryScore: null,
      isValid: false,
      validationReason: "INVALID_EVIDENCE",
      metrics: {
        answeredLevelCount,
      },
    };
  }

  if (evidence.answers.length > MAX_VISUAL_MEMORY_LEVEL) {
    return {
      primaryScore: 0,
      secondaryScore: null,
      isValid: false,
      validationReason: "TOO_MANY_LEVEL_ANSWERS",
      metrics: {
        answeredLevelCount,
        maxLevel: MAX_VISUAL_MEMORY_LEVEL,
      },
    };
  }

  let completedLevel = 0;
  let failedLevel: number | null = null;

  for (const [index, answer] of evidence.answers.entries()) {
    const expectedLevel = index + 1;

    if (!hasValidAnswerEnvelope(answer) || answer.level !== expectedLevel) {
      return {
        primaryScore: 0,
        secondaryScore: null,
        isValid: false,
        validationReason: "NON_CONTIGUOUS_LEVELS",
        metrics: {
          answeredLevelCount,
          invalidLevel: Number.isInteger(answer?.level) ? answer.level : expectedLevel,
        },
      };
    }

    const board = createVisualMemoryBoard(seed, answer.level);

    if (answer.selectedIndexes.length > board.highlightedCellCount) {
      return {
        primaryScore: 0,
        secondaryScore: null,
        isValid: false,
        validationReason: "TOO_MANY_SELECTED_INDEXES",
        metrics: {
          answeredLevelCount,
          expectedSelectedCount: board.highlightedCellCount,
          invalidLevel: answer.level,
          selectedCount: answer.selectedIndexes.length,
        },
      };
    }

    if (!hasValidSelectedIndexes(answer.selectedIndexes, board.gridSize * board.gridSize)) {
      return {
        primaryScore: 0,
        secondaryScore: null,
        isValid: false,
        validationReason: "INVALID_SELECTED_INDEXES",
        metrics: {
          answeredLevelCount,
          invalidLevel: answer.level,
        },
      };
    }

    const isCorrect = hasExactSetMatch(answer.selectedIndexes, board.highlightedIndexes);

    if (!isCorrect) {
      failedLevel = answer.level;

      if (index !== evidence.answers.length - 1) {
        return {
          primaryScore: 0,
          secondaryScore: null,
          isValid: false,
          validationReason: "EXTRA_ANSWERS_AFTER_FAILURE",
          metrics: {
            answeredLevelCount,
            completedLevel,
            failedLevel,
          },
        };
      }

      break;
    }

    completedLevel = answer.level;
  }

  if (evidence.claimedCompletedLevel !== completedLevel) {
    return {
      primaryScore: 0,
      secondaryScore: null,
      isValid: false,
      validationReason: "CLAIMED_LEVEL_MISMATCH",
      metrics: {
        answeredLevelCount,
        claimedCompletedLevel: evidence.claimedCompletedLevel,
        completedLevel,
      },
    };
  }

  return {
    primaryScore: completedLevel,
    secondaryScore: evidence.clientElapsedMs,
    isValid: true,
    validationReason: null,
    metrics: {
      answeredLevelCount,
      clientElapsedMs: evidence.clientElapsedMs,
      completedLevel,
      ...(failedLevel === null ? {} : { failedLevel }),
    },
  };
}

function assertValidLevel(level: number) {
  if (!Number.isInteger(level) || level < 1 || level > MAX_VISUAL_MEMORY_LEVEL) {
    throw new Error(`Invalid visual memory level: ${level}`);
  }
}

function getGridSize(level: number): number {
  for (const entry of LEVEL_GRID_SIDES) {
    if (level <= entry.maxLevel) {
      return entry.gridSize;
    }
  }

  throw new Error(`Unsupported visual memory level: ${level}`);
}

function getHighlightedCellCount(level: number): number {
  return level + 2;
}

function mixBoardSeed(seed: number, level: number): number {
  return (((seed >>> 0) ^ Math.imul(level, BOARD_SEED_MULTIPLIER)) + Math.imul(level + 11, BOARD_SEED_OFFSET)) >>> 0;
}

function pickUniqueIndexes(random: () => number, gridCellCount: number, highlightedCellCount: number): number[] {
  const seen = new Set<number>();
  const highlightedIndexes: number[] = [];

  while (highlightedIndexes.length < highlightedCellCount) {
    const nextIndex = Math.floor(random() * gridCellCount);

    if (seen.has(nextIndex)) {
      continue;
    }

    seen.add(nextIndex);
    highlightedIndexes.push(nextIndex);
  }

  return highlightedIndexes;
}

function hasValidAnswerEnvelope(answer: VisualMemoryAnswer): answer is VisualMemoryAnswer {
  return (
    Number.isInteger(answer?.level) &&
    Array.isArray(answer?.selectedIndexes)
  );
}

function hasValidSelectedIndexes(selectedIndexes: number[], gridCellCount: number): boolean {
  const seen = new Set<number>();

  for (const selectedIndex of selectedIndexes) {
    if (!Number.isInteger(selectedIndex) || selectedIndex < 0 || selectedIndex >= gridCellCount || seen.has(selectedIndex)) {
      return false;
    }

    seen.add(selectedIndex);
  }

  return true;
}

function hasExactSetMatch(selectedIndexes: number[], highlightedIndexes: number[]): boolean {
  if (selectedIndexes.length !== highlightedIndexes.length) {
    return false;
  }

  const selectedSet = new Set(selectedIndexes);

  for (const highlightedIndex of highlightedIndexes) {
    if (!selectedSet.has(highlightedIndex)) {
      return false;
    }
  }

  return true;
}
