import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, requireRole } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";
import { resolveAuditNames } from "@/lib/helpers/resolveAuditNames";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!requireRole(user, ["HR_ADMIN", "SUPER_ADMIN"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action") ?? undefined;
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const limit = 30;

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where: action ? { action } : undefined,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        beforeState: true,
        afterState: true,
        createdAt: true,
        actor: { select: { id: true, displayName: true, avatarUrl: true, role: true } },
      },
    }),
    prisma.auditLog.count({ where: action ? { action } : undefined }),
  ]);

  // Backfill affected-person names for rows that predate writeAuditLog(), or
  // whose entity IS the user (e.g. UPDATE_ROLE) — see resolveAuditNames.ts.
  const enriched = await resolveAuditNames(logs);

  return NextResponse.json({ data: enriched, total, page, pages: Math.ceil(total / limit) });
}
