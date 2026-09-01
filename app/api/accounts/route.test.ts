import { beforeEach, describe, expect, it, vi } from "vitest";

const doubles = vi.hoisted(() => ({
  verifyAuth: vi.fn(),
  accountFindMany: vi.fn(),
}));

vi.mock("@/lib/auth/verifyAuth", () => ({
  verifyAuth: doubles.verifyAuth,
}));

vi.mock("@/lib/prisma/client", () => ({
  prisma: { account: { findMany: doubles.accountFindMany } },
}));

import { GET } from "./route";

function req(url: string) {
  return new Request(url) as unknown as Parameters<typeof GET>[0];
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/accounts", () => {
  it("returns 401 when unauthenticated", async () => {
    doubles.verifyAuth.mockResolvedValue(null);
    const res = await GET(req("http://test/api/accounts"));
    expect(res.status).toBe(401);
  });

  it("returns the account list for any authenticated user", async () => {
    doubles.verifyAuth.mockResolvedValue({ id: "u1", role: "EMPLOYEE" });
    doubles.accountFindMany.mockResolvedValue([
      { id: "a1", name: "EMB" },
      { id: "a2", name: "Flyland" },
    ]);
    const res = await GET(req("http://test/api/accounts"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual([
      { id: "a1", name: "EMB" },
      { id: "a2", name: "Flyland" },
    ]);
  });
});
