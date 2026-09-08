import { describe, it, expect } from "vitest";
import { derivePresenceCount } from "./derivePresenceCount";

describe("derivePresenceCount", () => {
  it("returns 0 for an empty roster", () => {
    expect(derivePresenceCount({})).toBe(0);
  });

  it("counts one entry per distinct presence key", () => {
    expect(derivePresenceCount({ "user-1": [{}], "user-2": [{}] })).toBe(2);
  });

  it("counts a key with multiple tracked entries (e.g. two tabs from one person) once", () => {
    expect(derivePresenceCount({ "user-1": [{}, {}] })).toBe(1);
  });
});
