import { NextResponse, type NextRequest } from "next/server";
import { verifyAuth } from "@/lib/auth/verifyAuth";
import { getSoloPersonalBests } from "@/lib/minigames/solo/personalBests";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const user = await verifyAuth(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const personalBests = await getSoloPersonalBests(user.id);
  return NextResponse.json({ data: { personalBests } });
}
