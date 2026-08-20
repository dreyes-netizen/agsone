import { randomInt as cryptoRandomInt } from "node:crypto";
import { prisma } from "@/lib/prisma/client";
import { createReactionChallenge, scoreReactionAttempt } from "./reaction";
import { SOLO_GAME_REGISTRY } from "./registry";
import { scoreSequenceMemoryAttempt } from "./sequenceMemory";
import { getManilaRankKeys } from "./time";
import { createTypingChallenge, scoreTypingAttempt } from "./typing";
import type { SoloGameResult, SoloGameType } from "./types";
import { scoreVisualMemoryAttempt } from "./visualMemory";

const MAX_DAILY_ATTEMPTS = 3;
const CHALLENGE_VERSION = 1;

export type StoredChallenge = {
  version: typeof CHALLENGE_VERSION;
  seed: number;
  passageId?: string;
};

export type RankedAttemptResult = SoloGameResult;

export type RankedAttempt = {
  id: string;
  userId: string;
  departmentId: string | null;
  gameType: SoloGameType;
  status: "STARTED" | "COMPLETED" | "EXPIRED";
  attemptNumber: number;
  rankDate: Date;
  weekStart: Date;
  challenge: StoredChallenge;
  startedAt: Date;
  expiresAt: Date;
  completedAt: Date | null;
  result: RankedAttemptResult | null;
};

export interface RankedAttemptRepository {
  findAttemptNumbers(userId: string, gameType: SoloGameType, rankDate: Date): Promise<number[]>;
  createAttempt(input: Omit<RankedAttempt, "id">): Promise<RankedAttempt>;
  findAttemptForUser(id: string, userId: string): Promise<RankedAttempt | null>;
  completeStarted(id: string, result: RankedAttemptResult, completedAt: Date): Promise<boolean>;
  expireStarted(id: string): Promise<boolean>;
  findBestCompleted(userId: string, gameType: SoloGameType): Promise<RankedAttempt[]>;
}

export type StartedRankedAttempt = {
  kind: "started";
  attemptId: string;
  gameType: SoloGameType;
  attemptNumber: number;
  attemptsRemaining: number;
  expiresAt: Date;
  challenge: Record<string, unknown>;
};

export type StartRankedAttemptResult = StartedRankedAttempt | { kind: "limit" };

export type FinishRankedAttemptResult =
  | { kind: "not_found" }
  | { kind: "expired" }
  | {
      kind: "completed";
      result: RankedAttemptResult;
      attemptsRemaining: number;
      isPersonalBest: boolean;
    };

type AttemptServiceDependencies = {
  repository: RankedAttemptRepository;
  randomInt?: (min: number, max: number) => number;
};

/**
 * The service is deliberately parameterized by its persistence boundary. The
 * default adapter is Prisma, while tests use a concurrency-capable in-memory
 * repository to exercise allocation and terminal-transition algorithms without
 * needing PostgreSQL or Firebase.
 */
export function createRankedAttemptService({ repository, randomInt = cryptoRandomInt }: AttemptServiceDependencies) {
  async function startRankedAttempt(
    userId: string,
    gameType: SoloGameType,
    now: Date,
    departmentId: string | null = null,
  ): Promise<StartRankedAttemptResult> {
    const rankKeys = getManilaRankKeys(now);
    const rankDate = dateOnly(rankKeys.rankDate);
    const weekStart = dateOnly(rankKeys.weekStart);
    const definition = SOLO_GAME_REGISTRY[gameType];

    // A unique index is the final arbiter. A competing create gets P2002, then
    // this loop re-reads the slots and either selects another free 1..3 slot or
    // reports the daily limit. It can therefore never manufacture attempt #4.
    for (let retry = 0; retry < MAX_DAILY_ATTEMPTS; retry += 1) {
      const occupied = await repository.findAttemptNumbers(userId, gameType, rankDate);
      const attemptNumber = nextFreeAttemptNumber(occupied);
      if (!attemptNumber) return { kind: "limit" };

      const seed = randomInt(0, 2 ** 32);
      const challenge = buildStoredChallenge(gameType, seed);
      const expiresAt = new Date(now.getTime() + definition.rankedTtlMs);

      try {
        const attempt = await repository.createAttempt({
          userId,
          departmentId,
          gameType,
          status: "STARTED",
          attemptNumber,
          rankDate,
          weekStart,
          challenge,
          startedAt: now,
          expiresAt,
          completedAt: null,
          result: null,
        });

        return {
          kind: "started",
          attemptId: attempt.id,
          gameType,
          attemptNumber,
          attemptsRemaining: MAX_DAILY_ATTEMPTS - attemptNumber,
          expiresAt,
          challenge: clientChallenge(gameType, challenge),
        };
      } catch (error) {
        if (!isUniqueConflict(error)) throw error;
      }
    }

    // Retrying three collisions is sufficient because the only legal slots are
    // 1..3; each collision occupied one of those finite slots.
    return { kind: "limit" };
  }

  async function finishRankedAttempt(
    userId: string,
    attemptId: string,
    evidence: unknown,
    now: Date,
  ): Promise<FinishRankedAttemptResult> {
    let attempt = await repository.findAttemptForUser(attemptId, userId);
    if (!attempt) return { kind: "not_found" };

    if (attempt.status === "COMPLETED") return completedResponse(attempt, repository);
    if (attempt.status === "EXPIRED") return { kind: "expired" };

    if (now > attempt.expiresAt) {
      await repository.expireStarted(attempt.id);
      attempt = await repository.findAttemptForUser(attemptId, userId);
      if (!attempt) return { kind: "not_found" };
      if (attempt.status === "COMPLETED") return completedResponse(attempt, repository);
      return { kind: "expired" };
    }

    const result = scoreStoredAttempt(attempt, evidence, now);
    const transitioned = await repository.completeStarted(attempt.id, result, now);
    if (!transitioned) {
      attempt = await repository.findAttemptForUser(attemptId, userId);
      if (!attempt) return { kind: "not_found" };
      if (attempt.status === "COMPLETED") return completedResponse(attempt, repository);
      return { kind: "expired" };
    }

    const completed = await repository.findAttemptForUser(attemptId, userId);
    if (!completed || completed.status !== "COMPLETED") return { kind: "not_found" };
    return completedResponse(completed, repository);
  }

  async function inspectRankedAttempt(userId: string, attemptId: string) {
    const attempt = await repository.findAttemptForUser(attemptId, userId);
    return attempt ? { gameType: attempt.gameType, status: attempt.status, expiresAt: attempt.expiresAt } : null;
  }

  return { startRankedAttempt, finishRankedAttempt, inspectRankedAttempt };
}

async function completedResponse(
  attempt: RankedAttempt,
  repository: RankedAttemptRepository,
): Promise<Extract<FinishRankedAttemptResult, { kind: "completed" }>> {
  if (!attempt.result) throw new Error("Completed solo attempt is missing an official result");
  const candidates = await repository.findBestCompleted(attempt.userId, attempt.gameType);
  const best = candidates.sort((left, right) => compareAttempts(left, right))[0];

  const occupiedAttempts = await repository.findAttemptNumbers(
    attempt.userId,
    attempt.gameType,
    attempt.rankDate,
  );

  return {
    kind: "completed",
    result: attempt.result,
    attemptsRemaining: Math.max(0, MAX_DAILY_ATTEMPTS - occupiedAttempts.length),
    isPersonalBest: attempt.result.isValid && best?.id === attempt.id,
  };
}

function compareAttempts(left: RankedAttempt, right: RankedAttempt) {
  const definition = SOLO_GAME_REGISTRY[left.gameType];
  const primaryDifference = left.result!.primaryScore - right.result!.primaryScore;
  if (primaryDifference) return definition.primaryDirection === "higher" ? -primaryDifference : primaryDifference;

  const leftSecondary = left.result!.secondaryScore;
  const rightSecondary = right.result!.secondaryScore;
  if (leftSecondary !== rightSecondary) {
    if (leftSecondary === null) return 1;
    if (rightSecondary === null) return -1;
    const difference = leftSecondary - rightSecondary;
    return definition.secondaryDirection === "higher" ? -difference : difference;
  }

  return (left.completedAt?.getTime() ?? 0) - (right.completedAt?.getTime() ?? 0);
}

function scoreStoredAttempt(attempt: RankedAttempt, evidence: unknown, now: Date): RankedAttemptResult {
  const { challenge } = attempt;
  if (!isStoredChallenge(challenge)) return invalidChallengeResult();

  switch (attempt.gameType) {
    case "TYPING": {
      const typingChallenge = createTypingChallenge(challenge.seed);
      if (typingChallenge.passageId !== challenge.passageId) return invalidChallengeResult();
      return scoreTypingAttempt(typingChallenge, evidence as never, now.getTime() - attempt.startedAt.getTime());
    }
    case "REACTION":
      return scoreReactionAttempt(createReactionChallenge(challenge.seed), evidence as never);
    case "VISUAL_MEMORY":
      return scoreVisualMemoryAttempt(challenge.seed, evidence as never);
    case "SEQUENCE_MEMORY":
      return scoreSequenceMemoryAttempt(challenge.seed, evidence as never);
  }
}

function invalidChallengeResult(): RankedAttemptResult {
  return {
    primaryScore: 0,
    secondaryScore: null,
    isValid: false,
    validationReason: "INVALID_CHALLENGE",
    metrics: {},
  };
}

function buildStoredChallenge(gameType: SoloGameType, seed: number): StoredChallenge {
  if (gameType !== "TYPING") return { version: CHALLENGE_VERSION, seed };
  return { version: CHALLENGE_VERSION, seed, passageId: createTypingChallenge(seed).passageId };
}

function clientChallenge(gameType: SoloGameType, challenge: StoredChallenge): Record<string, unknown> {
  switch (gameType) {
    case "TYPING": {
      const typing = createTypingChallenge(challenge.seed);
      return { version: CHALLENGE_VERSION, passageId: typing.passageId, text: typing.passageText, durationMs: typing.durationMs };
    }
    case "REACTION":
      return { version: CHALLENGE_VERSION, waitDurationsMs: createReactionChallenge(challenge.seed).waitDurationsMs };
    case "VISUAL_MEMORY":
    case "SEQUENCE_MEMORY":
      return { version: CHALLENGE_VERSION, seed: challenge.seed };
  }
}

function isStoredChallenge(challenge: StoredChallenge): boolean {
  return challenge.version === CHALLENGE_VERSION && Number.isInteger(challenge.seed) && challenge.seed >= 0 && challenge.seed < 2 ** 32;
}

function nextFreeAttemptNumber(occupied: number[]) {
  for (let attemptNumber = 1; attemptNumber <= MAX_DAILY_ATTEMPTS; attemptNumber += 1) {
    if (!occupied.includes(attemptNumber)) return attemptNumber;
  }
  return null;
}

function dateOnly(key: string) {
  return new Date(`${key}T00:00:00.000Z`);
}

function isUniqueConflict(error: unknown) {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "P2002");
}

function toRankedAttempt(record: {
  id: string;
  userId: string;
  departmentId: string | null;
  gameType: string;
  status: "STARTED" | "COMPLETED" | "EXPIRED";
  attemptNumber: number;
  rankDate: Date;
  weekStart: Date;
  challenge: unknown;
  startedAt: Date;
  expiresAt: Date;
  completedAt: Date | null;
  primaryScore: number | null;
  secondaryScore: number | null;
  metrics: unknown;
  isValid: boolean;
  validationReason: string | null;
}): RankedAttempt {
  return {
    id: record.id,
    userId: record.userId,
    departmentId: record.departmentId,
    gameType: record.gameType as SoloGameType,
    status: record.status,
    attemptNumber: record.attemptNumber,
    rankDate: record.rankDate,
    weekStart: record.weekStart,
    challenge: record.challenge as StoredChallenge,
    startedAt: record.startedAt,
    expiresAt: record.expiresAt,
    completedAt: record.completedAt,
    result: record.status === "COMPLETED" && record.primaryScore !== null
      ? {
          primaryScore: record.primaryScore,
          secondaryScore: record.secondaryScore,
          metrics: record.metrics as SoloGameResult["metrics"],
          isValid: record.isValid,
          validationReason: record.validationReason,
        }
      : null,
  };
}

const prismaRepository: RankedAttemptRepository = {
  async findAttemptNumbers(userId, gameType, rankDate) {
    const attempts = await prisma.soloGameAttempt.findMany({
      where: { userId, gameType, rankDate },
      select: { attemptNumber: true },
    });
    return attempts.map((attempt) => attempt.attemptNumber);
  },
  async createAttempt(input) {
    const attempt = await prisma.$transaction((tx) => tx.soloGameAttempt.create({
      data: {
        userId: input.userId,
        departmentId: input.departmentId,
        gameType: input.gameType,
        attemptNumber: input.attemptNumber,
        rankDate: input.rankDate,
        weekStart: input.weekStart,
        challenge: input.challenge,
        challengeVersion: CHALLENGE_VERSION,
        startedAt: input.startedAt,
        expiresAt: input.expiresAt,
      },
    }));
    return toRankedAttempt(attempt);
  },
  async findAttemptForUser(id, userId) {
    const attempt = await prisma.soloGameAttempt.findFirst({ where: { id, userId } });
    return attempt ? toRankedAttempt(attempt) : null;
  },
  async completeStarted(id, result, completedAt) {
    const update = await prisma.soloGameAttempt.updateMany({
      where: { id, status: "STARTED" },
      data: {
        status: "COMPLETED",
        completedAt,
        primaryScore: result.primaryScore,
        secondaryScore: result.secondaryScore,
        metrics: result.metrics,
        isValid: result.isValid,
        validationReason: result.validationReason,
      },
    });
    return update.count === 1;
  },
  async expireStarted(id) {
    const update = await prisma.soloGameAttempt.updateMany({
      where: { id, status: "STARTED" },
      data: { status: "EXPIRED" },
    });
    return update.count === 1;
  },
  async findBestCompleted(userId, gameType) {
    const attempts = await prisma.soloGameAttempt.findMany({
      where: { userId, gameType, status: "COMPLETED", isValid: true },
    });
    return attempts.map(toRankedAttempt);
  },
};

const defaultService = createRankedAttemptService({ repository: prismaRepository });

export const startRankedAttempt = defaultService.startRankedAttempt;
export const finishRankedAttempt = defaultService.finishRankedAttempt;
export const inspectRankedAttempt = defaultService.inspectRankedAttempt;
