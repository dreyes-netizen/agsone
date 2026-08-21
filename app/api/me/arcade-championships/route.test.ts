import { beforeEach, describe, expect, it, vi } from "vitest";

const routeDoubles = vi.hoisted(() => ({
  verifyAuth: vi.fn(),
  getUserChampionships: vi.fn(),
  finalizePreviousWeekIfNeeded: vi.fn(),
}));

vi.mock("@/lib/auth/verifyAuth", () => ({ verifyAuth: routeDoubles.verifyAuth }));
vi.mock("@/lib/minigames/solo/champions", () => ({
  getUserChampionships: routeDoubles.getUserChampionships,
  finalizePreviousWeekIfNeeded: routeDoubles.finalizePreviousWeekIfNeeded,
}));

import { GET } from "./route";

describe("my arcade championships route", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    routeDoubles.finalizePreviousWeekIfNeeded.mockResolvedValue(0);
  });

  it("requires authentication before reading championship history", async () => {
    routeDoubles.verifyAuth.mockResolvedValue(null);

    expect((await GET(new Request("http://localhost/api/me/arcade-championships") as never)).status).toBe(401);
    expect(routeDoubles.getUserChampionships).not.toHaveBeenCalled();
  });

  it("returns every championship belonging to the authenticated employee", async () => {
    routeDoubles.verifyAuth.mockResolvedValue({ id: "employee-42" });
    const championships = [
      { id: "company-win", scope: "COMPANY" },
      { id: "department-win", scope: "DEPARTMENT" },
    ];
    routeDoubles.getUserChampionships.mockResolvedValue(championships);

    const response = await GET(new Request("http://localhost/api/me/arcade-championships") as never);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: championships });
    expect(routeDoubles.getUserChampionships).toHaveBeenCalledWith("employee-42");
  });

  it("finalizes the prior week before reading championship history", async () => {
    const events: string[] = [];
    let resolveFinalization: (() => void) | undefined;
    routeDoubles.verifyAuth.mockResolvedValue({ id: "employee-42" });
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

    const response = GET(new Request("http://localhost/api/me/arcade-championships") as never);
    await Promise.resolve();
    expect(routeDoubles.getUserChampionships).not.toHaveBeenCalled();
    resolveFinalization?.();

    expect((await response).status).toBe(200);
    expect(events).toEqual(["finalize", "history"]);
  });
});
