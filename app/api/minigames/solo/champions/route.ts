import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyAuth } from "@/lib/auth/verifyAuth";
import {
  finalizePreviousWeekIfNeeded,
  getRecentCompanyChampions,
  getUserChampionships,
} from "@/lib/minigames/solo/champions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const querySchema = z.object({
  includeRecentCompany: z.enum(["true", "false"]).optional(),
}).strict();

export async function GET(request: NextRequest) {
  const user = await verifyAuth(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = parseQuery(request);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  await finalizePreviousWeekIfNeeded(new Date());
  const championships = await getUserChampionships(user.id);
  const recentCompanyChampions = parsed.data.includeRecentCompany === "true"
    ? await getRecentCompanyChampions(12)
    : undefined;

  return NextResponse.json({
    data: {
      championships,
      ...(recentCompanyChampions ? { recentCompanyChampions } : {}),
    },
  });
}

function parseQuery(request: Request) {
  const entries = Array.from(new URL(request.url).searchParams.entries());
  if (new Set(entries.map(([key]) => key)).size !== entries.length) return querySchema.safeParse({ duplicateQueryParameter: true });
  return querySchema.safeParse(Object.fromEntries(entries));
}
