import { describe, expect, it } from "vitest";
import { shouldLoadArcadeChampionships } from "./utils";

describe("shouldLoadArcadeChampionships", () => {
  it("loads championship history only when the badges view is opened before it has been cached", () => {
    expect(shouldLoadArcadeChampionships("overview", null)).toBe(false);
    expect(shouldLoadArcadeChampionships("points", null)).toBe(false);
    expect(shouldLoadArcadeChampionships("notifications", null)).toBe(false);
    expect(shouldLoadArcadeChampionships("badges", null)).toBe(true);
    expect(shouldLoadArcadeChampionships("badges", [])).toBe(false);
  });
});
