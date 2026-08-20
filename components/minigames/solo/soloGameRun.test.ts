import { describe, expect, it } from "vitest";
import { createPracticeResult, finishSubmissionReducer } from "./soloGameRun";

describe("createPracticeResult", () => {
  it("uses the same local engine score instead of fabricating a zero practice result", () => {
    const result = createPracticeResult("REACTION", { waitDurationsMs: [1000, 1000, 1000, 1000, 1000] }, {
      reactionMs: [200, 220, 240, 260, 280], falseStartTrials: [], clientElapsedMs: 1200,
    });

    expect(result).toMatchObject({ primaryScore: 240, secondaryScore: 1200, isValid: true });
  });
});

describe("finishSubmissionReducer", () => {
  it("retains a completed game's compact evidence after a failed finish so retry sends the same attempt once", () => {
    const evidence = { typedText: "steady text", clientElapsedMs: 60_000 };
    const submitting = finishSubmissionReducer({ status: "idle", evidence: null }, { type: "submit", evidence });
    const retryable = finishSubmissionReducer(submitting, { type: "failed", message: "Network unavailable" });

    expect(retryable).toEqual({ status: "retryable", evidence, message: "Network unavailable" });
    expect(finishSubmissionReducer(retryable, { type: "retry" })).toEqual({ status: "submitting", evidence, message: null });
  });
});
