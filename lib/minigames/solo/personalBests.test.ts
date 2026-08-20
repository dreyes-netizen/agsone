import { describe, expect, it, vi } from "vitest";
import { buildSoloPersonalBestQuery, createSoloPersonalBestService } from "./personalBests";

describe("createSoloPersonalBestService", () => {
  it("builds one grouped aggregate query over the canonical games", () => {
    expect(buildSoloPersonalBestQuery("user-1")).toEqual({
      by: ["gameType"],
      where: {
        userId: "user-1",
        gameType: { in: ["TYPING", "REACTION", "VISUAL_MEMORY", "SEQUENCE_MEMORY"] },
        status: "COMPLETED",
        isValid: true,
        primaryScore: { not: null },
      },
      _max: { primaryScore: true },
      _min: { primaryScore: true },
    });
  });

  it("uses one lightweight query to return each canonical game's best official score", async () => {
    const getAggregates = vi.fn().mockResolvedValue([
      { gameType: "TYPING", _max: { primaryScore: 72 }, _min: { primaryScore: 61 } },
      { gameType: "REACTION", _max: { primaryScore: 288 }, _min: { primaryScore: 241 } },
      { gameType: "VISUAL_MEMORY", _max: { primaryScore: 7 }, _min: { primaryScore: 5 } },
    ]);
    const service = createSoloPersonalBestService({ getAggregates });

    await expect(service.getSoloPersonalBests("user-1")).resolves.toEqual({
      TYPING: 72,
      REACTION: 241,
      VISUAL_MEMORY: 7,
      SEQUENCE_MEMORY: null,
    });
    expect(getAggregates).toHaveBeenCalledOnce();
    expect(getAggregates).toHaveBeenCalledWith("user-1");
  });
});
