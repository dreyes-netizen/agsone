import type { SoloGameResult } from "./types";
import { createSeededRandom } from "./random";
import { TYPING_PASSAGES } from "./typingPassages";

const RANKED_DURATION_MS = 60_000;
const MIN_VALID_ACCURACY_BP = 9_500;

export type TypingChallenge = {
  passageId: string;
  passageText: string;
  durationMs: number;
};

export type TypingEvidence = {
  typedText: string;
  clientElapsedMs: number;
};

export function createTypingChallenge(seed: number): TypingChallenge {
  const random = createSeededRandom(seed);
  const passage = TYPING_PASSAGES[Math.floor(random() * TYPING_PASSAGES.length)] ?? TYPING_PASSAGES[0];

  return {
    passageId: passage.id,
    passageText: passage.text,
    durationMs: RANKED_DURATION_MS,
  };
}

export function scoreTypingAttempt(
  challenge: TypingChallenge,
  evidence: TypingEvidence,
  authoritativeElapsedMs: number,
): SoloGameResult {
  const baseMetrics = {
    passageId: challenge.passageId,
  };

  if (
    !Number.isFinite(authoritativeElapsedMs) ||
    authoritativeElapsedMs <= 0 ||
    typeof evidence?.typedText !== "string" ||
    !Number.isFinite(evidence?.clientElapsedMs) ||
    evidence.clientElapsedMs < 0
  ) {
    return {
      primaryScore: 0,
      secondaryScore: null,
      isValid: false,
      validationReason: "INVALID_EVIDENCE",
      metrics: baseMetrics,
    };
  }

  const canonicalPassage = TYPING_PASSAGES.find((passage) => passage.id === challenge.passageId);

  if (
    !canonicalPassage ||
    challenge.passageText !== canonicalPassage.text ||
    challenge.durationMs !== RANKED_DURATION_MS
  ) {
    return {
      primaryScore: 0,
      secondaryScore: null,
      isValid: false,
      validationReason: "INVALID_CHALLENGE",
      metrics: baseMetrics,
    };
  }

  if (authoritativeElapsedMs < RANKED_DURATION_MS) {
    return {
      primaryScore: 0,
      secondaryScore: null,
      isValid: false,
      validationReason: "INVALID_ELAPSED_TIME",
      metrics: {
        ...baseMetrics,
        authoritativeElapsedMs,
        clientElapsedMs: evidence.clientElapsedMs,
      },
    };
  }

  const normalizedElapsedMs = Math.min(authoritativeElapsedMs, RANKED_DURATION_MS);
  const normalizedMetrics = {
    ...baseMetrics,
    authoritativeElapsedMs: normalizedElapsedMs,
    clientElapsedMs: evidence.clientElapsedMs,
  };

  if (evidence.typedText.length > canonicalPassage.text.length) {
    return {
      primaryScore: 0,
      secondaryScore: null,
      isValid: false,
      validationReason: "TEXT_TOO_LONG",
      metrics: normalizedMetrics,
    };
  }

  const typedChars = evidence.typedText.length;
  const correctChars = countCorrectChars(canonicalPassage.text, evidence.typedText);
  const accuracyBp = Math.round((correctChars / Math.max(typedChars, 1)) * 10_000);
  const primaryScore = Math.floor((correctChars / 5) / (normalizedElapsedMs / RANKED_DURATION_MS));
  const scoredMetrics = {
    ...normalizedMetrics,
    correctChars,
    typedChars,
    accuracyBp,
  };

  if (typedChars === 0) {
    return {
      primaryScore,
      secondaryScore: accuracyBp,
      isValid: false,
      validationReason: "EMPTY_INPUT",
      metrics: scoredMetrics,
    };
  }

  if (accuracyBp < MIN_VALID_ACCURACY_BP) {
    return {
      primaryScore,
      secondaryScore: accuracyBp,
      isValid: false,
      validationReason: "ACCURACY_TOO_LOW",
      metrics: scoredMetrics,
    };
  }

  return {
    primaryScore,
    secondaryScore: accuracyBp,
    isValid: true,
    validationReason: null,
    metrics: scoredMetrics,
  };
}

function countCorrectChars(targetText: string, typedText: string): number {
  let correctChars = 0;

  for (let index = 0; index < typedText.length; index += 1) {
    if (typedText[index] === targetText[index]) {
      correctChars += 1;
    }
  }

  return correctChars;
}
