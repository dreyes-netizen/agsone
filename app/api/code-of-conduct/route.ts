import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verifyAuth";
import { getCodeOfConduct } from "@/lib/settings/codeOfConduct";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const data = await getCodeOfConduct();
  return NextResponse.json({ data });
}
