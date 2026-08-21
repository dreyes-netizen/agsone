import { describe, expect, it, vi } from "vitest";
import { runPhaseFocusEffect } from "./phaseFocusEffect";

describe("focusOnPhase", () => {
  it("focuses each game control only when its interactive phase begins", () => {
    const reactionTarget = { focus: vi.fn() };
    const visualGridTarget = { focus: vi.fn() };
    const sequenceTarget = { focus: vi.fn() };

    runPhaseFocusEffect("waiting", "ready", { current: reactionTarget });
    runPhaseFocusEffect("ready", "ready", { current: reactionTarget });
    runPhaseFocusEffect("selecting", "selecting", { current: visualGridTarget });
    runPhaseFocusEffect("input", "input", { current: sequenceTarget });

    expect(reactionTarget.focus).toHaveBeenCalledOnce();
    expect(visualGridTarget.focus).toHaveBeenCalledOnce();
    expect(sequenceTarget.focus).toHaveBeenCalledOnce();
  });
});
