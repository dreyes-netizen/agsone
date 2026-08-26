import { beforeEach, describe, expect, it, vi } from "vitest";

const routeDoubles = vi.hoisted(() => ({
  verifyAuth: vi.fn(),
  findUniqueUser: vi.fn(),
  getMultiplayerRecord: vi.fn(),
  getHeadToHead: vi.fn(),
  getSoloPersonalBests: vi.fn(),
  getSoloSummary: vi.fn(),
  getUserChampionships: vi.fn(),
  finalizePreviousWeekIfNeeded: vi.fn(),
  getManilaRankKeys: vi.fn(),
  after: vi.fn(),
}));

vi.mock("@/lib/auth/verifyAuth", () => ({ verifyAuth: routeDoubles.verifyAuth }));
vi.mock("@/lib/prisma/client", () => ({
  prisma: { user: { findUnique: routeDoubles.findUniqueUser } },
}));
vi.mock("@/lib/minigames/playerRecord", () => ({
  getMultiplayerRecord: routeDoubles.getMultiplayerRecord,
  getHeadToHead: routeDoubles.getHeadToHead,
}));
vi.mock("@/lib/minigames/solo/personalBests", () => ({
  getSoloPersonalBests: routeDoubles.getSoloPersonalBests,
}));
vi.mock("@/lib/minigames/solo/leaderboard", () => ({
  getSoloSummary: routeDoubles.getSoloSummary,
}));
vi.mock("@/lib/minigames/solo/champions", () => ({
  getUserChampionships: routeDoubles.getUserChampionships,
  finalizePreviousWeekIfNeeded: routeDoubles.finalizePreviousWeekIfNeeded,
}));
vi.mock("@/lib/minigames/solo/time", () => ({
  getManilaRankKeys: routeDoubles.getManilaRankKeys,
}));
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: routeDoubles.after,
}));

import { GET } from "./route";

const authUser = { id: "viewer-1" };

function request() {
  return new Request("http://localhost/api/minigames/players/player-1/record");
}

function params(userId = "player-1") {
  return { params: Promise.resolve({ userId }) };
}

const emptyRecord = {
  wins: 0,
  losses: 0,
  draws: 0,
  total: 0,
  winRate: 0,
  perGame: {},
};

describe("player record route", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    routeDoubles.verifyAuth.mockResolvedValue(authUser);
    routeDoubles.findUniqueUser.mockResolvedValue({
      id: "player-1",
      displayName: "Rae",
      avatarUrl: null,
      department: { name: "Engineering" },
    });
    routeDoubles.getMultiplayerRecord.mockResolvedValue(emptyRecord);
    routeDoubles.getHeadToHead.mockResolvedValue({
      wins: 2,
      losses: 1,
      draws: 0,
      total: 3,
    });
    routeDoubles.getSoloPersonalBests.mockResolvedValue({
      TYPING: null,
      REACTION: null,
      VISUAL_MEMORY: null,
      SEQUENCE_MEMORY: null,
    });
    routeDoubles.getSoloSummary.mockResolvedValue(null);
    routeDoubles.getUserChampionships.mockResolvedValue([]);
    routeDoubles.getManilaRankKeys.mockReturnValue({
      rankDate: "2026-08-21",
      weekStart: "2026-08-17",
    });
    routeDoubles.after.mockImplementation(() => undefined);
  });

  it("rejects unauthenticated requests before reading anything", async () => {
    routeDoubles.verifyAuth.mockResolvedValue(null);

    const response = await GET(request() as never, params());

    expect(response.status).toBe(401);
    expect(routeDoubles.findUniqueUser).not.toHaveBeenCalled();
  });

  it("404s an unknown player without running the aggregations", async () => {
    routeDoubles.findUniqueUser.mockResolvedValue(null);

    const response = await GET(request() as never, params("ghost"));

    expect(response.status).toBe(404);
    expect(routeDoubles.getMultiplayerRecord).not.toHaveBeenCalled();
    expect(routeDoubles.getSoloPersonalBests).not.toHaveBeenCalled();
  });

  it("omits head-to-head when a player opens their own record", async () => {
    routeDoubles.findUniqueUser.mockResolvedValue({
      id: "viewer-1",
      displayName: "Me",
      avatarUrl: null,
      department: null,
    });

    const response = await GET(request() as never, params("viewer-1"));
    const body = await response.json();

    expect(body.data.isSelf).toBe(true);
    expect(body.data.headToHead).toBeNull();
    expect(routeDoubles.getHeadToHead).not.toHaveBeenCalled();
  });

  it("computes head-to-head from the viewer's side against another player", async () => {
    const body = await (await GET(request() as never, params())).json();

    expect(routeDoubles.getHeadToHead).toHaveBeenCalledWith("viewer-1", "player-1");
    expect(body.data.isSelf).toBe(false);
    expect(body.data.headToHead).toEqual({ wins: 2, losses: 1, draws: 0, total: 3 });
  });

  it("only looks up weekly ranks for solo games the player has actually played", async () => {
    routeDoubles.getSoloPersonalBests.mockResolvedValue({
      TYPING: 92,
      REACTION: null,
      VISUAL_MEMORY: 11,
      SEQUENCE_MEMORY: null,
    });
    routeDoubles.getSoloSummary.mockResolvedValue({ rank: 4 });

    const body = await (await GET(request() as never, params())).json();

    expect(routeDoubles.getSoloSummary).toHaveBeenCalledTimes(2);
    expect(routeDoubles.getSoloSummary).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "player-1",
        gameType: "TYPING",
        period: "week",
        scope: "company",
      }),
    );
    expect(body.data.solo.weekRanks).toEqual({ TYPING: 4, VISUAL_MEMORY: 4 });
  });

  it("never exposes match history or point wagers", async () => {
    routeDoubles.getMultiplayerRecord.mockResolvedValue({
      ...emptyRecord,
      wins: 8,
      total: 8,
      winRate: 100,
      perGame: { CHESS: { w: 8, l: 0, d: 0 } },
    });

    const response = await GET(request() as never, params());
    const raw = await response.text();

    expect(response.status).toBe(200);
    expect(raw).not.toContain("history");
    expect(raw).not.toContain("Wager");
    expect(raw).not.toContain("wager");
  });
});
