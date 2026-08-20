import { describe, expect, it } from "vitest";
import { createReactionChallenge, scoreReactionAttempt, type ReactionChallenge } from "./reaction";

const RANKED_CHALLENGE: ReactionChallenge = {
  waitDurationsMs: [2960, 1613, 1968, 2636, 2019],
};

describe("createReactionChallenge", () => {
  it("returns the same five seeded wait durations for the same seed", () => {
    expect(createReactionChallenge(12345)).toEqual({
      waitDurationsMs: [2960, 1613, 1968, 2636, 2019],
    });
  });

  it("keeps every ranked wait duration as an integer within the approved range", () => {
    expect(createReactionChallenge(67890)).toEqual({
      waitDurationsMs: [1787, 2181, 1726, 1705, 1008],
    });
  });
});

describe("scoreReactionAttempt", () => {
  it("scores five normal reactions by rounded average and elapsed-time tiebreak", () => {
    expect(
      scoreReactionAttempt(RANKED_CHALLENGE, {
        reactionMs: [240, 260, 280, 300, 320],
        falseStartTrials: [],
        clientElapsedMs: 2100,
      }),
    ).toEqual({
      primaryScore: 280,
      secondaryScore: 2100,
      isValid: true,
      validationReason: null,
      metrics: {
        averageReactionMs: 280,
        clientElapsedMs: 2100,
        falseStartCount: 0,
        totalReactionMs: 1400,
        trialCount: 5,
      },
    });
  });

  it("substitutes false starts with a fixed 1000ms trial score", () => {
    expect(
      scoreReactionAttempt(RANKED_CHALLENGE, {
        reactionMs: [240, 260, 50, 300, 320],
        falseStartTrials: [2],
        clientElapsedMs: 2500,
      }),
    ).toEqual({
      primaryScore: 424,
      secondaryScore: 2500,
      isValid: true,
      validationReason: null,
      metrics: {
        averageReactionMs: 424,
        clientElapsedMs: 2500,
        falseStartCount: 1,
        totalReactionMs: 2120,
        trialCount: 5,
      },
    });
  });

  it("invalidates any non-false-start reaction below the plausibility floor", () => {
    expect(
      scoreReactionAttempt(RANKED_CHALLENGE, {
        reactionMs: [240, 99, 280, 300, 320],
        falseStartTrials: [],
        clientElapsedMs: 2100,
      }),
    ).toEqual({
      primaryScore: 0,
      secondaryScore: null,
      isValid: false,
      validationReason: "IMPOSSIBLE_REACTION_TIME",
      metrics: {
        clientElapsedMs: 2100,
        falseStartCount: 0,
        trialCount: 5,
      },
    });
  });

  it("rejects malformed reaction arrays instead of inferring missing trials", () => {
    expect(
      scoreReactionAttempt(RANKED_CHALLENGE, {
        reactionMs: [240, 260, 280, 300] as unknown as [number, number, number, number, number],
        falseStartTrials: [],
        clientElapsedMs: 2100,
      }),
    ).toEqual({
      primaryScore: 0,
      secondaryScore: null,
      isValid: false,
      validationReason: "INVALID_EVIDENCE",
      metrics: {
        falseStartCount: 0,
        trialCount: 4,
      },
    });
  });

  it("rejects duplicate false-start indexes as ambiguous evidence", () => {
    expect(
      scoreReactionAttempt(RANKED_CHALLENGE, {
        reactionMs: [240, 260, 280, 300, 320],
        falseStartTrials: [2, 2],
        clientElapsedMs: 2100,
      }),
    ).toEqual({
      primaryScore: 0,
      secondaryScore: null,
      isValid: false,
      validationReason: "INVALID_FALSE_START_INDEXES",
      metrics: {
        falseStartCount: 2,
        trialCount: 5,
      },
    });
  });

  it("rejects out-of-range false-start indexes", () => {
    expect(
      scoreReactionAttempt(RANKED_CHALLENGE, {
        reactionMs: [240, 260, 280, 300, 320],
        falseStartTrials: [5],
        clientElapsedMs: 2100,
      }),
    ).toEqual({
      primaryScore: 0,
      secondaryScore: null,
      isValid: false,
      validationReason: "INVALID_FALSE_START_INDEXES",
      metrics: {
        falseStartCount: 1,
        trialCount: 5,
      },
    });
  });

  it("rejects non-finite or negative evidence values", () => {
    expect(
      scoreReactionAttempt(RANKED_CHALLENGE, {
        reactionMs: [240, Number.NaN, 280, 300, 320],
        falseStartTrials: [],
        clientElapsedMs: -1,
      }),
    ).toEqual({
      primaryScore: 0,
      secondaryScore: null,
      isValid: false,
      validationReason: "INVALID_EVIDENCE",
      metrics: {
        falseStartCount: 0,
        trialCount: 5,
      },
    });
  });

  it("rejects challenges with malformed ranked wait bounds", () => {
    expect(
      scoreReactionAttempt(
        {
          waitDurationsMs: [1000, 1500, 2000, 2500, 3001],
        },
        {
          reactionMs: [240, 260, 280, 300, 320],
          falseStartTrials: [],
          clientElapsedMs: 2100,
        },
      ),
    ).toEqual({
      primaryScore: 0,
      secondaryScore: null,
      isValid: false,
      validationReason: "INVALID_CHALLENGE",
      metrics: {
        trialCount: 5,
      },
    });
  });
});
