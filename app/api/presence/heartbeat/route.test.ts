import { beforeEach, describe, expect, it, vi } from "vitest";

const doubles = vi.hoisted(() => ({
  verifyAuth: vi.fn(),
  recordHeartbeat: vi.fn(),
  getOnlineCount: vi.fn(),
  scheduleBroadcast: vi.fn(),
}));

vi.mock("@/lib/auth/verifyAuth", () => ({ verifyAuth: doubles.verifyAuth }));
vi.mock("@/lib/presence/onlinePresence", () => ({
  recordHeartbeat: doubles.recordHeartbeat,
  getOnlineCount: doubles.getOnlineCount,
}));
vi.mock("@/lib/realtime/broadcast", () => ({ scheduleBroadcast: doubles.scheduleBroadcast }));

import { POST } from "./route";

const USER = {
  id: "u1",
  firebaseUid: "fb-1",
  email: "u1@ags.test",
  displayName: "U1",
  role: "EMPLOYEE" as const,
  departmentId: null,
};

function req() {
  return new Request("http://test/api/presence/heartbeat", { method: "POST" }) as unknown as Parameters<typeof POST>[0];
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/presence/heartbeat", () => {
  it("returns 401 for an unauthenticated caller", async () => {
    doubles.verifyAuth.mockResolvedValue(null);
    const res = await POST(req());
    expect(res.status).toBe(401);
    expect(doubles.recordHeartbeat).not.toHaveBeenCalled();
  });

  it("records a heartbeat, returns the fresh count, and broadcasts a ping", async () => {
    doubles.verifyAuth.mockResolvedValue(USER);
    doubles.getOnlineCount.mockResolvedValue(3);
    const res = await POST(req());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.count).toBe(3);
    expect(doubles.recordHeartbeat).toHaveBeenCalledWith("u1");
    expect(doubles.scheduleBroadcast).toHaveBeenCalledWith([{ topic: "presence:online-users" }]);
  });
});
