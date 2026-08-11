import { describe, it, expect } from "vitest";
import { getLevelFromBalance, getLevelProgress } from "./levelUtils";

describe("getLevelFromBalance", () => {
  it("returns level 1 for a zero or negative balance", () => {
    expect(getLevelFromBalance(0)).toBe(1);
    expect(getLevelFromBalance(-50)).toBe(1);
  });

  it("returns the correct level at each threshold boundary", () => {
    expect(getLevelFromBalance(199)).toBe(1);
    expect(getLevelFromBalance(200)).toBe(2);
    expect(getLevelFromBalance(499)).toBe(2);
    expect(getLevelFromBalance(500)).toBe(3);
    expect(getLevelFromBalance(999)).toBe(3);
    expect(getLevelFromBalance(1000)).toBe(4);
    expect(getLevelFromBalance(1749)).toBe(4);
    expect(getLevelFromBalance(1750)).toBe(5);
  });

  it("keeps advancing one level per LEVEL_6_STEP past level 5", () => {
    expect(getLevelFromBalance(2749)).toBe(5);
    expect(getLevelFromBalance(2750)).toBe(6);
    expect(getLevelFromBalance(3750)).toBe(7);
    expect(getLevelFromBalance(4750)).toBe(8);
  });
});

describe("getLevelProgress", () => {
  it("computes points into the level and points needed within the fixed-threshold range", () => {
    // Level 2 spans 200-499
    const progress = getLevelProgress(350);
    expect(progress.pointsIntoLevel).toBe(150);
    expect(progress.pointsNeededForLevel).toBe(300);
  });

  it("computes progress correctly at the start of a level", () => {
    const progress = getLevelProgress(200);
    expect(progress.pointsIntoLevel).toBe(0);
  });

  it("computes progress correctly past level 5 (the extrapolated step range)", () => {
    // Level 6 spans 2750-3749
    const progress = getLevelProgress(3000);
    expect(progress.pointsIntoLevel).toBe(250);
    expect(progress.pointsNeededForLevel).toBe(1000);
  });
});
