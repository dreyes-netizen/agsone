import { beforeEach, describe, expect, it, vi } from "vitest";

const doubles = vi.hoisted(() => ({
  verifyAuth: vi.fn(),
  postFindMany: vi.fn(),
  postCreate: vi.fn(),
  pollVoteFindMany: vi.fn(),
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
    socialPost: { findMany: doubles.postFindMany, create: doubles.postCreate },
    pollVote: { findMany: doubles.pollVoteFindMany },
    socialReaction: { groupBy: doubles.reactionGroupBy, findMany: doubles.reactionFindMany },
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
  id: "emp-1",
  firebaseUid: "fb-1",
  email: "emp@ags.test",
  displayName: "Employee One",
  role: "EMPLOYEE" as const,
  departmentId: null,
};

function req(body: unknown) {
  return new Request("http://test/api/feed", { method: "POST", body: JSON.stringify(body) }) as unknown as Parameters<typeof POST>[0];
}

const validBody = { title: "Hello", content: "Hello team", type: "UPDATE", flair: "CASUAL" };

beforeEach(() => {
  vi.clearAllMocks();
  doubles.checkRateLimit.mockResolvedValue({ allowed: true, remaining: 59 });
  doubles.resolveMentionRecipients.mockResolvedValue([]);
});

describe("POST /api/feed — Alexa moderation", () => {
  it("blocks a flagged post, writes an audit log, and never calls create", async () => {
    doubles.verifyAuth.mockResolvedValue(EMPLOYEE);
    doubles.moderateContent.mockResolvedValue({ blocked: true, reason: "Personal attack." });

    const res = await POST(req(validBody));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/Alexa/);
    expect(doubles.postCreate).not.toHaveBeenCalled();
    expect(doubles.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: "emp-1", action: "ALEXA_BLOCKED_POST" })
    );
  });

  it("proceeds to create when moderation allows the post", async () => {
    doubles.verifyAuth.mockResolvedValue(EMPLOYEE);
    doubles.moderateContent.mockResolvedValue({ blocked: false });
    doubles.postCreate.mockResolvedValue({
      id: "post-1", authorId: "emp-1", title: "Hello", content: "Hello team",
      departmentId: null, type: "UPDATE",
    });

    const res = await POST(req(validBody));

    expect(res.status).toBe(201);
    expect(doubles.postCreate).toHaveBeenCalledTimes(1);
    expect(doubles.writeAuditLog).not.toHaveBeenCalled();
  });
});
