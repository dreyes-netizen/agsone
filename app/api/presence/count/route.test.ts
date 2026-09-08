import { beforeEach, describe, expect, it, vi } from "vitest";

const doubles = vi.hoisted(() => ({
  verifyAuth: vi.fn(),
  getOnlineCount: vi.fn(),
}));

vi.mock("@/lib/auth/verifyAuth", () => ({ verifyAuth: doubles.verifyAuth }));
vi.mock("@/lib/presence/onlinePresence", () => ({
  getOnlineCount: doubles.getOnlineCount,
}));

import { GET } from "./route";

const USER = {
  id: "u1",
  firebaseUid: "fb-1",
  email: "u1@ags.test",
  displayName: "U1",
  role: "EMPLOYEE" as const,
  departmentId: null,
};

function req() {
  return new Request("http://test/api/presence/count") as unknown as Parameters<typeof GET>[0];
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/presence/count", () => {
  it("returns 401 for an unauthenticated caller", async () => {
    doubles.verifyAuth.mockResolvedValue(null);
    const res = await GET(req());
    expect(res.status).toBe(401);
  });

  it("returns the current count for an authenticated caller", async () => {
    doubles.verifyAuth.mockResolvedValue(USER);
    doubles.getOnlineCount.mockResolvedValue(5);
    const res = await GET(req());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.count).toBe(5);
  });
});
