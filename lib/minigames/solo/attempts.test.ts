import { describe, expect, it } from "vitest";
import {
  createRankedAttemptService,
  type RankedAttempt,
  type RankedAttemptRepository,
} from "./attempts";

const NOW = new Date("2026-08-21T04:00:00.000Z");
const TOMORROW = new Date("2026-08-22T04:00:00.000Z");

class InMemoryAttempts implements RankedAttemptRepository {
  readonly attempts: RankedAttempt[] = [];
  private nextId = 1;

  async findAttemptNumbers(userId: string, gameType: string, rankDate: Date) {
    return this.attempts
      .filter((attempt) => attempt.userId === userId && attempt.gameType === gameType && attempt.rankDate.getTime() === rankDate.getTime())
      .map((attempt) => attempt.attemptNumber);
  }

  async createAttempt(input: Omit<RankedAttempt, "id">) {
    if (this.attempts.some((attempt) =>
      attempt.userId === input.userId &&
      attempt.gameType === input.gameType &&
      attempt.rankDate.getTime() === input.rankDate.getTime() &&
      attempt.attemptNumber === input.attemptNumber,
    )) {
      throw { code: "P2002" };
    }

    const attempt = { ...input, id: `attempt-${this.nextId++}` };
    this.attempts.push(attempt);
    return attempt;
  }

  async findAttemptForUser(id: string, userId: string) {
    return this.attempts.find((attempt) => attempt.id === id && attempt.userId === userId) ?? null;
  }

  async completeStarted(id: string, result: NonNullable<RankedAttempt["result"]>, completedAt: Date) {
    const attempt = this.attempts.find((entry) => entry.id === id && entry.status === "STARTED");
    if (!attempt) return false;
    attempt.status = "COMPLETED";
    attempt.completedAt = completedAt;
    attempt.result = result;
    return true;
  }

  async expireStarted(id: string) {
    const attempt = this.attempts.find((entry) => entry.id === id && entry.status === "STARTED");
    if (!attempt) return false;
    attempt.status = "EXPIRED";
    return true;
  }

  async findBestCompleted(userId: string, gameType: string) {
    return this.attempts.filter((attempt) =>
      attempt.userId === userId && attempt.gameType === gameType && attempt.status === "COMPLETED" && attempt.result?.isValid,
    );
  }
}

function serviceFor(repository = new InMemoryAttempts()) {
  return {
    repository,
    service: createRankedAttemptService({ repository, randomInt: () => 123456 }),
  };
}

describe("ranked solo attempt service", () => {
  it("allocates three daily slots, including abandoned starts, then limits the fourth", async () => {
    const { repository, service } = serviceFor();

    const first = await service.startRankedAttempt("user-1", "TYPING", NOW, "dept-a");
    const second = await service.startRankedAttempt("user-1", "TYPING", NOW, "dept-a");
    repository.attempts[1]!.status = "EXPIRED";
    const third = await service.startRankedAttempt("user-1", "TYPING", NOW, "dept-a");
    const fourth = await service.startRankedAttempt("user-1", "TYPING", NOW, "dept-a");

    expect(first).toMatchObject({ kind: "started", attemptNumber: 1, attemptsRemaining: 2 });
    expect(second).toMatchObject({ kind: "started", attemptNumber: 2, attemptsRemaining: 1 });
    expect(third).toMatchObject({ kind: "started", attemptNumber: 3, attemptsRemaining: 0 });
    expect(fourth).toEqual({ kind: "limit" });
  });

  it("separates games and resets allocation at the next Manila date", async () => {
    const { service } = serviceFor();
    await service.startRankedAttempt("user-1", "REACTION", NOW, null);
    await service.startRankedAttempt("user-1", "REACTION", NOW, null);
    await service.startRankedAttempt("user-1", "REACTION", NOW, null);

    expect(await service.startRankedAttempt("user-1", "TYPING", NOW, null)).toMatchObject({ kind: "started", attemptNumber: 1 });
    expect(await service.startRankedAttempt("user-1", "REACTION", TOMORROW, null)).toMatchObject({ kind: "started", attemptNumber: 1 });
  });

  it("re-reads after a unique conflict so simultaneous third-slot starts never create attempt four", async () => {
    const { service } = serviceFor();
    await service.startRankedAttempt("user-1", "SEQUENCE_MEMORY", NOW, null);
    await service.startRankedAttempt("user-1", "SEQUENCE_MEMORY", NOW, null);

    const results = await Promise.all([
      service.startRankedAttempt("user-1", "SEQUENCE_MEMORY", NOW, null),
      service.startRankedAttempt("user-1", "SEQUENCE_MEMORY", NOW, null),
    ]);

    expect(results.filter((result) => result.kind === "started")).toHaveLength(1);
    expect(results).toContainEqual({ kind: "limit" });
    expect((results.find((result) => result.kind === "started") as { attemptNumber: number }).attemptNumber).toBe(3);
  });

  it("stores only minimal challenge descriptors and returns client-ready challenges", async () => {
    const { repository, service } = serviceFor();
    const typing = await service.startRankedAttempt("user-1", "TYPING", NOW, null);
    const reaction = await service.startRankedAttempt("user-1", "REACTION", NOW, null);

    expect(typing).toMatchObject({ kind: "started", challenge: { version: 1, passageId: expect.any(String), text: expect.any(String) } });
    expect(reaction).toMatchObject({ kind: "started", challenge: { version: 1, waitDurationsMs: expect.any(Array) } });
    expect(repository.attempts[0]!.challenge).toEqual({
      version: 1,
      seed: 123456,
      passageId: (typing as Extract<typeof typing, { kind: "started" }>).challenge.passageId,
    });
    expect(repository.attempts[1]!.challenge).toEqual({ version: 1, seed: 123456 });
  });

  it("scores the stored challenge once, then returns the stored completed result idempotently", async () => {
    const { service } = serviceFor();
    const started = await service.startRankedAttempt("user-1", "REACTION", NOW, null);
    if (started.kind !== "started") throw new Error("expected a started attempt");
    const evidence = { reactionMs: [220, 240, 260, 280, 300], falseStartTrials: [], clientElapsedMs: 5_000 };

    const first = await service.finishRankedAttempt("user-1", started.attemptId, evidence, NOW);
    const duplicate = await service.finishRankedAttempt("user-1", started.attemptId, { reactionMs: [1, 1, 1, 1, 1] }, NOW);

    expect(first).toMatchObject({ kind: "completed", result: { primaryScore: 260, isValid: true }, attemptsRemaining: 2 });
    expect(duplicate).toEqual(first);
  });

  it("does not leak another user's attempt and expires started attempts atomically", async () => {
    const { repository, service } = serviceFor();
    const started = await service.startRankedAttempt("user-1", "VISUAL_MEMORY", NOW, null);
    if (started.kind !== "started") throw new Error("expected a started attempt");

    expect(await service.finishRankedAttempt("user-2", started.attemptId, {}, NOW)).toEqual({ kind: "not_found" });
    expect(await service.finishRankedAttempt("user-1", started.attemptId, {}, new Date(started.expiresAt.getTime() + 1))).toEqual({ kind: "expired" });
    expect(repository.attempts[0]!.status).toBe("EXPIRED");
  });

  it("derives typing elapsed time from the server clock and dispatches the typing scorer", async () => {
    const { service } = serviceFor();
    const started = await service.startRankedAttempt("user-1", "TYPING", NOW, null);
    if (started.kind !== "started") throw new Error("expected a started attempt");

    const early = await service.finishRankedAttempt("user-1", started.attemptId, { typedText: "hello", clientElapsedMs: 1 }, new Date(NOW.getTime() + 30_000));
    expect(early).toMatchObject({ kind: "completed", result: { isValid: false, validationReason: "INVALID_ELAPSED_TIME" } });
  });
});
