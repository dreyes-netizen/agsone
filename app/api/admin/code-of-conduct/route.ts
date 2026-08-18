import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, requireRole } from "@/lib/auth/verifyAuth";
import { getCodeOfConduct, setCodeOfConduct, codeOfConductSchema } from "@/lib/settings/codeOfConduct";
import { scheduleBroadcast } from "@/lib/realtime/broadcast";
import { realtimeTopics } from "@/lib/realtime/topics";
import { writeAuditLog } from "@/lib/helpers/writeAuditLog";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!requireRole(user, ["HR_ADMIN", "SUPER_ADMIN"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const data = await getCodeOfConduct();
  return NextResponse.json({ data });
}

export async function PATCH(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!requireRole(user, ["HR_ADMIN", "SUPER_ADMIN"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = codeOfConductSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  await setCodeOfConduct(parsed.data, user.id);

  // Reuses the generic UPDATE_SETTING action (same as the Ally on/off flag)
  // rather than inventing a one-off action — this is policy content, worth
  // auditing, but not worth its own ACTION_LABELS entry.
  await writeAuditLog({
    actorId: user.id,
    action: "UPDATE_SETTING",
    entityType: "AppSetting",
    entityId: "code_of_conduct",
  });

  scheduleBroadcast([
    { topic: realtimeTopics.codeOfConduct },
    { topic: realtimeTopics.adminAudit },
  ]);

  return NextResponse.json({ data: parsed.data });
}
