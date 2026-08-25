import { describe, expect, it } from "vitest";
import { parseGameSettings } from "./gameSettings";

describe("parseGameSettings", () => {
  it("accepts 5-minute chess", () => {
    expect(
      parseGameSettings("CHESS", { timeControlMinutes: 5 }),
    ).toEqual({ timeControlMinutes: 5 });
  });

  it("accepts 10-minute chess", () => {
    expect(
      parseGameSettings("CHESS", { timeControlMinutes: 10 }),
    ).toEqual({ timeControlMinutes: 10 });
  });

  it("accepts no-limit chess", () => {
    expect(
      parseGameSettings("CHESS", { timeControlMinutes: 0 }),
    ).toEqual({ timeControlMinutes: 0 });
  });

  it("rejects arbitrary chess time controls", () => {
    expect(() =>
      parseGameSettings("CHESS", { timeControlMinutes: 30 }),
    ).toThrow();
  });

  it("normalizes settings to empty object for an existing game", () => {
    expect(parseGameSettings("RPS", undefined)).toEqual({});
  });

  it("does not persist arbitrary non-chess settings", () => {
    expect(parseGameSettings("MEMORY", { admin: true })).toEqual({});
  });
});
