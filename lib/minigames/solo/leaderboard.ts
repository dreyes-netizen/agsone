import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma/client";
import { SOLO_GAME_REGISTRY } from "./registry";
import type { SoloGameType, SoloRankPeriod, SoloRankScope } from "./types";

export type SoloLeaderboardRequest = {
  gameType: SoloGameType;
  period: SoloRankPeriod;
  scope: SoloRankScope;
  weekStart?: Date;
  departmentId?: string | null;
  currentUserId?: string | null;
};

export type SoloSummaryRequest = Omit<SoloLeaderboardRequest, "currentUserId"> & {
  userId: string;
};

export type SoloLeaderboardEntry = {
  userId: string;
  primaryScore: number;
  secondaryScore: number | null;
  completedAt: Date;
  rank: number;
};

type SoloLeaderboardRow = Omit<SoloLeaderboardEntry, "rank"> & { rank: bigint | number };

/** A deliberately narrow seam: production runs Prisma raw SQL; tests inspect the bound SQL object. */
export interface SoloLeaderboardQueryExecutor {
  query<T>(query: Prisma.Sql): Promise<T[]>;
}

type SoloLeaderboardDependencies = {
  executor: SoloLeaderboardQueryExecutor;
};

const HIGHER_HIGHER_ATTEMPT_ORDER = Prisma.raw(
  'a."primaryScore" DESC, a."secondaryScore" DESC NULLS LAST, a."completedAt" ASC, a."userId" ASC',
);
const HIGHER_LOWER_ATTEMPT_ORDER = Prisma.raw(
  'a."primaryScore" DESC, a."secondaryScore" ASC NULLS LAST, a."completedAt" ASC, a."userId" ASC',
);
const LOWER_LOWER_ATTEMPT_ORDER = Prisma.raw(
  'a."primaryScore" ASC, a."secondaryScore" ASC NULLS LAST, a."completedAt" ASC, a."userId" ASC',
);
const HIGHER_HIGHER_LEADERBOARD_ORDER = Prisma.raw(
  '"primaryScore" DESC, "secondaryScore" DESC NULLS LAST, "completedAt" ASC, "userId" ASC',
);
const HIGHER_LOWER_LEADERBOARD_ORDER = Prisma.raw(
  '"primaryScore" DESC, "secondaryScore" ASC NULLS LAST, "completedAt" ASC, "userId" ASC',
);
const LOWER_LOWER_LEADERBOARD_ORDER = Prisma.raw(
  '"primaryScore" ASC, "secondaryScore" ASC NULLS LAST, "completedAt" ASC, "userId" ASC',
);

/**
 * Builds rankings entirely in PostgreSQL. The four order fragments above are
 * server-owned constants; all caller-provided values remain bound parameters.
 */
export function createSoloLeaderboardService({ executor }: SoloLeaderboardDependencies) {
  async function getSoloLeaderboard(request: SoloLeaderboardRequest): Promise<SoloLeaderboardEntry[]> {
    const rows = await executor.query<SoloLeaderboardRow>(buildLeaderboardQuery(request));
    return rows.map(toLeaderboardEntry);
  }

  async function getSoloSummary(request: SoloSummaryRequest): Promise<SoloLeaderboardEntry | null> {
    const rows = await executor.query<SoloLeaderboardRow>(buildSummaryQuery(request));
    return rows[0] ? toLeaderboardEntry(rows[0]) : null;
  }

  return { getSoloLeaderboard, getSoloSummary };
}

function buildLeaderboardQuery(request: SoloLeaderboardRequest) {
  const { weekStart, departmentId, attemptOrder, leaderboardOrder } = rankingParts(request);
  const visibleRows = request.currentUserId
    ? Prisma.sql`WHERE "rank" <= 50 OR "userId" = ${request.currentUserId}`
    : Prisma.sql`WHERE "rank" <= 50`;

  return Prisma.sql`
    WITH ranked_attempts AS (
      SELECT
        a."userId",
        a."primaryScore",
        a."secondaryScore",
        a."completedAt",
        ROW_NUMBER() OVER (
          PARTITION BY a."userId"
          ORDER BY ${attemptOrder}
        ) AS "bestRow"
      FROM "SoloGameAttempt" AS a
      WHERE a."gameType" = ${request.gameType}
        AND a.status = 'COMPLETED'
        AND a."isValid" = true
        AND (${weekStart}::date IS NULL OR a."weekStart" = ${weekStart}::date)
        AND (${departmentId}::text IS NULL OR a."departmentId" = ${departmentId}::text)
    ),
    best_attempts AS (
      SELECT "userId", "primaryScore", "secondaryScore", "completedAt"
      FROM ranked_attempts
      WHERE "bestRow" = 1
    ),
    ranked_leaderboard AS (
      SELECT *, ROW_NUMBER() OVER (ORDER BY ${leaderboardOrder}) AS "rank"
      FROM best_attempts
    )
    SELECT "userId", "primaryScore", "secondaryScore", "completedAt", "rank"
    FROM ranked_leaderboard
    ${visibleRows}
    ORDER BY "rank" ASC
  `;
}

function buildSummaryQuery(request: SoloSummaryRequest) {
  const { weekStart, departmentId, attemptOrder, leaderboardOrder } = rankingParts(request);

  return Prisma.sql`
    WITH ranked_attempts AS (
      SELECT
        a."userId",
        a."primaryScore",
        a."secondaryScore",
        a."completedAt",
        ROW_NUMBER() OVER (
          PARTITION BY a."userId"
          ORDER BY ${attemptOrder}
        ) AS "bestRow"
      FROM "SoloGameAttempt" AS a
      WHERE a."gameType" = ${request.gameType}
        AND a.status = 'COMPLETED'
        AND a."isValid" = true
        AND (${weekStart}::date IS NULL OR a."weekStart" = ${weekStart}::date)
        AND (${departmentId}::text IS NULL OR a."departmentId" = ${departmentId}::text)
    ),
    best_attempts AS (
      SELECT "userId", "primaryScore", "secondaryScore", "completedAt"
      FROM ranked_attempts
      WHERE "bestRow" = 1
    ),
    ranked_leaderboard AS (
      SELECT *, ROW_NUMBER() OVER (ORDER BY ${leaderboardOrder}) AS "rank"
      FROM best_attempts
    )
    SELECT "userId", "primaryScore", "secondaryScore", "completedAt", "rank"
    FROM ranked_leaderboard
    WHERE "userId" = ${request.userId}
  `;
}

function rankingParts(request: Pick<SoloLeaderboardRequest, "gameType" | "period" | "scope" | "weekStart" | "departmentId">) {
  const definition = SOLO_GAME_REGISTRY[request.gameType];
  if (!definition) throw new Error("Unsupported solo game type");

  if (request.period === "week" && !request.weekStart) {
    throw new Error("weekStart is required for weekly solo rankings");
  }
  if (request.scope === "department" && !request.departmentId) {
    throw new Error("departmentId is required for department solo rankings");
  }

  const directionKey = `${definition.primaryDirection}:${definition.secondaryDirection}`;
  const order = {
    "higher:higher": {
      attemptOrder: HIGHER_HIGHER_ATTEMPT_ORDER,
      leaderboardOrder: HIGHER_HIGHER_LEADERBOARD_ORDER,
    },
    "higher:lower": {
      attemptOrder: HIGHER_LOWER_ATTEMPT_ORDER,
      leaderboardOrder: HIGHER_LOWER_LEADERBOARD_ORDER,
    },
    "lower:lower": {
      attemptOrder: LOWER_LOWER_ATTEMPT_ORDER,
      leaderboardOrder: LOWER_LOWER_LEADERBOARD_ORDER,
    },
  } as const;
  const rankingOrder = order[directionKey as keyof typeof order];
  if (!rankingOrder) throw new Error("Unsupported solo score direction");

  return {
    weekStart: request.period === "week" ? request.weekStart! : null,
    departmentId: request.scope === "department" ? request.departmentId! : null,
    ...rankingOrder,
  };
}

function toLeaderboardEntry(row: SoloLeaderboardRow): SoloLeaderboardEntry {
  return {
    userId: row.userId,
    primaryScore: row.primaryScore,
    secondaryScore: row.secondaryScore,
    completedAt: row.completedAt,
    rank: Number(row.rank),
  };
}

const prismaExecutor: SoloLeaderboardQueryExecutor = {
  async query<T>(query: Prisma.Sql) {
    return prisma.$queryRaw<T[]>(query);
  },
};

const defaultService = createSoloLeaderboardService({ executor: prismaExecutor });

export const getSoloLeaderboard = defaultService.getSoloLeaderboard;
export const getSoloSummary = defaultService.getSoloSummary;
