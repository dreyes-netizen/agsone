import { beforeEach, describe, expect, it, vi } from "vitest";

const routeDoubles = vi.hoisted(() => ({
  verifyAuth: vi.fn(),
  queryRaw: vi.fn(),
  findManySessions: vi.fn(),
  findManyUsers: vi.fn(),
}));

vi.mock("@/lib/auth/verifyAuth", () => ({ verifyAuth: routeDoubles.verifyAuth }));
vi.mock("@/lib/prisma/client", () => ({
  prisma: {
    $queryRaw: routeDoubles.queryRaw,
    gameSession: { findMany: routeDoubles.findManySessions },
    user: { findMany: routeDoubles.findManyUsers },
  },
}));

import { GET } from "./route";

const authUser = { id: "user-1" };

function request(query = "") {
  return new Request(`http://localhost/api/minigames/stats${query}`);
}

function session(overrides: Partial<{
  id: string;
  hostId: string;
  guestId: string | null;
  winnerId: string | null;
  updatedAt: Date;
}> = {}) {
  return {
    id: "session-1",
    gameType: "RPS",
    hostId: "user-1",
    guestId: "opponent-1",
    winnerId: "user-1",
    pointsWager: 0,
    updatedAt: new Date("2026-08-20T00:00:00.000Z"),
    ...overrides,
  };
}

describe("minigame stats route", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    routeDoubles.queryRaw.mockResolvedValue([]);
    routeDoubles.findManySessions.mockResolvedValue([]);
    routeDoubles.findManyUsers.mockResolvedValue([]);
  });

  it("rejects unauthenticated requests before querying", async () => {
    routeDoubles.verifyAuth.mockResolvedValue(null);

    const response = await GET(request() as never);

    expect(response.status).toBe(401);
    expect(routeDoubles.findManySessions).not.toHaveBeenCalled();
  });

  it("paginates recent games: a cursor request returns only the next page, skipping the full wins/losses/streak aggregation", async () => {
    routeDoubles.verifyAuth.mockResolvedValue(authUser);
    routeDoubles.findManySessions.mockResolvedValue([
      session({ id: "session-2", updatedAt: new Date("2026-08-19T00:00:00.000Z") }),
    ]);
    routeDoubles.findManyUsers.mockResolvedValue([
      { id: "opponent-1", displayName: "Rae", avatarUrl: null },
    ]);

    const response = await GET(
      request(`?cursor=${encodeURIComponent("1755648000000:session-1")}`) as never,
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.history).toHaveLength(1);
    expect(body.data.history[0]).toMatchObject({ id: "session-2", opponentName: "Rae" });
    expect(body.data.nextCursor).toBeNull();
    // Only the pagination-only branch's session query ran — no wins/losses/
    // per-game/streak aggregation was recomputed for a "Load more" request.
    expect(routeDoubles.queryRaw).not.toHaveBeenCalled();
    expect(routeDoubles.findManySessions).toHaveBeenCalledTimes(1);
    expect(routeDoubles.findManySessions).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: [
            { OR: [{ hostId: "user-1" }, { guestId: "user-1" }] },
            {
              OR: [
                { updatedAt: { lt: new Date(1755648000000) } },
                { updatedAt: new Date(1755648000000), id: { lt: "session-1" } },
              ],
            },
          ],
        }),
      }),
    );
  });

  it("returns a nextCursor encoding the last row's updatedAt+id when more history exists past the page size", async () => {
    routeDoubles.verifyAuth.mockResolvedValue(authUser);
    const rows = Array.from({ length: 21 }, (_, i) =>
      session({
        id: `session-${i}`,
        updatedAt: new Date(2026, 7, 20 - i),
      }),
    );
    routeDoubles.findManySessions.mockResolvedValue(rows);

    const response = await GET(request() as never);

    const body = await response.json();
    expect(body.data.history).toHaveLength(20);
    const last = rows[19]!;
    expect(body.data.historyCursor).toBe(`${last.updatedAt.getTime()}:${last.id}`);
  });

  it("returns a null historyCursor on the full stats response once history is exhausted", async () => {
    routeDoubles.verifyAuth.mockResolvedValue(authUser);
    routeDoubles.findManySessions.mockResolvedValue([session()]);

    const response = await GET(request() as never);

    const body = await response.json();
    expect(body.data.historyCursor).toBeNull();
  });

  it("ignores a malformed cursor and treats the request as page one instead of throwing", async () => {
    routeDoubles.verifyAuth.mockResolvedValue(authUser);
    routeDoubles.findManySessions.mockResolvedValue([session()]);

    const response = await GET(request("?cursor=not-a-real-cursor") as never);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.history).toHaveLength(1);
    expect(routeDoubles.findManySessions).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: "FINISHED", AND: [{ OR: [{ hostId: "user-1" }, { guestId: "user-1" }] }] },
      }),
    );
  });
});
