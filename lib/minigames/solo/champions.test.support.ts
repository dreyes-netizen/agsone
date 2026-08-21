import type { Prisma } from "@/lib/generated/prisma/client";
import type { SoloChampionRepository } from "./champions";

type StatefulAttempt = {
  id: string;
  userId: string;
  gameType: string;
  status: "STARTED" | "COMPLETED" | "EXPIRED";
  weekStart: Date;
  expiresAt: Date;
  completedAt: Date | null;
  primaryScore: number;
  secondaryScore: number | null;
};

export function createStatefulChampionRepository(initialAttempts: StatefulAttempt[]) {
  const attempts = initialAttempts.map((attempt) => ({ ...attempt }));
  const champions: Array<Record<string, unknown>> = [];

  const repository: SoloChampionRepository & {
    champions: Array<Record<string, unknown>>;
    beginCompletion(id: string): () => Promise<boolean>;
    completeStarted(id: string): Promise<boolean>;
    statusOf(id: string): StatefulAttempt["status"] | undefined;
  } = {
    champions,
    async transaction(callback) {
      return callback({
        async terminalizeExpiredStarts(query) {
          const [weekStart, now] = query.values as [Date, Date];
          let terminalized = 0;
          for (const attempt of attempts) {
            if (
              attempt.status === "STARTED"
              && sameMoment(attempt.weekStart, weekStart)
              && attempt.expiresAt <= now
            ) {
              attempt.status = "EXPIRED";
              terminalized += 1;
            }
          }
          return terminalized;
        },
        async query<T>(query: Prisma.Sql) {
          if (sqlText(query).includes('INNER JOIN "Department"')) return [];
          const gameType = query.values.find((value): value is string => typeof value === "string");
          const winner = attempts
            .filter((attempt) => attempt.status === "COMPLETED" && attempt.gameType === gameType)
            .sort(compareTypingAttempts)[0];
          return winner ? [toWinnerRow(winner) as T] : [];
        },
        async createMany(data) {
          let count = 0;
          for (const champion of data) {
            const exists = champions.some((stored) => (
              stored.gameType === champion.gameType
              && stored.scopeKey === champion.scopeKey
              && sameMoment(stored.weekStart as Date, champion.weekStart)
            ));
            if (!exists) {
              champions.push({ ...champion });
              count += 1;
            }
          }
          return count;
        },
      });
    },
    async findUserChampionships() { return []; },
    async findRecentCompanyChampions() { return []; },
    async completeStarted(id) {
      const attempt = attempts.find((entry) => entry.id === id);
      if (!attempt || attempt.status !== "STARTED") return false;
      attempt.status = "COMPLETED";
      attempt.completedAt = new Date("2026-08-23T16:14:59.000Z");
      return true;
    },
    beginCompletion(id) {
      const attempt = attempts.find((entry) => entry.id === id);
      if (!attempt || attempt.status !== "STARTED") throw new Error("Completion must begin from STARTED");
      return () => repository.completeStarted(id);
    },
    statusOf(id) {
      return attempts.find((attempt) => attempt.id === id)?.status;
    },
  };

  return repository;
}

function compareTypingAttempts(left: StatefulAttempt, right: StatefulAttempt) {
  return right.primaryScore - left.primaryScore
    || (right.secondaryScore ?? Number.NEGATIVE_INFINITY) - (left.secondaryScore ?? Number.NEGATIVE_INFINITY)
    || (left.completedAt?.getTime() ?? 0) - (right.completedAt?.getTime() ?? 0)
    || left.userId.localeCompare(right.userId);
}

function toWinnerRow(attempt: StatefulAttempt) {
  return {
    id: attempt.id,
    userId: attempt.userId,
    departmentId: null,
    departmentNameSnapshot: null,
    primaryScore: attempt.primaryScore,
    secondaryScore: attempt.secondaryScore,
  };
}

function sameMoment(left: Date, right: Date) {
  return left.getTime() === right.getTime();
}

function sqlText(query: Prisma.Sql) {
  return query.strings.join("?").replace(/\s+/g, " ").trim();
}
