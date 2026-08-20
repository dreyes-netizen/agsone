import { describe, expect, it, vi } from "vitest";
import { focusOnPhase } from "./focusTransition";

describe("focusOnPhase", () => {
  it("focuses each game control only when its interactive phase begins", () => {
    const reactionTarget = { focus: vi.fn() };
    const visualGridTarget = { focus: vi.fn() };
    const sequenceTarget = { focus: vi.fn() };

    focusOnPhase("waiting", "ready", reactionTarget);
    focusOnPhase("selecting", "selecting", visualGridTarget);
    focusOnPhase("input", "input", sequenceTarget);

    expect(reactionTarget.focus).not.toHaveBeenCalled();
    expect(visualGridTarget.focus).toHaveBeenCalledOnce();
    expect(sequenceTarget.focus).toHaveBeenCalledOnce();
  });
});
