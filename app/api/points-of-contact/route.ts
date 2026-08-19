import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";
import { USER_PHOTO_SELECT, withOrgChartPhotoUrl } from "@/lib/orgChart/resolveAvatar";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const contacts = await prisma.pointOfContact.findMany({
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      position: true,
      description: true,
      user: { select: { id: true, displayName: true, email: true, ...USER_PHOTO_SELECT } },
    },
  });

  const data = contacts.map((c) => ({ ...c, user: withOrgChartPhotoUrl(c.user) }));

  return NextResponse.json({ data });
}
