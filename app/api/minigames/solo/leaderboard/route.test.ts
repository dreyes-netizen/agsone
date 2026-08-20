import { beforeEach, describe, expect, it, vi } from "vitest";

const routeDoubles = vi.hoisted(() => ({
  verifyAuth: vi.fn(),
  getSoloLeaderboard: vi.fn(),
  getManilaRankKeys: vi.fn(),
}));

vi.mock("@/lib/auth/verifyAuth", () => ({ verifyAuth: routeDoubles.verifyAuth }));
vi.mock("@/lib/minigames/solo/leaderboard", () => ({
  getSoloLeaderboard: routeDoubles.getSoloLeaderboard,
}));
vi.mock("@/lib/minigames/solo/time", () => ({ getManilaRankKeys: routeDoubles.getManilaRankKeys }));

import { GET } from "./route";

const user = { id: "user-1", departmentId: "department-authenticated" };

function request(query = "") {
  return new Request(`http://localhost/api/minigames/solo/leaderboard${query}`);
}

describe("solo leaderboard route", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    routeDoubles.getManilaRankKeys.mockReturnValue({ rankDate: "2026-08-21", weekStart: "2026-08-17" });
  });

  it("rejects unauthenticated requests before parsing or querying", async () => {
    routeDoubles.verifyAuth.mockResolvedValue(null);

    const response = await GET(request("?gameType=INVALID") as never);

    expect(response.status).toBe(401);
    expect(routeDoubles.getSoloLeaderboard).not.toHaveBeenCalled();
  });

  it("rejects malformed queries and arbitrary department identifiers", async () => {
    routeDoubles.verifyAuth.mockResolvedValue(user);

    expect((await GET(request("?gameType=INVALID&period=week&scope=company") as never)).status).toBe(400);
    expect((await GET(request("?gameType=TYPING&period=week&scope=department&departmentId=other-department") as never)).status).toBe(400);
    expect(routeDoubles.getSoloLeaderboard).not.toHaveBeenCalled();
  });

  it("does not grant department leaderboard access to an employee without a department", async () => {
    routeDoubles.verifyAuth.mockResolvedValue({ id: "user-1", departmentId: null });

    const response = await GET(request("?gameType=TYPING&period=week&scope=department") as never);

    expect(response.status).toBe(403);
    expect(routeDoubles.getSoloLeaderboard).not.toHaveBeenCalled();
  });

  it("passes only the authenticated department and current user to the ranking service", async () => {
    const pinnedCurrentUser = {
      userId: "user-1",
      primaryScore: 20,
      secondaryScore: 97,
      completedAt: new Date("2026-08-20T04:00:00.000Z"),
      rank: 67,
    };
    routeDoubles.verifyAuth.mockResolvedValue(user);
    routeDoubles.getSoloLeaderboard.mockResolvedValue([pinnedCurrentUser]);

    const response = await GET(request("?gameType=TYPING&period=week&scope=department") as never);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: [expect.objectContaining({ userId: "user-1", rank: 67 })] });
    expect(routeDoubles.getSoloLeaderboard).toHaveBeenCalledWith({
      gameType: "TYPING",
      period: "week",
      scope: "department",
      weekStart: new Date("2026-08-17T00:00:00.000Z"),
      departmentId: "department-authenticated",
      currentUserId: "user-1",
    });
  });
});
