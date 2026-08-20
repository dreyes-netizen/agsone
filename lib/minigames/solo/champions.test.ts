import { describe, expect, it } from "vitest";
import type { Prisma } from "@/lib/generated/prisma/client";
import {
  createSoloChampionService,
  type SoloChampionRepository,
} from "./champions";

type WinnerRow = {
  id: string;
  userId: string;
  departmentId: string | null;
  departmentNameSnapshot: string | null;
  primaryScore: number;
  secondaryScore: number | null;
};

class ChampionRepository implements SoloChampionRepository {
  readonly queries: Prisma.Sql[] = [];
  readonly creations: Array<Record<string, unknown>[]> = [];

  constructor(
    private readonly companyRows: WinnerRow[] = [],
    private readonly departmentRows: WinnerRow[] = [],
  ) {}

  async transaction<T>(callback: (transaction: { query<T>(query: Prisma.Sql): Promise<T[]>; createMany(data: Record<string, unknown>[]): Promise<number> }) => Promise<T>) {
    return callback({
      query: async <T>(query: Prisma.Sql) => {
        this.queries.push(query);
        return (this.queries.length % 2 === 1 ? this.companyRows : this.departmentRows) as T[];
      },
      createMany: async (data) => {
        this.creations.push(data);
        return data.length;
      },
    });
  }

  async findUserChampionships() { return []; }
  async findRecentCompanyChampions() { return []; }
}

function sqlText(query: Prisma.Sql) {
  return query.strings.join("?").replace(/\s+/g, " ").trim();
}

describe("weekly solo champion service", () => {
  it("records the trusted company and snapshotted-department winners for every game in one transaction", async () => {
    const repository = new ChampionRepository(
      [{ id: "company-attempt", userId: "winner", departmentId: "department-1", departmentNameSnapshot: null, primaryScore: 100, secondaryScore: 99 }],
      [{ id: "department-attempt", userId: "winner", departmentId: "department-1", departmentNameSnapshot: "Engineering", primaryScore: 100, secondaryScore: 99 }],
    );
    const service = createSoloChampionService(repository);

    await expect(service.finalizePreviousWeekIfNeeded(new Date("2026-08-24T00:00:00.000Z"))).resolves.toBe(8);

    expect(repository.creations).toHaveLength(1);
    expect(repository.creations[0]).toEqual(expect.arrayContaining([
      expect.objectContaining({ gameType: "TYPING", scope: "COMPANY", scopeKey: "company", userId: "winner", winningAttemptId: "company-attempt", weekStart: new Date("2026-08-17T00:00:00.000Z") }),
      expect.objectContaining({ gameType: "TYPING", scope: "DEPARTMENT", scopeKey: "department:department-1", departmentId: "department-1", departmentNameSnapshot: "Engineering", winningAttemptId: "department-attempt" }),
    ]));
    expect(repository.creations[0]).toHaveLength(8);
  });

  it("uses the Task 9 trusted ordering, excludes invalid/no-score attempts, and binds the closed week", async () => {
    const repository = new ChampionRepository();
    const service = createSoloChampionService(repository);

    await service.finalizePreviousWeekIfNeeded(new Date("2026-08-24T00:00:00.000Z"));

    const typingCompany = sqlText(repository.queries[0]!);
    const reactionCompany = sqlText(repository.queries[2]!);
    const department = sqlText(repository.queries[1]!);
    expect(typingCompany).toContain('a."primaryScore" DESC');
    expect(typingCompany).toContain('a."secondaryScore" DESC NULLS LAST');
    expect(reactionCompany).toContain('a."primaryScore" ASC');
    expect(reactionCompany).toContain('a."secondaryScore" ASC NULLS LAST');
    expect(department).toContain('PARTITION BY a."departmentId", a."userId"');
    expect(typingCompany).toContain('a.status = \'COMPLETED\'');
    expect(typingCompany).toContain('a."isValid" = true');
    expect(typingCompany).toContain('a."primaryScore" IS NOT NULL');
    expect(repository.queries[0]!.values).toContainEqual(new Date("2026-08-17T00:00:00.000Z"));
  });

  it("does not create rows for empty weeks and relies on one skip-duplicate insert for repeat/concurrent finalization", async () => {
    const emptyRepository = new ChampionRepository();
    await expect(createSoloChampionService(emptyRepository).finalizePreviousWeekIfNeeded(new Date("2026-08-24T00:00:00.000Z"))).resolves.toBe(0);
    expect(emptyRepository.creations).toHaveLength(0);

    const repository = new ChampionRepository(
      [{ id: "company-attempt", userId: "winner", departmentId: null, departmentNameSnapshot: null, primaryScore: 100, secondaryScore: 99 }],
      [],
    );
    const service = createSoloChampionService(repository);
    await service.finalizePreviousWeekIfNeeded(new Date("2026-08-24T00:00:00.000Z"));
    await service.finalizePreviousWeekIfNeeded(new Date("2026-08-24T00:00:00.000Z"));
    expect(repository.creations).toHaveLength(2);
    expect(repository.creations[0]).toHaveLength(4);
    expect(repository.creations[1]).toHaveLength(4);
  });
});
