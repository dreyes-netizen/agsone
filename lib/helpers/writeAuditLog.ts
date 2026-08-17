import { prisma } from "@/lib/prisma/client";
import type { Prisma } from "@/lib/generated/prisma/client";

/**
 * Single source of truth for writing an AuditLog row. Before this helper
 * existed, all 9 call sites built the Prisma `create` call inline and each
 * invented its own JSON shape for "who this action was done to" — some
 * stored an id, some a name, some both, some neither. That's why historical
 * rows render inconsistently on the Recent Admin Activity panel and the
 * Audit Log page.
 *
 * Convention going forward: the affected person (if any) is always
 * `targetUserId` + `targetUserName` inside `afterState`. Reader code
 * (lib/helpers/resolveAuditNames.ts, lib/helpers/auditSummary.ts) still
 * understands the legacy `toUserId`/`toUserName` keys so old rows keep
 * rendering correctly — this helper just stops writing them.
 *
 * The name is captured now, at write time, rather than looked up later —
 * an audit row should read as a point-in-time record. If the employee is
 * renamed afterward, this row still reflects who they were when it happened.
 * Rows written before this helper existed (or whose target user has since
 * been deleted) fall back to a read-time lookup — see resolveAuditNames.
 */
export type AuditTarget = { userId: string; userName: string };

export type WriteAuditLogArgs = {
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  target?: AuditTarget;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
};

// Deliberately NOT transaction-aware: call this after an existing
// $transaction resolves, not from inside one. Writing inside it would
// extend that transaction's lock hold time for no real durability gain —
// if the transaction rolls back, this call is simply never reached.
export async function writeAuditLog({
  actorId,
  action,
  entityType,
  entityId,
  target,
  before,
  after,
}: WriteAuditLogArgs) {
  const afterState =
    target || after
      ? { ...(after ?? {}), ...(target ? { targetUserId: target.userId, targetUserName: target.userName } : {}) }
      : undefined;

  await prisma.auditLog.create({
    data: {
      actorId,
      action,
      entityType,
      entityId,
      beforeState: (before ?? undefined) as Prisma.InputJsonValue | undefined,
      afterState: afterState as Prisma.InputJsonValue | undefined,
    },
  });
}
