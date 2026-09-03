import { beforeEach, describe, expect, it, vi } from "vitest";

const doubles = vi.hoisted(() => ({
  verifyAuth: vi.fn(),
  commentFindUnique: vi.fn(),
  commentUpdate: vi.fn(),
  commentDelete: vi.fn(),
  moderateContent: vi.fn(),
  checkRateLimit: vi.fn(),
  writeAuditLog: vi.fn(),
  scheduleBroadcast: vi.fn(),
}));

vi.mock("@/lib/auth/verifyAuth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth/requireRole")>("@/lib/auth/requireRole");
  return { verifyAuth: doubles.verifyAuth, requireRole: actual.requireRole };
});

vi.mock("@/lib/prisma/client", () => ({
  prisma: {
    socialComment: { findUnique: doubles.commentFindUnique, update: doubles.commentUpdate, delete: doubles.commentDelete },
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
  return new Request("http://test/api/feed/post-1/comments/c1", { method: "PATCH", body: JSON.stringify(body) }) as unknown as Parameters<typeof PATCH>[0];
}
const params = { params: Promise.resolve({ id: "post-1", commentId: "c1" }) };

beforeEach(() => {
  vi.clearAllMocks();
  doubles.checkRateLimit.mockResolvedValue({ allowed: true, remaining: 59 });
});

describe("PATCH /api/feed/[id]/comments/[commentId] — Alexa moderation", () => {
  it("blocks a flagged edit and never calls update", async () => {
    doubles.verifyAuth.mockResolvedValue(EMPLOYEE);
    doubles.commentFindUnique.mockResolvedValue({ authorId: "emp-1" });
    doubles.moderateContent.mockResolvedValue({ blocked: true, reason: "Threat." });

    const res = await PATCH(req({ content: "watch yourself" }), params);

    expect(res.status).toBe(400);
    expect(doubles.commentUpdate).not.toHaveBeenCalled();
    expect(doubles.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: "emp-1", action: "ALEXA_BLOCKED_COMMENT", entityId: "c1" })
    );
  });

  it("proceeds to update when moderation allows the edit", async () => {
    doubles.verifyAuth.mockResolvedValue(EMPLOYEE);
    doubles.commentFindUnique.mockResolvedValue({ authorId: "emp-1" });
    doubles.moderateContent.mockResolvedValue({ blocked: false });
    doubles.commentUpdate.mockResolvedValue({ id: "c1", content: "all good now" });

    const res = await PATCH(req({ content: "all good now" }), params);

    expect(res.status).toBe(200);
    expect(doubles.commentUpdate).toHaveBeenCalledTimes(1);
  });

  it("returns 429 when the moderation rate limit is exceeded", async () => {
    doubles.verifyAuth.mockResolvedValue(EMPLOYEE);
    doubles.commentFindUnique.mockResolvedValue({ authorId: "emp-1" });
    doubles.checkRateLimit.mockResolvedValue({ allowed: false, remaining: 0 });

    const res = await PATCH(req({ content: "all good now" }), params);

    expect(res.status).toBe(429);
    expect(doubles.moderateContent).not.toHaveBeenCalled();
  });
});
