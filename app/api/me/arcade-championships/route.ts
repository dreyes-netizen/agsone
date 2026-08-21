import { type NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verifyAuth";
import {
  finalizePreviousWeekIfNeeded,
  getUserChampionships,
} from "@/lib/minigames/solo/champions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const user = await verifyAuth(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await finalizePreviousWeekIfNeeded(new Date());
  const championships = await getUserChampionships(user.id);
  return NextResponse.json({ data: championships });
}
