import { beforeEach, describe, expect, it, vi } from "vitest";

const routeDoubles = vi.hoisted(() => ({
  verifyAuth: vi.fn(),
  getUserChampionships: vi.fn(),
  getRecentCompanyChampions: vi.fn(),
  finalizePreviousWeekIfNeeded: vi.fn(),
}));

vi.mock("@/lib/auth/verifyAuth", () => ({ verifyAuth: routeDoubles.verifyAuth }));
vi.mock("@/lib/minigames/solo/champions", () => ({
  getUserChampionships: routeDoubles.getUserChampionships,
  getRecentCompanyChampions: routeDoubles.getRecentCompanyChampions,
  finalizePreviousWeekIfNeeded: routeDoubles.finalizePreviousWeekIfNeeded,
}));

import { GET } from "./route";

function request(query = "") {
  return new Request(`http://localhost/api/minigames/solo/champions${query}`);
}

describe("solo champions route", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    routeDoubles.finalizePreviousWeekIfNeeded.mockResolvedValue(0);
  });

  it("requires authentication before querying championship history", async () => {
    routeDoubles.verifyAuth.mockResolvedValue(null);

    expect((await GET(request() as never)).status).toBe(401);
    expect(routeDoubles.getUserChampionships).not.toHaveBeenCalled();
  });

  it("returns only the authenticated employee's history and optional bounded company champions", async () => {
    routeDoubles.verifyAuth.mockResolvedValue({ id: "user-1" });
    routeDoubles.getUserChampionships.mockResolvedValue([{ id: "history-1" }]);
    routeDoubles.getRecentCompanyChampions.mockResolvedValue([{ id: "company-1" }]);

    const response = await GET(request("?includeRecentCompany=true") as never);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: { championships: [{ id: "history-1" }], recentCompanyChampions: [{ id: "company-1" }] } });
    expect(routeDoubles.getUserChampionships).toHaveBeenCalledWith("user-1");
    expect(routeDoubles.getRecentCompanyChampions).toHaveBeenCalledWith(12);
  });

  it("awaits finalization before reading history so a just-finalized championship is visible", async () => {
    const events: string[] = [];
    let resolveFinalization: (() => void) | undefined;
    routeDoubles.verifyAuth.mockResolvedValue({ id: "user-1" });
    routeDoubles.finalizePreviousWeekIfNeeded.mockImplementation(() => new Promise<void>((resolve) => {
      resolveFinalization = () => {
        events.push("finalize");
        resolve();
      };
    }));
    routeDoubles.getUserChampionships.mockImplementation(async () => {
      events.push("history");
      return [];
    });

    const response = GET(request() as never);
    await Promise.resolve();
    expect(routeDoubles.getUserChampionships).not.toHaveBeenCalled();
    resolveFinalization?.();
    expect((await response).status).toBe(200);
    expect(events).toEqual(["finalize", "history"]);
  });

  it("rejects malformed or duplicate query parameters", async () => {
    routeDoubles.verifyAuth.mockResolvedValue({ id: "user-1" });

    expect((await GET(request("?includeRecentCompany=yes") as never)).status).toBe(400);
    expect((await GET(request("?includeRecentCompany=true&includeRecentCompany=false") as never)).status).toBe(400);
    expect(routeDoubles.getUserChampionships).not.toHaveBeenCalled();
  });
});
