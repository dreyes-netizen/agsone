import { describe, expect, it } from "vitest";
import type { Prisma } from "@/lib/generated/prisma/client";
import {
  createSoloLeaderboardService,
  type SoloLeaderboardQueryExecutor,
} from "./leaderboard";

type RawLeaderboardRow = {
  userId: string;
  primaryScore: number;
  secondaryScore: number | null;
  completedAt: Date;
  rank: bigint;
};

class CapturingQueryExecutor implements SoloLeaderboardQueryExecutor {
  readonly queries: Prisma.Sql[] = [];

  constructor(private readonly rows: RawLeaderboardRow[] = []) {}

  async query<T>(query: Prisma.Sql): Promise<T[]> {
    this.queries.push(query);
    return this.rows as T[];
  }
}

function sqlText(query: Prisma.Sql) {
  return query.strings.join("?").replace(/\s+/g, " ").trim();
}

describe("solo leaderboard query service", () => {
  it("asks Postgres for one best valid completed attempt per user and preserves a current user outside the top 50", async () => {
    const executor = new CapturingQueryExecutor([
      { userId: "first", primaryScore: 100, secondaryScore: 99, completedAt: new Date("2026-08-18T00:00:00.000Z"), rank: BigInt(1) },
      { userId: "current", primaryScore: 10, secondaryScore: 95, completedAt: new Date("2026-08-20T00:00:00.000Z"), rank: BigInt(51) },
    ]);
    const service = createSoloLeaderboardService({ executor });

    const leaderboard = await service.getSoloLeaderboard({
      gameType: "TYPING",
      period: "alltime",
      scope: "company",
      currentUserId: "current",
    });

    expect(leaderboard).toEqual([
      { userId: "first", primaryScore: 100, secondaryScore: 99, completedAt: new Date("2026-08-18T00:00:00.000Z"), rank: 1 },
      { userId: "current", primaryScore: 10, secondaryScore: 95, completedAt: new Date("2026-08-20T00:00:00.000Z"), rank: 51 },
    ]);

    const query = sqlText(executor.queries[0]!);
    expect(query).toContain('ROW_NUMBER() OVER ( PARTITION BY a."userId"');
    expect(query).toContain('WHERE "bestRow" = 1');
    expect(query).toContain('a.status = \'COMPLETED\'');
    expect(query).toContain('a."isValid" = true');
    expect(query).toContain('WHERE "rank" <= 50 OR "userId" = ?');
  });

  it("binds week and stored department snapshot filters while leaving request values out of SQL text", async () => {
    const executor = new CapturingQueryExecutor();
    const service = createSoloLeaderboardService({ executor });
    const departmentId = "dept-' OR 1=1 --";
    const weekStart = new Date("2026-08-17T00:00:00.000Z");

    await service.getSoloLeaderboard({
      gameType: "TYPING",
      period: "week",
      weekStart,
      scope: "department",
      departmentId,
      currentUserId: "user-' OR 1=1 --",
    });

    const query = executor.queries[0]!;
    expect(sqlText(query)).toContain('a."weekStart" = ?::date');
    expect(sqlText(query)).toContain('a."departmentId" = ?::text');
    expect(sqlText(query)).not.toContain(departmentId);
    expect(query.values).toContain(weekStart);
    expect(query.values).toContain(departmentId);
    expect(query.values).toContain("user-' OR 1=1 --");
  });

  it("uses typing's higher score and accuracy tie-break before earlier completion", async () => {
    const executor = new CapturingQueryExecutor();
    const service = createSoloLeaderboardService({ executor });

    await service.getSoloLeaderboard({ gameType: "TYPING", period: "alltime", scope: "company" });

    const query = sqlText(executor.queries[0]!);
    expect(query).toContain('a."primaryScore" DESC');
    expect(query).toContain('a."secondaryScore" DESC NULLS LAST');
    expect(query).toContain('a."completedAt" ASC');
  });

  it("uses reaction's lower-is-better primary and secondary ordering", async () => {
    const executor = new CapturingQueryExecutor();
    const service = createSoloLeaderboardService({ executor });

    await service.getSoloLeaderboard({ gameType: "REACTION", period: "alltime", scope: "company" });

    const query = sqlText(executor.queries[0]!);
    expect(query).toContain('a."primaryScore" ASC');
    expect(query).toContain('a."secondaryScore" ASC NULLS LAST');
    expect(query).toContain('a."completedAt" ASC');
  });

  it("preserves lower-is-better secondary tie-breaks for visual-memory games", async () => {
    const executor = new CapturingQueryExecutor();
    const service = createSoloLeaderboardService({ executor });

    await service.getSoloLeaderboard({ gameType: "VISUAL_MEMORY", period: "alltime", scope: "company" });

    const query = sqlText(executor.queries[0]!);
    expect(query).toContain('a."primaryScore" DESC');
    expect(query).toContain('a."secondaryScore" ASC NULLS LAST');
    expect(query).toContain('a."completedAt" ASC');
  });

  it("returns the current user's personal best and rank from the same bounded ranking query", async () => {
    const executor = new CapturingQueryExecutor([
      { userId: "current", primaryScore: 321, secondaryScore: null, completedAt: new Date("2026-08-20T00:00:00.000Z"), rank: BigInt(7) },
    ]);
    const service = createSoloLeaderboardService({ executor });

    await expect(service.getSoloSummary({
      userId: "current",
      gameType: "VISUAL_MEMORY",
      period: "week",
      weekStart: new Date("2026-08-17T00:00:00.000Z"),
      scope: "company",
    })).resolves.toEqual({
      userId: "current",
      primaryScore: 321,
      secondaryScore: null,
      completedAt: new Date("2026-08-20T00:00:00.000Z"),
      rank: 7,
    });

    expect(sqlText(executor.queries[0]!)).toContain('WHERE "userId" = ?');
  });
});
