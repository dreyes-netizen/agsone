import { describe, it, expect } from "vitest";
import { deriveOnlineCount } from "./deriveOnlineCount";

describe("deriveOnlineCount", () => {
  it("returns 0 for an empty map", () => {
    expect(deriveOnlineCount({}, 1_000_000, 90_000)).toBe(0);
  });

  it("counts a user seen within the staleness window", () => {
    const lastSeen = { "user-1": 999_000 };
    expect(deriveOnlineCount(lastSeen, 1_000_000, 90_000)).toBe(1);
  });

  it("excludes a user last seen beyond the staleness window", () => {
    const lastSeen = { "user-1": 900_000 };
    expect(deriveOnlineCount(lastSeen, 1_000_000, 90_000)).toBe(0);
  });

  it("counts each distinct user once", () => {
    const lastSeen = { "user-1": 999_000, "user-2": 995_000, "user-3": 999_500 };
    expect(deriveOnlineCount(lastSeen, 1_000_000, 90_000)).toBe(3);
  });
});
