import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, requireRole } from "@/lib/auth/verifyAuth";
import { getAllyEnabled, setAllyEnabled } from "@/lib/settings/appSettings";
import { z } from "zod";
import { scheduleBroadcast } from "@/lib/realtime/broadcast";
import { realtimeTopics } from "@/lib/realtime/topics";
import { writeAuditLog } from "@/lib/helpers/writeAuditLog";

const schema = z.object({
  allyEnabled: z.boolean(),
});

// Admin read — same payload as the public GET, kept here so the admin UI has a
// single namespace for settings reads and writes.
export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!requireRole(user, ["HR_ADMIN", "SUPER_ADMIN"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const allyEnabled = await getAllyEnabled();
  return NextResponse.json({ data: { allyEnabled } });
}

export async function PATCH(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!requireRole(user, ["HR_ADMIN", "SUPER_ADMIN"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const previouslyEnabled = await getAllyEnabled();
  await setAllyEnabled(parsed.data.allyEnabled, user.id);

  await writeAuditLog({
    actorId: user.id,
    action: "UPDATE_SETTING",
    entityType: "AppSetting",
    entityId: "ally_enabled",
    before: { allyEnabled: previouslyEnabled },
    after: { allyEnabled: parsed.data.allyEnabled },
  });

  scheduleBroadcast([
    { topic: realtimeTopics.settings },
    { topic: realtimeTopics.adminAudit },
  ]);

  return NextResponse.json({ data: { allyEnabled: parsed.data.allyEnabled } });
}
