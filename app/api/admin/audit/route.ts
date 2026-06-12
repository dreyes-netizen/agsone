import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, requireRole } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";

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

  // Resolve any toUserId references that older entries stored without a name
  const unresolvedIds = logs
    .map((l) => (l.afterState as Record<string, unknown>)?.toUserId as string | undefined)
    .filter((id): id is string => !!id && !((l: typeof logs[number]) =>
      (l.afterState as Record<string, unknown>)?.toUserName)(logs.find((x) => (x.afterState as Record<string, unknown>)?.toUserId === id)!));

  const uniqueIds = [...new Set(unresolvedIds)];
  let nameMap: Record<string, string> = {};
  if (uniqueIds.length > 0) {
    const users = await prisma.user.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true, displayName: true },
    });
    nameMap = Object.fromEntries(users.map((u) => [u.id, u.displayName]));
  }

  // Inject resolved names into afterState for older entries
  const enriched = logs.map((log) => {
    const after = log.afterState as Record<string, unknown> | null;
    if (after?.toUserId && !after?.toUserName && nameMap[after.toUserId as string]) {
      return { ...log, afterState: { ...after, toUserName: nameMap[after.toUserId as string] } };
    }
    return log;
  });

  return NextResponse.json({ data: enriched, total, page, pages: Math.ceil(total / limit) });
}
