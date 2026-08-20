import { describe, expect, it, vi } from "vitest";
import { createFinishHandler, createStartHandler } from "./handlers";

const user = { id: "user-1", departmentId: "department-1" };
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
    expect((await missing(request({ typedText: "hi", clientElapsedMs: 60_000 }), { params: Promise.resolve({ id: "other-user" }) })).status).toBe(404);

    const expired = createFinishHandler({ ...base, inspectAttempt: async () => ({ gameType: "TYPING" as const, status: "EXPIRED" as const }), finishRankedAttempt: async () => ({ kind: "expired" }) });
    expect((await expired(request({ typedText: "hi", clientElapsedMs: 60_000 }), { params: Promise.resolve({ id: "attempt-1" }) })).status).toBe(410);

    const duplicate = createFinishHandler({ ...base, inspectAttempt: async () => ({ gameType: "TYPING" as const, status: "COMPLETED" as const }) });
    expect((await duplicate(request({ arbitrary: "ignored" }), { params: Promise.resolve({ id: "attempt-1" }) })).status).toBe(200);

    const malformed = createFinishHandler({ ...base, inspectAttempt: async () => ({ gameType: "REACTION" as const, status: "STARTED" as const }) });
    expect((await malformed(request({ reactionMs: [100, 200], falseStartTrials: [], clientElapsedMs: 100, score: 999 }), { params: Promise.resolve({ id: "attempt-1" }) })).status).toBe(400);

    const success = createFinishHandler({ ...base, inspectAttempt: async () => ({ gameType: "TYPING" as const, status: "STARTED" as const }) });
    const response = await success(request({ typedText: "hi", clientElapsedMs: 60_000 }), { params: Promise.resolve({ id: "attempt-1" }) });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: expect.objectContaining({ result: expect.objectContaining({ primaryScore: 12 }), isPersonalBest: true }) });
  });
});
