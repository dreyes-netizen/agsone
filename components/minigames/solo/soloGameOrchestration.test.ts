import { describe, expect, it, vi } from "vitest";
import { completeSoloRun, startSoloRun } from "./soloGameOrchestration";

describe("SoloGameShell practice orchestration", () => {
  it("begins and completes a practice run without calling fetch, ranked start, or ranked finish", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const startRanked = vi.fn();
    const finishRanked = vi.fn();
    const challenge = { waitDurationsMs: [1000, 1000, 1000, 1000, 1000] as [number, number, number, number, number] };
    const evidence = { reactionMs: [200, 220, 240, 260, 280] as [number, number, number, number, number], falseStartTrials: [], clientElapsedMs: 1200 };

    const started = await startSoloRun("practice", "REACTION", () => challenge, startRanked);
    const completed = await completeSoloRun("practice", "REACTION", challenge, evidence, () => ({ primaryScore: 240, secondaryScore: 1200, isValid: true, validationReason: null, metrics: {} }), finishRanked);

    expect(started).toEqual({ kind: "practice", challenge });
    expect(completed).toMatchObject({ kind: "practice", result: { primaryScore: 240 } });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(startRanked).not.toHaveBeenCalled();
    expect(finishRanked).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
