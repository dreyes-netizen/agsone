import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";
import { withOrgChartPhotoUrl } from "@/lib/orgChart/resolveAvatar";

// A user is "in the org chart" once HR gives them a position — no separate
// membership table. Primary hierarchy comes from the existing User.managerId
// chain; additionalReportsAsUser is the secondary/support overlay (see
// lib/orgChart/toFlow.ts), never used for tree placement.
export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const nodes = await prisma.user.findMany({
    where: { position: { not: null }, isActive: true },
    select: {
      id: true,
      displayName: true,
      avatarUrl: true,
      position: true,
      managerId: true,
      orgChartHighlight: true,
      orgChartDashed: true,
      orgChartSortOrder: true,
      departmentId: true,
      department: { select: { name: true } },
      orgChartPhotoPublicId: true,
      additionalReportsAsUser: { select: { managerId: true, relationshipType: true } },
    },
    orderBy: { displayName: "asc" },
  });

  const data = nodes.map(({ department, additionalReportsAsUser, ...n }) => ({
    ...withOrgChartPhotoUrl(n),
    departmentName: department?.name ?? null,
    additionalManagers: additionalReportsAsUser,
  }));

  return NextResponse.json({ data });
}
