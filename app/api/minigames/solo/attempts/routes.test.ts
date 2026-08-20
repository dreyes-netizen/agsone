import { describe, expect, it, vi } from "vitest";
import { createFinishHandler, createStartHandler } from "./handlers";

const routeDoubles = vi.hoisted(() => ({
  verifyAuth: vi.fn(),
  checkRateLimit: vi.fn(),
  startRankedAttempt: vi.fn(),
  finishRankedAttempt: vi.fn(),
  inspectRankedAttempt: vi.fn(),
}));

vi.mock("@/lib/auth/verifyAuth", () => ({ verifyAuth: routeDoubles.verifyAuth }));
vi.mock("@/lib/guardrails/rateLimiter", () => ({ checkRateLimit: routeDoubles.checkRateLimit }));
vi.mock("@/lib/minigames/solo/attempts", () => ({
  startRankedAttempt: routeDoubles.startRankedAttempt,
  finishRankedAttempt: routeDoubles.finishRankedAttempt,
  inspectRankedAttempt: routeDoubles.inspectRankedAttempt,
}));

import { POST as productionStart } from "./start/route";
import { POST as productionFinish } from "./[id]/finish/route";

const user = { id: "user-1", departmentId: "department-1" };
const attemptId = "00000000-0000-4000-8000-000000000001";
const started = {
  kind: "started" as const,
  attemptId: "attempt-1",
  gameType: "TYPING" as const,
  attemptNumber: 1,
  attemptsRemaining: 2,
  expiresAt: new Date("2026-08-21T04:15:00.000Z"),
  challenge: { version: 1, passageId: "solo-typing-001", text: "Canonical passage", durationMs: 60_000 },
};

function request(body: unknown) {
  return new Request("http://localhost/api/minigames/solo/attempts/start", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("ranked attempt routes", () => {
  it("maps unauthenticated, malformed game, rate-limited, and started states on start", async () => {
    const start = vi.fn().mockResolvedValue(started);
    const handler = createStartHandler({
      verifyAuth: async () => null,
      checkRateLimit: async () => ({ allowed: true, remaining: 29 }),
      startRankedAttempt: start,
      now: () => new Date("2026-08-21T04:00:00.000Z"),
    });
    expect((await handler(request({ gameType: "TYPING" }))).status).toBe(401);

    const invalid = createStartHandler({
      verifyAuth: async () => user,
      checkRateLimit: async () => ({ allowed: true, remaining: 29 }),
      startRankedAttempt: start,
      now: () => new Date(),
    });
    expect((await invalid(request({ gameType: "NOT_A_GAME", extra: true }))).status).toBe(400);

    const limited = createStartHandler({
      verifyAuth: async () => user,
      checkRateLimit: async () => ({ allowed: false, remaining: 0 }),
      startRankedAttempt: start,
      now: () => new Date(),
    });
    expect((await limited(request({ gameType: "TYPING" }))).status).toBe(429);

    const successful = createStartHandler({
      verifyAuth: async () => user,
      checkRateLimit: async () => ({ allowed: true, remaining: 29 }),
      startRankedAttempt: start,
      now: () => new Date(),
    });
    const response = await successful(request({ gameType: "TYPING" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: expect.objectContaining({ attemptId: "attempt-1", attemptsRemaining: 2 }) });
    expect(start).toHaveBeenLastCalledWith("user-1", "TYPING", expect.any(Date), "department-1");

    const dailyLimit = createStartHandler({
      verifyAuth: async () => user,
      checkRateLimit: async () => ({ allowed: true, remaining: 29 }),
      startRankedAttempt: async () => ({ kind: "limit" }),
      now: () => new Date(),
    });
    expect((await dailyLimit(request({ gameType: "TYPING" }))).status).toBe(429);
  });

  it("maps wrong-owner, expired, duplicate, malformed evidence, and valid completion on finish", async () => {
    const finish = vi.fn().mockResolvedValue({ kind: "completed", result: { primaryScore: 12, secondaryScore: 99, isValid: true, validationReason: null, metrics: {} }, attemptsRemaining: 2, isPersonalBest: true });
    const base = {
      verifyAuth: async () => user,
      checkRateLimit: async () => ({ allowed: true, remaining: 29 }),
      finishRankedAttempt: finish,
      now: () => new Date("2026-08-21T04:02:00.000Z"),
    };

    const missing = createFinishHandler({ ...base, inspectAttempt: async () => null });
    expect((await missing(request({ typedText: "hi", clientElapsedMs: 60_000 }), { params: Promise.resolve({ id: "00000000-0000-4000-8000-000000000002" }) })).status).toBe(404);

    const expired = createFinishHandler({ ...base, inspectAttempt: async () => ({ gameType: "TYPING" as const, status: "EXPIRED" as const, expiresAt: new Date("2026-08-21T04:15:00.000Z") }), finishRankedAttempt: async () => ({ kind: "expired" }) });
    expect((await expired(request({ typedText: "hi", clientElapsedMs: 60_000 }), { params: Promise.resolve({ id: attemptId }) })).status).toBe(410);

    const duplicate = createFinishHandler({ ...base, inspectAttempt: async () => ({ gameType: "TYPING" as const, status: "COMPLETED" as const, expiresAt: new Date("2026-08-21T04:15:00.000Z") }) });
    expect((await duplicate(request({ arbitrary: "ignored" }), { params: Promise.resolve({ id: attemptId }) })).status).toBe(200);

    const malformed = createFinishHandler({ ...base, inspectAttempt: async () => ({ gameType: "REACTION" as const, status: "STARTED" as const, expiresAt: new Date("2026-08-21T04:15:00.000Z") }) });
    expect((await malformed(request({ reactionMs: [100, 200], falseStartTrials: [], clientElapsedMs: 100, score: 999 }), { params: Promise.resolve({ id: attemptId }) })).status).toBe(400);

    const success = createFinishHandler({ ...base, inspectAttempt: async () => ({ gameType: "TYPING" as const, status: "STARTED" as const, expiresAt: new Date("2026-08-21T04:15:00.000Z") }) });
    const response = await success(request({ typedText: "hi", clientElapsedMs: 60_000 }), { params: Promise.resolve({ id: attemptId }) });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: expect.objectContaining({ result: expect.objectContaining({ primaryScore: 12 }), isPersonalBest: true }) });
  });

  it("returns 410 before parsing malformed evidence when an inspected STARTED attempt is past expiry", async () => {
    const finish = vi.fn().mockResolvedValue({ kind: "expired" });
    const handler = createFinishHandler({
      verifyAuth: async () => user,
      checkRateLimit: async () => ({ allowed: true, remaining: 29 }),
      inspectAttempt: async () => ({ gameType: "REACTION" as const, status: "STARTED" as const, expiresAt: new Date("2026-08-21T04:01:00.000Z") }),
      finishRankedAttempt: finish,
      now: () => new Date("2026-08-21T04:02:00.000Z"),
    });

    expect((await handler(request({ invalid: true }), { params: Promise.resolve({ id: "00000000-0000-4000-8000-000000000001" }) })).status).toBe(410);
    expect(finish).toHaveBeenCalledWith("user-1", expect.any(String), undefined, expect.any(Date));
  });

  it("rejects a non-UUID route parameter before inspecting persistence", async () => {
    const inspectAttempt = vi.fn();
    const handler = createFinishHandler({
      verifyAuth: async () => user,
      checkRateLimit: async () => ({ allowed: true, remaining: 29 }),
      inspectAttempt,
      finishRankedAttempt: async () => ({ kind: "expired" }),
      now: () => new Date(),
    });

    expect((await handler(request({}), { params: Promise.resolve({ id: "not-an-attempt-id" }) })).status).toBe(400);
    expect(inspectAttempt).not.toHaveBeenCalled();
  });

  it("authenticates and rate-limits finish before its attempt lookup", async () => {
    const inspectAttempt = vi.fn();
    const unauthenticated = createFinishHandler({
      verifyAuth: async () => null,
      checkRateLimit: async () => ({ allowed: true, remaining: 29 }),
      inspectAttempt,
      finishRankedAttempt: async () => ({ kind: "expired" }),
      now: () => new Date(),
    });
    expect((await unauthenticated(request({}), { params: Promise.resolve({ id: attemptId }) })).status).toBe(401);

    const rateLimited = createFinishHandler({
      verifyAuth: async () => user,
      checkRateLimit: async () => ({ allowed: false, remaining: 0 }),
      inspectAttempt,
      finishRankedAttempt: async () => ({ kind: "expired" }),
      now: () => new Date(),
    });
    expect((await rateLimited(request({}), { params: Promise.resolve({ id: attemptId }) })).status).toBe(429);
    expect(inspectAttempt).not.toHaveBeenCalled();
  });

  it("strictly bounds valid, malformed, extra, and oversized route evidence for all games", async () => {
    const finishRankedAttempt = vi.fn().mockResolvedValue({ kind: "completed", result: { primaryScore: 1, secondaryScore: null, isValid: true, validationReason: null, metrics: {} }, attemptsRemaining: 2, isPersonalBest: false });
    const cases = [
      ["TYPING", { typedText: "ok", clientElapsedMs: 60_000 }, { typedText: 7, clientElapsedMs: 0 }, { typedText: "ok", clientElapsedMs: 0, score: 9 }, { typedText: "x".repeat(513), clientElapsedMs: 0 }],
      ["REACTION", { reactionMs: [100, 100, 100, 100, 100], falseStartTrials: [], clientElapsedMs: 0 }, { reactionMs: [100], falseStartTrials: [], clientElapsedMs: 0 }, { reactionMs: [100, 100, 100, 100, 100], falseStartTrials: [], clientElapsedMs: 0, score: 9 }, { reactionMs: [60_001, 60_001, 60_001, 60_001, 60_001], falseStartTrials: [], clientElapsedMs: 0 }],
      ["VISUAL_MEMORY", { answers: [{ level: 1, selectedIndexes: [0] }], claimedCompletedLevel: 0, clientElapsedMs: 0 }, { answers: [], claimedCompletedLevel: 0, clientElapsedMs: 0 }, { answers: [{ level: 1, selectedIndexes: [0] }], claimedCompletedLevel: 0, clientElapsedMs: 0, score: 9 }, { answers: [{ level: 1, selectedIndexes: Array.from({ length: 37 }, () => 0) }], claimedCompletedLevel: 0, clientElapsedMs: 0 }],
      ["SEQUENCE_MEMORY", { responses: [{ level: 1, inputs: [0] }], claimedCompletedLevel: 0, clientElapsedMs: 0 }, { responses: [], claimedCompletedLevel: 0, clientElapsedMs: 0 }, { responses: [{ level: 1, inputs: [0] }], claimedCompletedLevel: 0, clientElapsedMs: 0, score: 9 }, { responses: [{ level: 1, inputs: Array.from({ length: 11 }, () => 0) }], claimedCompletedLevel: 0, clientElapsedMs: 0 }],
    ] as const;

    for (const [gameType, valid, malformed, extra, oversized] of cases) {
      const handler = createFinishHandler({
        verifyAuth: async () => user,
        checkRateLimit: async () => ({ allowed: true, remaining: 29 }),
        inspectAttempt: async () => ({ gameType, status: "STARTED", expiresAt: new Date("2026-08-21T04:15:00.000Z") }),
        finishRankedAttempt,
        now: () => new Date("2026-08-21T04:02:00.000Z"),
      });
      expect((await handler(request(valid), { params: Promise.resolve({ id: "00000000-0000-4000-8000-000000000001" }) })).status).toBe(200);
      expect((await handler(request(malformed), { params: Promise.resolve({ id: "00000000-0000-4000-8000-000000000001" }) })).status).toBe(400);
      expect((await handler(request(extra), { params: Promise.resolve({ id: "00000000-0000-4000-8000-000000000001" }) })).status).toBe(400);
      expect((await handler(request(oversized), { params: Promise.resolve({ id: "00000000-0000-4000-8000-000000000001" }) })).status).toBe(400);
    }
  });

  it("wires the production start and finish route modules through mocked dependencies", async () => {
    routeDoubles.verifyAuth.mockResolvedValue(user);
    routeDoubles.checkRateLimit.mockResolvedValue({ allowed: true, remaining: 29 });
    routeDoubles.startRankedAttempt.mockResolvedValue(started);
    routeDoubles.inspectRankedAttempt.mockResolvedValue({ gameType: "TYPING", status: "STARTED", expiresAt: new Date("2026-08-21T04:15:00.000Z") });
    routeDoubles.finishRankedAttempt.mockResolvedValue({ kind: "completed", result: { primaryScore: 12, secondaryScore: 99, isValid: true, validationReason: null, metrics: {} }, attemptsRemaining: 2, isPersonalBest: true });

    expect((await productionStart(request({ gameType: "TYPING" }) as never)).status).toBe(200);
    expect((await productionFinish(request({ typedText: "ok", clientElapsedMs: 60_000 }) as never, { params: Promise.resolve({ id: "00000000-0000-4000-8000-000000000001" }) })).status).toBe(200);
    expect(routeDoubles.startRankedAttempt).toHaveBeenCalledWith("user-1", "TYPING", expect.any(Date), "department-1");
    expect(routeDoubles.finishRankedAttempt).toHaveBeenCalledWith("user-1", "00000000-0000-4000-8000-000000000001", expect.any(Object), expect.any(Date));
  });
});
