import { prisma } from "@/lib/prisma/client";

// Read-time backfill for AuditLog rows that don't carry the affected
// person's name — either because they predate writeAuditLog() (the oldest
// rows only ever stored a bare id), or because the action's entity IS the
// user (UPDATE_ROLE's entityId is the target user's id, never captured as a
// name at all until this project). This is what lets historical rows render
// correctly on the Recent Admin Activity panel and the Audit Log page with
// no data migration — every write from now on captures the name directly
// (see writeAuditLog.ts), so this only ever has legacy rows to fix up.
//
// Replaces two near-duplicate, and one outright broken, backfill blocks that
// used to live inline in app/api/admin/audit/route.ts and
// app/api/admin/analytics/route.ts. The audit route's version filtered
// unresolved ids by re-running `.find()` for the FIRST row with a given id,
// not the current row — so a second, unnamed occurrence of the same id
// resolved to whatever the first occurrence happened to have (usually
// nothing, since a real name would have made it "resolved" already). This
// version resolves each row independently.

// beforeState/afterState come straight off Prisma's Json? columns, typed as
// `unknown` here rather than `Record<string, unknown> | null` so callers can
// pass query results without an intermediate cast.
export type ResolvableAuditRow = {
  entityType: string;
  entityId: string;
  beforeState: unknown;
  afterState: unknown;
};

function asRecord(value: unknown): Record<string, unknown> {
  return (value ?? {}) as Record<string, unknown>;
}

// The id/name pair a row is currently carrying for "who this was done to",
// understanding both the current convention (targetUserId/targetUserName)
// and the legacy one (toUserId/toUserName) it replaced. Falls back to the
// entity's own id when the entity IS the affected user (UPDATE_ROLE and
// anything else whose entityType is "User").
function currentTarget(row: ResolvableAuditRow): { id?: string; name?: string } {
  const after = asRecord(row.afterState);
  const id = (after.targetUserId ?? after.toUserId ?? (row.entityType === "User" ? row.entityId : undefined)) as
    | string
    | undefined;
  const name = (after.targetUserName ?? after.toUserName) as string | undefined;
  return { id, name };
}

export async function resolveAuditNames<T extends ResolvableAuditRow>(rows: T[]): Promise<T[]> {
  const unresolvedIds = new Set<string>();
  for (const row of rows) {
    const { id, name } = currentTarget(row);
    if (id && !name) unresolvedIds.add(id);

    const before = asRecord(row.beforeState);
    if (before.authorId && !before.authorName) unresolvedIds.add(String(before.authorId));
  }

  if (unresolvedIds.size === 0) return rows;

  const users = await prisma.user.findMany({
    where: { id: { in: [...unresolvedIds] } },
    select: { id: true, displayName: true },
  });
  const nameMap = new Map(users.map((u) => [u.id, u.displayName]));
  const nameFor = (id: string) => nameMap.get(id) ?? "Unknown user";

  return rows.map((row) => {
    const { id, name } = currentTarget(row);
    const before = asRecord(row.beforeState);
    const needsTarget = id && !name;
    const needsAuthor = before.authorId && !before.authorName;
    if (!needsTarget && !needsAuthor) return row;

    return {
      ...row,
      afterState: needsTarget
        ? { ...asRecord(row.afterState), targetUserId: id, targetUserName: nameFor(id as string) }
        : row.afterState,
      beforeState: needsAuthor
        ? { ...before, authorName: nameFor(String(before.authorId)) }
        : row.beforeState,
    };
  });
}
