import { describe, expect, it } from "vitest";
import { getTypingLiveMetrics } from "./typingLive";

describe("getTypingLiveMetrics", () => {
  it("uses cyclic canonical characters for a perfect repeated 500-character run", () => {
    const passage = "abcde".repeat(25);
    expect(getTypingLiveMetrics(passage, passage.repeat(4), 60_000)).toEqual({
      correctChars: 500,
      accuracy: 100,
      wpm: 100,
    });
  });
});
