import { beforeEach, describe, expect, it, vi } from "vitest";

const doubles = vi.hoisted(() => ({
  verifyAuth: vi.fn(),
  postFindFirst: vi.fn(),
  postFindUnique: vi.fn(),
  postUpdate: vi.fn(),
  postDelete: vi.fn(),
  moderateContent: vi.fn(),
  checkRateLimit: vi.fn(),
  writeAuditLog: vi.fn(),
  scheduleBroadcast: vi.fn(),
  pollVoteFindFirst: vi.fn(),
  reactionGroupBy: vi.fn(),
  reactionFindMany: vi.fn(),
}));

vi.mock("@/lib/auth/verifyAuth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth/requireRole")>("@/lib/auth/requireRole");
  return { verifyAuth: doubles.verifyAuth, requireRole: actual.requireRole };
});

vi.mock("@/lib/prisma/client", () => ({
  prisma: {
    socialPost: {
      findFirst: doubles.postFindFirst,
      findUnique: doubles.postFindUnique,
      update: doubles.postUpdate,
      delete: doubles.postDelete,
    },
    pollVote: { findFirst: doubles.pollVoteFindFirst },
    socialReaction: { groupBy: doubles.reactionGroupBy, findMany: doubles.reactionFindMany },
  },
}));

vi.mock("@/lib/guardrails/moderation", () => ({ moderateContent: doubles.moderateContent }));
vi.mock("@/lib/guardrails/rateLimiter", () => ({ checkRateLimit: doubles.checkRateLimit }));
vi.mock("@/lib/helpers/writeAuditLog", () => ({ writeAuditLog: doubles.writeAuditLog }));
vi.mock("@/lib/realtime/broadcast", () => ({ scheduleBroadcast: doubles.scheduleBroadcast }));

import { PATCH } from "./route";

const EMPLOYEE = {
  id: "emp-1", firebaseUid: "fb-1", email: "emp@ags.test",
  displayName: "Employee One", role: "EMPLOYEE" as const, departmentId: null,
};

function req(body: unknown) {
  return new Request("http://test/api/feed/post-1", { method: "PATCH", body: JSON.stringify(body) }) as unknown as Parameters<typeof PATCH>[0];
}
const params = { params: Promise.resolve({ id: "post-1" }) };

beforeEach(() => {
  vi.clearAllMocks();
  doubles.checkRateLimit.mockResolvedValue({ allowed: true, remaining: 59 });
});

describe("PATCH /api/feed/[id] — edit — Alexa moderation", () => {
  it("blocks a flagged edit, writes an audit log, and never calls update", async () => {
    doubles.verifyAuth.mockResolvedValue(EMPLOYEE);
    doubles.postFindUnique.mockResolvedValue({ authorId: "emp-1" });
    doubles.moderateContent.mockResolvedValue({ blocked: true, reason: "Harassment." });

    const res = await PATCH(req({ title: "Edited", content: "you are the worst" }), params);

    expect(res.status).toBe(400);
    expect(doubles.postUpdate).not.toHaveBeenCalled();
    expect(doubles.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: "emp-1", action: "ALEXA_BLOCKED_POST", entityId: "post-1" })
    );
  });

  it("proceeds to update when moderation allows the edit", async () => {
    doubles.verifyAuth.mockResolvedValue(EMPLOYEE);
    doubles.postFindUnique.mockResolvedValue({ authorId: "emp-1" });
    doubles.moderateContent.mockResolvedValue({ blocked: false });
    doubles.postUpdate.mockResolvedValue({ id: "post-1", title: "Edited", content: "all good", updatedAt: new Date() });

    const res = await PATCH(req({ title: "Edited", content: "all good" }), params);

    expect(res.status).toBe(200);
    expect(doubles.postUpdate).toHaveBeenCalledTimes(1);
  });
});
