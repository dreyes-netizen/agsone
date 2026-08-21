import { describe, expect, it } from "vitest";
import { createSeededRandom } from "./random";

describe("createSeededRandom", () => {
  it("returns the same sequence for the same seed", () => {
    const first = createSeededRandom(123456);
    const second = createSeededRandom(123456);

    expect([first(), first(), first()]).toEqual([second(), second(), second()]);
  });

  it("returns a different sequence for different seeds", () => {
    const first = createSeededRandom(123456);
    const second = createSeededRandom(654321);

    expect([first(), first(), first()]).not.toEqual([second(), second(), second()]);
  });

  it("keeps values in the unit interval", () => {
    const random = createSeededRandom(42);

    expect([random(), random(), random(), random(), random()].every((value) => value >= 0 && value < 1)).toBe(true);
  });
});
