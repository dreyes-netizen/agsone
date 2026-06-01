import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, requireRole } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!requireRole(user, ["HR_ADMIN"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const requests = await prisma.medicineRequest.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      medicine: { select: { id: true, name: true, imageUrl: true } },
      user: { select: { id: true, displayName: true, avatarUrl: true } },
      approvedBy: { select: { id: true, displayName: true } },
    },
  });

  return NextResponse.json({ data: requests });
}
