import { describe, expect, it } from "vitest";
import { formatChessClock } from "./ChessClock";

describe("formatChessClock", () => {
  it("renders mm:ss at and above the 10-second boundary", () => {
    expect(formatChessClock(5 * 60_000)).toBe("05:00");
    expect(formatChessClock(10_000)).toBe("00:10");
    expect(formatChessClock(61_000)).toBe("01:01");
    expect(formatChessClock(59_500)).toBe("01:00"); // rounds up to the next full second
  });

  it("renders mm:ss.t with tenths below the 10-second boundary", () => {
    expect(formatChessClock(9_800)).toBe("00:09.8");
    expect(formatChessClock(9_000)).toBe("00:09.0");
    expect(formatChessClock(100)).toBe("00:00.1");
  });

  it("clamps negative or zero remaining time to 00:00.0", () => {
    expect(formatChessClock(0)).toBe("00:00.0");
    expect(formatChessClock(-500)).toBe("00:00.0");
  });
});
