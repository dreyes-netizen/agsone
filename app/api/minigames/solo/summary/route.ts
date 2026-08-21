import { after, type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyAuth } from "@/lib/auth/verifyAuth";
import { getSoloSummary } from "@/lib/minigames/solo/leaderboard";
import { finalizePreviousWeekIfNeeded } from "@/lib/minigames/solo/champions";
import { getManilaRankKeys } from "@/lib/minigames/solo/time";
import { prisma } from "@/lib/prisma/client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const MAX_DAILY_RANKED_ATTEMPTS = 3;
const querySchema = z.object({
  gameType: z.enum(["TYPING", "REACTION", "VISUAL_MEMORY", "SEQUENCE_MEMORY"]),
}).strict();

export async function GET(request: NextRequest) {
  const user = await verifyAuth(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = parseQuery(request, querySchema);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  finalizeChampionsInBackground(new Date());
  const rankKeys = getManilaRankKeys(new Date());
  const weekStart = dateOnly(rankKeys.weekStart);
  const rankDate = dateOnly(rankKeys.rankDate);
  const companyWeekRequest = {
    userId: user.id,
    gameType: parsed.data.gameType,
    period: "week" as const,
    scope: "company" as const,
    weekStart,
    departmentId: null,
  };
  const companyAllTimeRequest = {
    userId: user.id,
    gameType: parsed.data.gameType,
    period: "alltime" as const,
    scope: "company" as const,
    departmentId: null,
  };
  const departmentWeekRequest = user.departmentId ? {
    userId: user.id,
    gameType: parsed.data.gameType,
    period: "week" as const,
    scope: "department" as const,
    weekStart,
    departmentId: user.departmentId,
  } : null;
  const departmentAllTimeRequest = user.departmentId ? {
    userId: user.id,
    gameType: parsed.data.gameType,
    period: "alltime" as const,
    scope: "department" as const,
    departmentId: user.departmentId,
  } : null;

  const [weekCompany, weekDepartment, allTimeCompany, allTimeDepartment, occupiedStarts] = await Promise.all([
    getSoloSummary(companyWeekRequest),
    departmentWeekRequest ? getSoloSummary(departmentWeekRequest) : Promise.resolve(null),
    getSoloSummary(companyAllTimeRequest),
    departmentAllTimeRequest ? getSoloSummary(departmentAllTimeRequest) : Promise.resolve(null),
    prisma.soloGameAttempt.count({
      where: { userId: user.id, gameType: parsed.data.gameType, rankDate },
    }),
  ]);

  return NextResponse.json({
    data: {
      attemptsRemaining: Math.max(0, MAX_DAILY_RANKED_ATTEMPTS - occupiedStarts),
      personalBest: allTimeCompany,
      ranks: {
        week: { company: weekCompany, department: weekDepartment },
        allTime: { company: allTimeCompany, department: allTimeDepartment },
      },
    },
  });
}

function parseQuery<T extends z.ZodType>(request: Request, schema: T) {
  const entries = Array.from(new URL(request.url).searchParams.entries());
  if (new Set(entries.map(([key]) => key)).size !== entries.length) {
    return schema.safeParse({});
  }
  return schema.safeParse(Object.fromEntries(entries));
}

function dateOnly(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function finalizeChampionsInBackground(now: Date) {
  after(async () => {
    try {
      await finalizePreviousWeekIfNeeded(now);
    } catch (error) {
      console.error("[solo champion finalization]", error);
    }
  });
}
