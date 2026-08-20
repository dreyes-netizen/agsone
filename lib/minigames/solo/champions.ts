import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma/client";
import { SOLO_GAME_REGISTRY } from "./registry";
import { getManilaRankKeys } from "./time";
import type { SoloGameType } from "./types";

type ChampionWinnerRow = {
  id: string;
  userId: string;
  departmentId: string | null;
  departmentNameSnapshot: string | null;
  primaryScore: number;
  secondaryScore: number | null;
};

type ChampionWrite = {
  userId: string;
  gameType: string;
  scope: "COMPANY" | "DEPARTMENT";
  scopeKey: string;
  departmentId: string | null;
  departmentNameSnapshot: string | null;
  weekStart: Date;
  winningAttemptId: string;
  primaryScore: number;
  secondaryScore: number | null;
};

type ChampionTransaction = {
  query<T>(query: Prisma.Sql): Promise<T[]>;
  createMany(data: ChampionWrite[]): Promise<number>;
};

export interface SoloChampionRepository {
  transaction<T>(callback: (transaction: ChampionTransaction) => Promise<T>): Promise<T>;
  findUserChampionships(userId: string): Promise<unknown[]>;
  findRecentCompanyChampions(limit: number): Promise<unknown[]>;
}

const GAME_TYPES = Object.keys(SOLO_GAME_REGISTRY) as SoloGameType[];
const MANILA_UTC_OFFSET_MS = 8 * 60 * 60 * 1000;
const WEEK_CLOSE_GRACE_MS = 15 * 60 * 1000;

export function createSoloChampionService(repository: SoloChampionRepository) {
  async function finalizePreviousWeekIfNeeded(now: Date) {
    const closedWeekStart = previousWeekStart(now);
    if (!closedWeekStart) return 0;

    return repository.transaction(async (transaction) => {
      const writes: ChampionWrite[] = [];

      for (const gameType of GAME_TYPES) {
        const [companyWinner, departmentWinners] = await Promise.all([
          transaction.query<ChampionWinnerRow>(companyWinnerQuery(gameType, closedWeekStart)),
          transaction.query<ChampionWinnerRow>(departmentWinnerQuery(gameType, closedWeekStart)),
        ]);

        for (const winner of companyWinner) {
          writes.push(toCompanyWrite(winner, gameType, closedWeekStart));
        }
        for (const winner of departmentWinners) {
          writes.push(toDepartmentWrite(winner, gameType, closedWeekStart));
        }
      }

      return writes.length === 0 ? 0 : transaction.createMany(writes);
    });
  }

  return {
    finalizePreviousWeekIfNeeded,
    getUserChampionships: repository.findUserChampionships,
    getRecentCompanyChampions: repository.findRecentCompanyChampions,
  };
}

function previousWeekStart(now: Date) {
  const currentWeekStart = getManilaRankKeys(now).weekStart;
  const currentWeek = new Date(`${currentWeekStart}T00:00:00.000Z`);
  const manilaWeekBoundary = currentWeek.getTime() - MANILA_UTC_OFFSET_MS;
  if (now.getTime() < manilaWeekBoundary + WEEK_CLOSE_GRACE_MS) return null;
  return new Date(currentWeek.getTime() - 7 * 24 * 60 * 60 * 1000);
}

function toCompanyWrite(winner: ChampionWinnerRow, gameType: SoloGameType, weekStart: Date): ChampionWrite {
  return {
    userId: winner.userId,
    gameType,
    scope: "COMPANY",
    scopeKey: "company",
    departmentId: null,
    departmentNameSnapshot: null,
    weekStart,
    winningAttemptId: winner.id,
    primaryScore: winner.primaryScore,
    secondaryScore: winner.secondaryScore,
  };
}

function toDepartmentWrite(winner: ChampionWinnerRow, gameType: SoloGameType, weekStart: Date): ChampionWrite {
  if (!winner.departmentId) throw new Error("Department champion is missing its department snapshot");

  return {
    userId: winner.userId,
    gameType,
    scope: "DEPARTMENT",
    scopeKey: `department:${winner.departmentId}`,
    departmentId: winner.departmentId,
    departmentNameSnapshot: winner.departmentNameSnapshot,
    weekStart,
    winningAttemptId: winner.id,
    primaryScore: winner.primaryScore,
    secondaryScore: winner.secondaryScore,
  };
}

function companyWinnerQuery(gameType: SoloGameType, weekStart: Date) {
  const attemptOrder = trustedOrder(gameType, "a");
  return Prisma.sql`
    WITH ranked_attempts AS (
      SELECT a.*, ROW_NUMBER() OVER (
        PARTITION BY a."userId"
        ORDER BY ${attemptOrder}
      ) AS "bestRow"
      FROM "SoloGameAttempt" AS a
      WHERE a."gameType" = ${gameType}
        AND a.status = 'COMPLETED'
        AND a."isValid" = true
        AND a."weekStart" = ${weekStart}::date
        AND a."primaryScore" IS NOT NULL
        AND a."completedAt" IS NOT NULL
    )
    SELECT a."id", a."userId", a."departmentId", NULL::text AS "departmentNameSnapshot",
      a."primaryScore", a."secondaryScore"
    FROM ranked_attempts AS a
    WHERE a."bestRow" = 1
    ORDER BY ${attemptOrder}
    LIMIT 1
  `;
}

function departmentWinnerQuery(gameType: SoloGameType, weekStart: Date) {
  const attemptOrder = trustedOrder(gameType, "a");
  const winnerOrder = trustedOrder(gameType, "b");
  return Prisma.sql`
    WITH ranked_attempts AS (
      SELECT a.*, ROW_NUMBER() OVER (
        PARTITION BY a."departmentId", a."userId"
        ORDER BY ${attemptOrder}
      ) AS "bestRow"
      FROM "SoloGameAttempt" AS a
      WHERE a."gameType" = ${gameType}
        AND a.status = 'COMPLETED'
        AND a."isValid" = true
        AND a."weekStart" = ${weekStart}::date
        AND a."departmentId" IS NOT NULL
        AND a."primaryScore" IS NOT NULL
        AND a."completedAt" IS NOT NULL
    ),
    best_attempts AS (
      SELECT * FROM ranked_attempts WHERE "bestRow" = 1
    ),
    ranked_departments AS (
      SELECT b.*, ROW_NUMBER() OVER (
        PARTITION BY b."departmentId"
        ORDER BY ${winnerOrder}
      ) AS "departmentRank"
      FROM best_attempts AS b
    )
    SELECT r."id", r."userId", r."departmentId", d."name" AS "departmentNameSnapshot",
      r."primaryScore", r."secondaryScore"
    FROM ranked_departments AS r
    INNER JOIN "Department" AS d ON d."id" = r."departmentId"
    WHERE r."departmentRank" = 1
  `;
}

function trustedOrder(gameType: SoloGameType, alias: "a" | "b") {
  const definition = SOLO_GAME_REGISTRY[gameType];
  const primary = definition.primaryDirection === "higher" ? "DESC" : "ASC";
  const secondary = definition.secondaryDirection === "higher" ? "DESC" : "ASC";
  return Prisma.raw(`${alias}."primaryScore" ${primary}, ${alias}."secondaryScore" ${secondary} NULLS LAST, ${alias}."completedAt" ASC, ${alias}."userId" ASC`);
}

const prismaRepository: SoloChampionRepository = {
  async transaction(callback) {
    return prisma.$transaction(async (transaction) => callback({
      query: async <T>(query: Prisma.Sql) => transaction.$queryRaw<T[]>(query),
      createMany: async (data) => (await transaction.arcadeWeeklyChampion.createMany({ data, skipDuplicates: true })).count,
    }));
  },
  async findUserChampionships(userId) {
    return prisma.arcadeWeeklyChampion.findMany({
      where: { userId },
      orderBy: [{ weekStart: "desc" }, { awardedAt: "desc" }],
      select: championSelection,
    });
  },
  async findRecentCompanyChampions(limit) {
    return prisma.arcadeWeeklyChampion.findMany({
      where: { scope: "COMPANY" },
      orderBy: [{ weekStart: "desc" }, { gameType: "asc" }],
      take: limit,
      select: championSelection,
    });
  },
};

const championSelection = {
  id: true,
  userId: true,
  gameType: true,
  scope: true,
  scopeKey: true,
  departmentId: true,
  departmentNameSnapshot: true,
  weekStart: true,
  winningAttemptId: true,
  primaryScore: true,
  secondaryScore: true,
  awardedAt: true,
  user: { select: { displayName: true, avatarUrl: true } },
} as const;

const defaultService = createSoloChampionService(prismaRepository);

export const finalizePreviousWeekIfNeeded = defaultService.finalizePreviousWeekIfNeeded;
export const getUserChampionships = defaultService.getUserChampionships;
export const getRecentCompanyChampions = defaultService.getRecentCompanyChampions;
