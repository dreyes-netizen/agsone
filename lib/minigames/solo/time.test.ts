import { describe, expect, it } from "vitest";
import { getManilaRankKeys } from "./time";

describe("getManilaRankKeys", () => {
  it("uses the previous Manila Monday for late Sunday timestamps", () => {
    expect(getManilaRankKeys(new Date("2026-08-23T15:59:59.000Z"))).toEqual({
      rankDate: "2026-08-23",
      weekStart: "2026-08-17",
    });
  });

  it("rolls over to a new Manila week at local midnight on Monday", () => {
    expect(getManilaRankKeys(new Date("2026-08-23T16:00:00.000Z"))).toEqual({
      rankDate: "2026-08-24",
      weekStart: "2026-08-24",
    });
  });

  it("interprets UTC timestamps in Asia/Manila instead of the machine timezone", () => {
    expect(getManilaRankKeys(new Date("2026-08-24T15:30:00.000Z"))).toEqual({
      rankDate: "2026-08-24",
      weekStart: "2026-08-24",
    });
  });
});
