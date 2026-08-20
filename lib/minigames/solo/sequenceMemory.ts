import { createSeededRandom } from "./random";
import type { SoloGameResult } from "./types";

export const MAX_SEQUENCE_MEMORY_LEVEL = 10;
export const MAX_SEQUENCE_MEMORY_INPUTS = 55;
export const SEQUENCE_MEMORY_BUTTON_COUNT = 4;

export type SequenceMemoryChallenge = {
  sequence: number[];
};

export type SequenceMemoryResponse = {
  level: number;
  inputs: number[];
};

export type SequenceMemoryEvidence = {
  responses: SequenceMemoryResponse[];
  claimedCompletedLevel: number;
  clientElapsedMs: number;
};

export function createSequenceMemoryChallenge(seed: number): SequenceMemoryChallenge {
  const random = createSeededRandom(seed);

  return {
    sequence: Array.from({ length: MAX_SEQUENCE_MEMORY_LEVEL }, () => Math.floor(random() * SEQUENCE_MEMORY_BUTTON_COUNT)),
  };
}

export function scoreSequenceMemoryAttempt(seed: number, evidence: SequenceMemoryEvidence): SoloGameResult {
  const answeredLevelCount = Array.isArray(evidence?.responses) ? evidence.responses.length : 0;
  const totalInputCount = countInputs(evidence?.responses);

  if (
    !Array.isArray(evidence?.responses) ||
    evidence.responses.length === 0 ||
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
        totalInputCount,
      },
    };
  }

  if (evidence.responses.length > MAX_SEQUENCE_MEMORY_LEVEL) {
    return {
      primaryScore: 0,
      secondaryScore: null,
      isValid: false,
      validationReason: "TOO_MANY_LEVEL_RESPONSES",
      metrics: {
        answeredLevelCount,
        maxLevel: MAX_SEQUENCE_MEMORY_LEVEL,
        totalInputCount,
      },
    };
  }

  if (totalInputCount > MAX_SEQUENCE_MEMORY_INPUTS) {
    return {
      primaryScore: 0,
      secondaryScore: null,
      isValid: false,
      validationReason: "TOO_MANY_BUTTON_INPUTS",
      metrics: {
        answeredLevelCount,
        maxInputCount: MAX_SEQUENCE_MEMORY_INPUTS,
        totalInputCount,
      },
    };
  }

  const challenge = createSequenceMemoryChallenge(seed);
  let completedLevel = 0;
  let failedLevel: number | null = null;

  for (const [index, response] of evidence.responses.entries()) {
    const expectedLevel = index + 1;

    if (!hasValidResponseEnvelope(response) || response.level !== expectedLevel) {
      return {
        primaryScore: 0,
        secondaryScore: null,
        isValid: false,
        validationReason: "NON_CONTIGUOUS_LEVELS",
        metrics: {
          answeredLevelCount,
          invalidLevel: Number.isInteger(response?.level) ? response.level : expectedLevel,
        },
      };
    }

    if (response.inputs.length > response.level) {
      return {
        primaryScore: 0,
        secondaryScore: null,
        isValid: false,
        validationReason: "TOO_MANY_LEVEL_INPUTS",
        metrics: {
          answeredLevelCount,
          invalidLevel: response.level,
          inputCount: response.inputs.length,
          maxLevelInputs: response.level,
          totalInputCount,
        },
      };
    }

    if (!hasValidInputs(response.inputs)) {
      return {
        primaryScore: 0,
        secondaryScore: null,
        isValid: false,
        validationReason: "INVALID_BUTTON_INPUTS",
        metrics: {
          answeredLevelCount,
          invalidLevel: response.level,
          totalInputCount,
        },
      };
    }

    const expectedInputs = challenge.sequence.slice(0, response.level);
    const isCorrect = response.inputs.every((input, inputIndex) => input === expectedInputs[inputIndex]);

    if (isCorrect && response.inputs.length < response.level) {
      return {
        primaryScore: 0,
        secondaryScore: null,
        isValid: false,
        validationReason: "TRUNCATED_RESPONSE",
        metrics: {
          answeredLevelCount,
          invalidLevel: response.level,
          providedInputCount: response.inputs.length,
          expectedInputCount: response.level,
          totalInputCount,
        },
      };
    }

    if (!isCorrect) {
      failedLevel = response.level;

      if (index !== evidence.responses.length - 1) {
        return {
          primaryScore: 0,
          secondaryScore: null,
          isValid: false,
          validationReason: "EXTRA_RESPONSES_AFTER_FAILURE",
          metrics: {
            answeredLevelCount,
            completedLevel,
            failedLevel,
            totalInputCount,
          },
        };
      }

      break;
    }

    completedLevel = response.level;
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
        totalInputCount,
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
      totalInputCount,
    },
  };
}

function countInputs(responses: SequenceMemoryEvidence["responses"] | undefined): number {
  if (!Array.isArray(responses)) {
    return 0;
  }

  return responses.reduce((total, response) => total + (Array.isArray(response?.inputs) ? response.inputs.length : 0), 0);
}

function hasValidResponseEnvelope(response: SequenceMemoryResponse): response is SequenceMemoryResponse {
  return Number.isInteger(response?.level) && Array.isArray(response?.inputs);
}

function hasValidInputs(inputs: number[]): boolean {
  return inputs.every(
    (input) =>
      Number.isInteger(input) &&
      input >= 0 &&
      input < SEQUENCE_MEMORY_BUTTON_COUNT,
  );
}
