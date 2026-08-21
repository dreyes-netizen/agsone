import type { SoloGameResult } from "./types";
import { createSeededRandom } from "./random";

const TRIAL_COUNT = 5;
const MIN_WAIT_MS = 1000;
const MAX_WAIT_MS = 3000;
const WAIT_RANGE_SIZE = MAX_WAIT_MS - MIN_WAIT_MS + 1;
const MIN_PLAUSIBLE_REACTION_MS = 100;
const FALSE_START_SCORE_MS = 1000;

export type ReactionChallenge = {
  waitDurationsMs: [number, number, number, number, number];
};

export type ReactionEvidence = {
  reactionMs: [number, number, number, number, number];
  falseStartTrials: number[];
  clientElapsedMs: number;
};

export function createReactionChallenge(seed: number): ReactionChallenge {
  const random = createSeededRandom(seed);

  return {
    waitDurationsMs: buildTrialTuple(() => Math.floor(random() * WAIT_RANGE_SIZE) + MIN_WAIT_MS),
  };
}

export function scoreReactionAttempt(
  challenge: ReactionChallenge,
  evidence: ReactionEvidence,
): SoloGameResult {
  const evidenceTrialCount = Array.isArray(evidence?.reactionMs) ? evidence.reactionMs.length : 0;
  const falseStartCount = Array.isArray(evidence?.falseStartTrials) ? evidence.falseStartTrials.length : 0;

  if (!isValidChallenge(challenge)) {
    return {
      primaryScore: 0,
      secondaryScore: null,
      isValid: false,
      validationReason: "INVALID_CHALLENGE",
      metrics: {
        trialCount: Array.isArray(challenge?.waitDurationsMs) ? challenge.waitDurationsMs.length : 0,
      },
    };
  }

  if (
    !Array.isArray(evidence?.reactionMs) ||
    evidence.reactionMs.length !== TRIAL_COUNT ||
    !Array.isArray(evidence.falseStartTrials) ||
    !Number.isFinite(evidence.clientElapsedMs) ||
    evidence.clientElapsedMs < 0 ||
    !evidence.reactionMs.every((value) => Number.isFinite(value) && value >= 0)
  ) {
    return {
      primaryScore: 0,
      secondaryScore: null,
      isValid: false,
      validationReason: "INVALID_EVIDENCE",
      metrics: {
        falseStartCount,
        trialCount: evidenceTrialCount,
      },
    };
  }

  if (!hasValidFalseStartIndexes(evidence.falseStartTrials)) {
    return {
      primaryScore: 0,
      secondaryScore: null,
      isValid: false,
      validationReason: "INVALID_FALSE_START_INDEXES",
      metrics: {
        falseStartCount,
        trialCount: evidenceTrialCount,
      },
    };
  }

  const falseStartSet = new Set(evidence.falseStartTrials);

  for (const [index, reactionMs] of evidence.reactionMs.entries()) {
    if (!falseStartSet.has(index) && reactionMs < MIN_PLAUSIBLE_REACTION_MS) {
      return {
        primaryScore: 0,
        secondaryScore: null,
        isValid: false,
        validationReason: "IMPOSSIBLE_REACTION_TIME",
        metrics: {
          clientElapsedMs: evidence.clientElapsedMs,
          falseStartCount,
          trialCount: evidenceTrialCount,
        },
      };
    }
  }

  const totalReactionMs = evidence.reactionMs.reduce((sum, reactionMs, index) => {
    return sum + (falseStartSet.has(index) ? FALSE_START_SCORE_MS : reactionMs);
  }, 0);
  const averageReactionMs = Math.round(totalReactionMs / TRIAL_COUNT);

  return {
    primaryScore: averageReactionMs,
    secondaryScore: evidence.clientElapsedMs,
    isValid: true,
    validationReason: null,
    metrics: {
      averageReactionMs,
      clientElapsedMs: evidence.clientElapsedMs,
      falseStartCount,
      totalReactionMs,
      trialCount: evidenceTrialCount,
    },
  };
}

function isValidChallenge(challenge: ReactionChallenge): boolean {
  return (
    Array.isArray(challenge?.waitDurationsMs) &&
    challenge.waitDurationsMs.length === TRIAL_COUNT &&
    challenge.waitDurationsMs.every(
      (value) =>
        Number.isInteger(value) &&
        value >= MIN_WAIT_MS &&
        value <= MAX_WAIT_MS,
    )
  );
}

function hasValidFalseStartIndexes(falseStartTrials: number[]): boolean {
  const uniqueIndexes = new Set<number>();

  for (const index of falseStartTrials) {
    if (!Number.isInteger(index) || index < 0 || index >= TRIAL_COUNT || uniqueIndexes.has(index)) {
      return false;
    }

    uniqueIndexes.add(index);
  }

  return true;
}

function buildTrialTuple(factory: () => number): [number, number, number, number, number] {
  return [factory(), factory(), factory(), factory(), factory()];
}
