import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyAuth } from "@/lib/auth/verifyAuth";
import { getSoloLeaderboard } from "@/lib/minigames/solo/leaderboard";
import { finalizePreviousWeekIfNeeded } from "@/lib/minigames/solo/champions";
import { getManilaRankKeys } from "@/lib/minigames/solo/time";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const querySchema = z.object({
  gameType: z.enum(["TYPING", "REACTION", "VISUAL_MEMORY", "SEQUENCE_MEMORY"]),
  period: z.enum(["week", "alltime"]),
  scope: z.enum(["company", "department"]),
}).strict();

export async function GET(request: NextRequest) {
  const user = await verifyAuth(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = parseQuery(request, querySchema);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const departmentId = parsed.data.scope === "department" ? user.departmentId : null;
  if (parsed.data.scope === "department" && !departmentId) {
    return NextResponse.json({ error: "Department leaderboard is unavailable" }, { status: 403 });
  }

  finalizeChampionsInBackground(new Date());
  const rankKeys = getManilaRankKeys(new Date());
  const leaderboard = await getSoloLeaderboard({
    gameType: parsed.data.gameType,
    period: parsed.data.period,
    scope: parsed.data.scope,
    weekStart: parsed.data.period === "week" ? dateOnly(rankKeys.weekStart) : undefined,
    departmentId,
    currentUserId: user.id,
  });

  return NextResponse.json({ data: leaderboard });
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
  void finalizePreviousWeekIfNeeded(now).catch((error: unknown) => {
    console.error("[solo champion finalization]", error);
  });
}
