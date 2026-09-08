import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verifyAuth";
import { recordHeartbeat, getOnlineCount } from "@/lib/presence/onlinePresence";
import { scheduleBroadcast } from "@/lib/realtime/broadcast";
import { realtimeTopics } from "@/lib/realtime/topics";

export async function POST(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await recordHeartbeat(user.id);
  const count = await getOnlineCount();
  scheduleBroadcast([{ topic: realtimeTopics.onlinePresence }]);

  return NextResponse.json({ data: { count } });
}
