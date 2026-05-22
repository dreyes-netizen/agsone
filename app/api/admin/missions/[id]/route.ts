import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, requireRole } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = await verifyAuth(req);
  if (!requireRole(authUser, ["MANAGER", "HR_ADMIN"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const { isActive } = await req.json();

  if (typeof isActive !== "boolean") {
    return NextResponse.json({ error: "isActive (boolean) required" }, { status: 400 });
  }

  const mission = await prisma.mission.update({
    where: { id },
    data: { isActive },
  });

  return NextResponse.json({ data: mission });
}
