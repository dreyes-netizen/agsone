import { beforeEach, describe, expect, it, vi } from "vitest";

const routeDoubles = vi.hoisted(() => ({
  verifyAuth: vi.fn(),
  getSoloSummary: vi.fn(),
  getManilaRankKeys: vi.fn(),
  count: vi.fn(),
  finalizePreviousWeekIfNeeded: vi.fn(),
}));

vi.mock("@/lib/auth/verifyAuth", () => ({ verifyAuth: routeDoubles.verifyAuth }));
vi.mock("@/lib/minigames/solo/leaderboard", () => ({
  getSoloSummary: routeDoubles.getSoloSummary,
}));
vi.mock("@/lib/minigames/solo/time", () => ({ getManilaRankKeys: routeDoubles.getManilaRankKeys }));
vi.mock("@/lib/minigames/solo/champions", () => ({
  finalizePreviousWeekIfNeeded: routeDoubles.finalizePreviousWeekIfNeeded,
}));
vi.mock("@/lib/prisma/client", () => ({
  prisma: { soloGameAttempt: { count: routeDoubles.count } },
}));

import { GET } from "./route";

const user = { id: "user-1", departmentId: "department-authenticated" };

function request(query = "") {
  return new Request(`http://localhost/api/minigames/solo/summary${query}`);
}

describe("solo summary route", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    routeDoubles.getManilaRankKeys.mockReturnValue({ rankDate: "2026-08-21", weekStart: "2026-08-17" });
    routeDoubles.getSoloSummary.mockResolvedValue(null);
    routeDoubles.count.mockResolvedValue(0);
    routeDoubles.finalizePreviousWeekIfNeeded.mockResolvedValue(0);
  });

  it("rejects unauthenticated and malformed summary requests", async () => {
    routeDoubles.verifyAuth.mockResolvedValue(null);
    expect((await GET(request("?gameType=TYPING") as never)).status).toBe(401);

    routeDoubles.verifyAuth.mockResolvedValue(user);
    expect((await GET(request("?gameType=INVALID") as never)).status).toBe(400);
    expect((await GET(request("?gameType=TYPING&departmentId=other-department") as never)).status).toBe(400);
    expect(routeDoubles.getSoloSummary).not.toHaveBeenCalled();
    expect(routeDoubles.count).not.toHaveBeenCalled();
  });

  it("returns the authenticated user's PB and remaining starts from occupied Manila-date slots", async () => {
    const personalBest = {
      userId: "user-1",
      primaryScore: 61,
      secondaryScore: 98,
      completedAt: new Date("2026-08-20T04:00:00.000Z"),
      rank: 3,
    };
    routeDoubles.verifyAuth.mockResolvedValue(user);
    routeDoubles.getSoloSummary
      .mockResolvedValueOnce({ ...personalBest, rank: 1 })
      .mockResolvedValueOnce({ ...personalBest, rank: 2 })
      .mockResolvedValueOnce(personalBest)
      .mockResolvedValueOnce({ ...personalBest, rank: 4 });
    routeDoubles.count.mockResolvedValue(2);

    const response = await GET(request("?gameType=TYPING") as never);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      data: expect.objectContaining({
        attemptsRemaining: 1,
        personalBest: expect.objectContaining({ primaryScore: 61, rank: 3 }),
        ranks: {
          week: {
            company: expect.objectContaining({ rank: 1 }),
            department: expect.objectContaining({ rank: 2 }),
          },
          allTime: {
            company: expect.objectContaining({ rank: 3 }),
            department: expect.objectContaining({ rank: 4 }),
          },
        },
      }),
    });
    expect(routeDoubles.count).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        gameType: "TYPING",
        rankDate: new Date("2026-08-21T00:00:00.000Z"),
      },
    });
    expect(routeDoubles.getSoloSummary).toHaveBeenNthCalledWith(2, {
      userId: "user-1",
      gameType: "TYPING",
      period: "week",
      scope: "department",
      weekStart: new Date("2026-08-17T00:00:00.000Z"),
      departmentId: "department-authenticated",
    });
  });

  it("does not infer a department from request input when the employee has none", async () => {
    routeDoubles.verifyAuth.mockResolvedValue({ id: "user-1", departmentId: null });

    const response = await GET(request("?gameType=REACTION") as never);

    expect(response.status).toBe(200);
    expect(routeDoubles.getSoloSummary).toHaveBeenCalledTimes(2);
    expect(routeDoubles.getSoloSummary).toHaveBeenCalledWith(expect.objectContaining({ scope: "company", departmentId: null }));
    expect(await response.json()).toEqual({
      data: expect.objectContaining({
        ranks: {
          week: { company: null, department: null },
          allTime: { company: null, department: null },
        },
      }),
    });
  });

  it("starts idempotent previous-week finalization lazily after an authenticated valid read", async () => {
    routeDoubles.verifyAuth.mockResolvedValue(user);

    expect((await GET(request("?gameType=TYPING") as never)).status).toBe(200);
    expect(routeDoubles.finalizePreviousWeekIfNeeded).toHaveBeenCalledWith(expect.any(Date));
  });
});
