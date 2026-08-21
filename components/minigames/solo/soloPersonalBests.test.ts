import { describe, expect, it, vi } from "vitest";
import { loadSoloPersonalBests } from "./soloPersonalBests";

describe("loadSoloPersonalBests", () => {
  it("loads every personal best through one batch request", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      data: {
        personalBests: {
          TYPING: 72,
          REACTION: null,
          VISUAL_MEMORY: 6,
          SEQUENCE_MEMORY: 9,
        },
      },
    });

    await expect(loadSoloPersonalBests(fetcher)).resolves.toEqual({
      TYPING: { status: "value", score: 72 },
      REACTION: { status: "absent" },
      VISUAL_MEMORY: { status: "value", score: 6 },
      SEQUENCE_MEMORY: { status: "value", score: 9 },
    });
    expect(fetcher).toHaveBeenCalledOnce();
    expect(fetcher).toHaveBeenCalledWith("/api/minigames/solo/personal-bests");
  });

  it("marks every PB unavailable when the batch request fails", async () => {
    await expect(loadSoloPersonalBests(vi.fn().mockRejectedValue(new Error("offline")))).resolves.toEqual({
      TYPING: { status: "unavailable" },
      REACTION: { status: "unavailable" },
      VISUAL_MEMORY: { status: "unavailable" },
      SEQUENCE_MEMORY: { status: "unavailable" },
    });
  });
});
