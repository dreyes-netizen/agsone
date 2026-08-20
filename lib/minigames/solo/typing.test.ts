import { describe, expect, it } from "vitest";
import { TYPING_PASSAGES } from "./typingPassages";
import { createTypingChallenge, scoreTypingAttempt, type TypingChallenge } from "./typing";

const PERFECT_MINUTE_CHALLENGE: TypingChallenge = {
  passageId: "perfect-minute",
  passageText: "calm fingers keep time as bright letters flow across the screen and each steady breath turns practice into a quiet daily win.",
  durationMs: 60_000,
};

const THRESHOLD_CHALLENGE: TypingChallenge = {
  passageId: "threshold",
  passageText: "practice builds pace",
  durationMs: 60_000,
};

describe("createTypingChallenge", () => {
  it("returns the same ranked challenge for the same seed", () => {
    const first = createTypingChallenge(12345);
    const second = createTypingChallenge(12345);

    expect(first).toEqual(second);
    expect(first.durationMs).toBe(60_000);
    expect(TYPING_PASSAGES).toContainEqual({
      id: first.passageId,
      text: first.passageText,
    });
  });
});

describe("scoreTypingAttempt", () => {
  it("scores a perfect 60-second attempt with integer WPM and full accuracy", () => {
    expect(
      scoreTypingAttempt(
        PERFECT_MINUTE_CHALLENGE,
        {
          typedText: PERFECT_MINUTE_CHALLENGE.passageText,
          clientElapsedMs: 60_000,
        },
        60_000,
      ),
    ).toEqual({
      primaryScore: 25,
      secondaryScore: 10_000,
      isValid: true,
      validationReason: null,
      metrics: {
        authoritativeElapsedMs: 60_000,
        clientElapsedMs: 60_000,
        correctChars: 125,
        typedChars: 125,
        accuracyBp: 10_000,
        passageId: "perfect-minute",
      },
    });
  });

  it("computes accuracy in basis points from character matches", () => {
    expect(
      scoreTypingAttempt(
        THRESHOLD_CHALLENGE,
        {
          typedText: "practice builds pzce",
          clientElapsedMs: 60_000,
        },
        60_000,
      ),
    ).toEqual({
      primaryScore: 3,
      secondaryScore: 9_500,
      isValid: true,
      validationReason: null,
      metrics: {
        authoritativeElapsedMs: 60_000,
        clientElapsedMs: 60_000,
        correctChars: 19,
        typedChars: 20,
        accuracyBp: 9_500,
        passageId: "threshold",
      },
    });
  });

  it("invalidates ranked results below 95 percent accuracy", () => {
    expect(
      scoreTypingAttempt(
        THRESHOLD_CHALLENGE,
        {
          typedText: "practice buxlds pzce",
          clientElapsedMs: 60_000,
        },
        60_000,
      ),
    ).toEqual({
      primaryScore: 3,
      secondaryScore: 9_000,
      isValid: false,
      validationReason: "ACCURACY_TOO_LOW",
      metrics: {
        authoritativeElapsedMs: 60_000,
        clientElapsedMs: 60_000,
        correctChars: 18,
        typedChars: 20,
        accuracyBp: 9_000,
        passageId: "threshold",
      },
    });
  });

  it("rejects empty text submissions", () => {
    expect(
      scoreTypingAttempt(
        THRESHOLD_CHALLENGE,
        {
          typedText: "",
          clientElapsedMs: 60_000,
        },
        60_000,
      ),
    ).toEqual({
      primaryScore: 0,
      secondaryScore: 0,
      isValid: false,
      validationReason: "EMPTY_INPUT",
      metrics: {
        authoritativeElapsedMs: 60_000,
        clientElapsedMs: 60_000,
        correctChars: 0,
        typedChars: 0,
        accuracyBp: 0,
        passageId: "threshold",
      },
    });
  });

  it("rejects oversized submissions before scoring", () => {
    expect(
      scoreTypingAttempt(
        THRESHOLD_CHALLENGE,
        {
          typedText: "practice builds pace now",
          clientElapsedMs: 60_000,
        },
        60_000,
      ),
    ).toEqual({
      primaryScore: 0,
      secondaryScore: null,
      isValid: false,
      validationReason: "TEXT_TOO_LONG",
      metrics: {
        authoritativeElapsedMs: 60_000,
        clientElapsedMs: 60_000,
        passageId: "threshold",
      },
    });
  });

  it("rejects malformed evidence payloads", () => {
    expect(
      scoreTypingAttempt(
        THRESHOLD_CHALLENGE,
        {
          typedText: 42,
          clientElapsedMs: Number.NaN,
        } as unknown as {
          typedText: string;
          clientElapsedMs: number;
        },
        Number.POSITIVE_INFINITY,
      ),
    ).toEqual({
      primaryScore: 0,
      secondaryScore: null,
      isValid: false,
      validationReason: "INVALID_EVIDENCE",
      metrics: {
        passageId: "threshold",
      },
    });
  });

  it("uses authoritative elapsed time instead of claimed client speed", () => {
    expect(
      scoreTypingAttempt(
        THRESHOLD_CHALLENGE,
        {
          typedText: THRESHOLD_CHALLENGE.passageText,
          clientElapsedMs: 1_000,
        },
        60_000,
      ),
    ).toEqual({
      primaryScore: 4,
      secondaryScore: 10_000,
      isValid: true,
      validationReason: null,
      metrics: {
        authoritativeElapsedMs: 60_000,
        clientElapsedMs: 1_000,
        correctChars: 20,
        typedChars: 20,
        accuracyBp: 10_000,
        passageId: "threshold",
      },
    });
  });
});
