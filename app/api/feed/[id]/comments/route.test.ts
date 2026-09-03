import { beforeEach, describe, expect, it, vi } from "vitest";

const doubles = vi.hoisted(() => ({
  verifyAuth: vi.fn(),
  postFindFirst: vi.fn(),
  commentFindUnique: vi.fn(),
  commentCreate: vi.fn(),
  commentFindMany: vi.fn(),
  reactionGroupBy: vi.fn(),
  reactionFindMany: vi.fn(),
  moderateContent: vi.fn(),
  checkRateLimit: vi.fn(),
  writeAuditLog: vi.fn(),
  scheduleBroadcast: vi.fn(),
  resolveMentionRecipients: vi.fn(),
  createNotification: vi.fn(),
}));

vi.mock("@/lib/auth/verifyAuth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth/requireRole")>("@/lib/auth/requireRole");
  return { verifyAuth: doubles.verifyAuth, requireRole: actual.requireRole };
});

vi.mock("@/lib/prisma/client", () => ({
  prisma: {
    socialPost: { findFirst: doubles.postFindFirst },
    socialComment: { findUnique: doubles.commentFindUnique, create: doubles.commentCreate, findMany: doubles.commentFindMany },
    commentReaction: { groupBy: doubles.reactionGroupBy, findMany: doubles.reactionFindMany },
  },
}));

vi.mock("@/lib/guardrails/moderation", () => ({ moderateContent: doubles.moderateContent }));
vi.mock("@/lib/guardrails/rateLimiter", () => ({ checkRateLimit: doubles.checkRateLimit }));
vi.mock("@/lib/helpers/writeAuditLog", () => ({ writeAuditLog: doubles.writeAuditLog }));
vi.mock("@/lib/realtime/broadcast", () => ({ scheduleBroadcast: doubles.scheduleBroadcast }));
vi.mock("@/lib/helpers/parseMentions", () => ({
  resolveMentionRecipients: doubles.resolveMentionRecipients,
  stripMentionTokens: (s: string) => s,
}));
vi.mock("@/lib/helpers/createNotification", () => ({ createNotification: doubles.createNotification }));

import { POST } from "./route";

const EMPLOYEE = {
  id: "emp-1", firebaseUid: "fb-1", email: "emp@ags.test",
  displayName: "Employee One", role: "EMPLOYEE" as const, departmentId: null,
};

function req(body: unknown) {
  return new Request("http://test/api/feed/post-1/comments", { method: "POST", body: JSON.stringify(body) }) as unknown as Parameters<typeof POST>[0];
}
const params = { params: Promise.resolve({ id: "post-1" }) };

beforeEach(() => {
  vi.clearAllMocks();
  doubles.checkRateLimit.mockResolvedValue({ allowed: true, remaining: 59 });
  doubles.resolveMentionRecipients.mockResolvedValue([]);
  doubles.postFindFirst.mockResolvedValue({ id: "post-1", authorId: "other-1", departmentId: null });
  doubles.createNotification.mockResolvedValue(undefined);
});

describe("POST /api/feed/[id]/comments — Alexa moderation", () => {
  it("blocks a flagged text comment and never calls create", async () => {
    doubles.verifyAuth.mockResolvedValue(EMPLOYEE);
    doubles.moderateContent.mockResolvedValue({ blocked: true, reason: "Slur." });

    const res = await POST(req({ content: "some slur", commentType: "TEXT" }), params);

    expect(res.status).toBe(400);
    expect(doubles.commentCreate).not.toHaveBeenCalled();
    expect(doubles.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: "emp-1", action: "ALEXA_BLOCKED_COMMENT" })
    );
  });

  it("passes gifId through to moderateContent for a GIF comment", async () => {
    doubles.verifyAuth.mockResolvedValue(EMPLOYEE);
    doubles.moderateContent.mockResolvedValue({ blocked: false });
    doubles.commentCreate.mockResolvedValue({
      id: "c1", content: null, commentType: "GIF", gifProvider: "giphy", gifId: "xyz",
      createdAt: new Date(), authorId: "emp-1", parentId: null,
      author: { displayName: "Employee One", avatarUrl: null },
    });

    await POST(req({ commentType: "GIF", gifProvider: "giphy", gifId: "xyz" }), params);

    expect(doubles.moderateContent).toHaveBeenCalledWith(
      expect.objectContaining({ gifId: "xyz" })
    );
  });

  it("proceeds to create when moderation allows the comment", async () => {
    doubles.verifyAuth.mockResolvedValue(EMPLOYEE);
    doubles.moderateContent.mockResolvedValue({ blocked: false });
    doubles.commentCreate.mockResolvedValue({
      id: "c1", content: "nice one", commentType: "TEXT", gifProvider: null, gifId: null,
      createdAt: new Date(), authorId: "emp-1", parentId: null,
      author: { displayName: "Employee One", avatarUrl: null },
    });

    const res = await POST(req({ content: "nice one", commentType: "TEXT" }), params);

    expect(res.status).toBe(201);
    expect(doubles.commentCreate).toHaveBeenCalledTimes(1);
  });
});
