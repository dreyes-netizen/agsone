import { describe, expect, it, vi } from "vitest";
import { createFinishSubmitter, createPracticeResult, finishSubmissionReducer } from "./soloGameRun";

describe("createPracticeResult", () => {
  it("uses the same local engine score instead of fabricating a zero practice result", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const result = createPracticeResult("REACTION", { waitDurationsMs: [1000, 1000, 1000, 1000, 1000] }, {
      reactionMs: [200, 220, 240, 260, 280], falseStartTrials: [], clientElapsedMs: 1200,
    });

    expect(result).toMatchObject({ primaryScore: 240, secondaryScore: 1200, isValid: true });
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});

describe("createFinishSubmitter", () => {
  it("sends once for a click, then retries the preserved evidence exactly once after a failure", async () => {
    const evidence = { typedText: "steady text", clientElapsedMs: 60_000 };
    const send = vi.fn().mockRejectedValueOnce(new Error("Network unavailable")).mockResolvedValueOnce({ ok: true });
    const submit = createFinishSubmitter(send);
    const submitting = finishSubmissionReducer({ status: "idle", evidence: null }, { type: "submit", evidence });

    await expect(Promise.allSettled([submit(evidence), submit(evidence)])).resolves.toHaveLength(2);
    const retryable = finishSubmissionReducer(submitting, { type: "failed", message: "Network unavailable" });
    const retrying = finishSubmissionReducer(retryable, { type: "retry" });
    if (retrying.status !== "submitting") throw new Error("Expected retry to retain finish evidence");
    await submit(retrying.evidence);

    expect(send).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenNthCalledWith(1, evidence);
    expect(send).toHaveBeenNthCalledWith(2, evidence);
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
