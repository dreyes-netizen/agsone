import { beforeEach, describe, expect, it, vi } from "vitest";

const routeDoubles = vi.hoisted(() => ({
  verifyAuth: vi.fn(),
  getSoloPersonalBests: vi.fn(),
}));

vi.mock("@/lib/auth/verifyAuth", () => ({ verifyAuth: routeDoubles.verifyAuth }));
vi.mock("@/lib/minigames/solo/personalBests", () => ({
  getSoloPersonalBests: routeDoubles.getSoloPersonalBests,
}));

import { GET } from "./route";

describe("solo personal-bests route", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("requires authentication before reading personal bests", async () => {
    routeDoubles.verifyAuth.mockResolvedValue(null);

    expect((await GET(new Request("http://localhost/api/minigames/solo/personal-bests") as never)).status).toBe(401);
    expect(routeDoubles.getSoloPersonalBests).not.toHaveBeenCalled();
  });

  it("returns every game PB from one batch read", async () => {
    routeDoubles.verifyAuth.mockResolvedValue({ id: "user-1" });
    routeDoubles.getSoloPersonalBests.mockResolvedValue({
      TYPING: 72,
      REACTION: null,
      VISUAL_MEMORY: 6,
      SEQUENCE_MEMORY: 9,
    });

    const response = await GET(new Request("http://localhost/api/minigames/solo/personal-bests") as never);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: {
        personalBests: {
          TYPING: 72,
          REACTION: null,
          VISUAL_MEMORY: 6,
          SEQUENCE_MEMORY: 9,
        },
      },
    });
    expect(routeDoubles.getSoloPersonalBests).toHaveBeenCalledTimes(1);
    expect(routeDoubles.getSoloPersonalBests).toHaveBeenCalledWith("user-1");
  });
});
