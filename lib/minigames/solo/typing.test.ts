import { describe, expect, it } from "vitest";
import { TYPING_PASSAGES } from "./typingPassages";
import { createTypingChallenge, scoreTypingAttempt, type TypingChallenge } from "./typing";

const PERFECT_PASSAGE = TYPING_PASSAGES[0]!;
const THRESHOLD_PASSAGE = TYPING_PASSAGES[1]!;

const PERFECT_MINUTE_CHALLENGE: TypingChallenge = {
  passageId: PERFECT_PASSAGE.id,
  passageText: PERFECT_PASSAGE.text,
  durationMs: 60_000,
};

const THRESHOLD_CHALLENGE: TypingChallenge = {
  passageId: THRESHOLD_PASSAGE.id,
  passageText: THRESHOLD_PASSAGE.text,
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
  it("scores repeated canonical passage input at badge-capable 100 WPM", () => {
    const typedText = PERFECT_MINUTE_CHALLENGE.passageText.repeat(4);

    expect(scoreTypingAttempt(PERFECT_MINUTE_CHALLENGE, { typedText, clientElapsedMs: 60_000 }, 60_000)).toMatchObject({
      primaryScore: 100,
      secondaryScore: 10_000,
      isValid: true,
    });
  });

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
        passageId: PERFECT_PASSAGE.id,
      },
    });
  });

  it("computes accuracy in basis points from character matches", () => {
    expect(
      scoreTypingAttempt(
        THRESHOLD_CHALLENGE,
        {
          typedText: "Every focused session buiads durable speed, because clean strokes and patient rhythm outlast bursts of frantic typing.",
          clientElapsedMs: 60_000,
        },
        60_000,
      ),
    ).toEqual({
      primaryScore: 23,
      secondaryScore: 9_915,
      isValid: true,
      validationReason: null,
      metrics: {
        authoritativeElapsedMs: 60_000,
        clientElapsedMs: 60_000,
        correctChars: 117,
        typedChars: 118,
        accuracyBp: 9_915,
        passageId: THRESHOLD_PASSAGE.id,
      },
    });
  });

  it("invalidates ranked results below 95 percent accuracy", () => {
    expect(
      scoreTypingAttempt(
        THRESHOLD_CHALLENGE,
        {
          typedText: "Every xocused sessiox builds durablx speed, becausx clean strokesxand patient rhxthm outlast bursts of frantic typing.",
          clientElapsedMs: 60_000,
        },
        60_000,
      ),
    ).toEqual({
      primaryScore: 22,
      secondaryScore: 9_492,
      isValid: false,
      validationReason: "ACCURACY_TOO_LOW",
      metrics: {
        authoritativeElapsedMs: 60_000,
        clientElapsedMs: 60_000,
        correctChars: 112,
        typedChars: 118,
        accuracyBp: 9_492,
        passageId: THRESHOLD_PASSAGE.id,
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
        passageId: THRESHOLD_PASSAGE.id,
      },
    });
  });

  it("rejects submissions above the bounded repeated-passage input size", () => {
    expect(
      scoreTypingAttempt(
        THRESHOLD_CHALLENGE,
        {
          typedText: THRESHOLD_CHALLENGE.passageText.repeat(5),
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
        passageId: THRESHOLD_PASSAGE.id,
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
        passageId: THRESHOLD_PASSAGE.id,
      },
    });
  });

  it("rejects zero authoritative elapsed time", () => {
    expect(
      scoreTypingAttempt(
        THRESHOLD_CHALLENGE,
        {
          typedText: THRESHOLD_CHALLENGE.passageText,
          clientElapsedMs: 60_000,
        },
        0,
      ),
    ).toEqual({
      primaryScore: 0,
      secondaryScore: null,
      isValid: false,
      validationReason: "INVALID_EVIDENCE",
      metrics: {
        passageId: THRESHOLD_PASSAGE.id,
      },
    });
  });

  it("rejects negative authoritative elapsed time", () => {
    expect(
      scoreTypingAttempt(
        THRESHOLD_CHALLENGE,
        {
          typedText: THRESHOLD_CHALLENGE.passageText,
          clientElapsedMs: 60_000,
        },
        -1,
      ),
    ).toEqual({
      primaryScore: 0,
      secondaryScore: null,
      isValid: false,
      validationReason: "INVALID_EVIDENCE",
      metrics: {
        passageId: THRESHOLD_PASSAGE.id,
      },
    });
  });

  it("rejects authoritative elapsed time below the fixed ranked minute", () => {
    expect(
      scoreTypingAttempt(
        THRESHOLD_CHALLENGE,
        {
          typedText: THRESHOLD_CHALLENGE.passageText,
          clientElapsedMs: 10_000,
        },
        59_999,
      ),
    ).toEqual({
      primaryScore: 0,
      secondaryScore: null,
      isValid: false,
      validationReason: "INVALID_ELAPSED_TIME",
      metrics: {
        authoritativeElapsedMs: 59_999,
        clientElapsedMs: 10_000,
        passageId: THRESHOLD_PASSAGE.id,
      },
    });
  });

  it("accepts exactly sixty seconds as the ranked completion window", () => {
    expect(
      scoreTypingAttempt(
        THRESHOLD_CHALLENGE,
        {
          typedText: THRESHOLD_CHALLENGE.passageText,
          clientElapsedMs: 60_000,
        },
        60_000,
      ),
    ).toEqual({
      primaryScore: 23,
      secondaryScore: 10_000,
      isValid: true,
      validationReason: null,
      metrics: {
        authoritativeElapsedMs: 60_000,
        clientElapsedMs: 60_000,
        correctChars: 118,
        typedChars: 118,
        accuracyBp: 10_000,
        passageId: THRESHOLD_PASSAGE.id,
      },
    });
  });

  it("clamps authoritative elapsed time above the ranked minute", () => {
    expect(
      scoreTypingAttempt(
        THRESHOLD_CHALLENGE,
        {
          typedText: THRESHOLD_CHALLENGE.passageText,
          clientElapsedMs: 70_000,
        },
        75_000,
      ),
    ).toEqual({
      primaryScore: 23,
      secondaryScore: 10_000,
      isValid: true,
      validationReason: null,
      metrics: {
        authoritativeElapsedMs: 60_000,
        clientElapsedMs: 70_000,
        correctChars: 118,
        typedChars: 118,
        accuracyBp: 10_000,
        passageId: THRESHOLD_PASSAGE.id,
      },
    });
  });

  it("rejects challenges that do not match the canonical passage bank", () => {
    expect(
      scoreTypingAttempt(
        {
          passageId: THRESHOLD_PASSAGE.id,
          passageText: "tampered passage text",
          durationMs: 60_000,
        },
        {
          typedText: "tampered passage text",
          clientElapsedMs: 60_000,
        },
        60_000,
      ),
    ).toEqual({
      primaryScore: 0,
      secondaryScore: null,
      isValid: false,
      validationReason: "INVALID_CHALLENGE",
      metrics: {
        passageId: THRESHOLD_PASSAGE.id,
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
      primaryScore: 23,
      secondaryScore: 10_000,
      isValid: true,
      validationReason: null,
      metrics: {
        authoritativeElapsedMs: 60_000,
        clientElapsedMs: 1_000,
        correctChars: 118,
        typedChars: 118,
        accuracyBp: 10_000,
        passageId: THRESHOLD_PASSAGE.id,
      },
    });
  });
});
