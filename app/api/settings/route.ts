import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verifyAuth";
import { getAllyEnabled } from "@/lib/settings/appSettings";

// Public (authenticated) read of client-safe global settings.
// Used by the Ally widget and the chat route to know if Ally is enabled.
export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const allyEnabled = await getAllyEnabled();
  return NextResponse.json({ data: { allyEnabled } });
}
