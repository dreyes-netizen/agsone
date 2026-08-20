import { describe, expect, it, vi } from "vitest";
import { scheduleSequencePlayback } from "./sequencePlayback";

describe("scheduleSequencePlayback", () => {
  it("keeps repeated values visibly separated and completes once without being reset by flash updates", () => {
    vi.useFakeTimers();
    const flashes: Array<number | null> = [];
    const complete = vi.fn();

    scheduleSequencePlayback([1, 1, 2], 3, (value) => flashes.push(value), complete);
    vi.runAllTimers();

    expect(flashes).toEqual([1, null, 1, null, 2, null]);
    expect(complete).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("cancels every scheduled flash and completion when its component unmounts", () => {
    vi.useFakeTimers();
    const flashes: Array<number | null> = [];
    const complete = vi.fn();

    const cleanup = scheduleSequencePlayback([1, 1, 2], 3, (value) => flashes.push(value), complete);
    cleanup();
    vi.runAllTimers();

    expect(flashes).toEqual([]);
    expect(complete).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});
