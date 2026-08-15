import { prisma } from "@/lib/prisma/client";
import { Prisma } from "@/lib/generated/prisma/client";
import { createNotification } from "@/lib/helpers/createNotification";

type NotifyRoleParams = {
  type: string;
  title: string;
  body: string;
  data?: Prisma.InputJsonValue;
};

type NotifyRoleOptions = {
  /**
   * Skip this user — almost always the person who performed the action. An
   * admin who approves their own queue item should not be told about it.
   */
  excludeUserId?: string;
};

/**
 * Fan a notification out to everyone currently holding one of the given roles.
 *
 * Before this, nothing in the app notified an admin. The only admin-directed
 * message was a hardcoded email string in app/api/feedback/route.ts, which does
 * not track who actually holds HR_ADMIN — granting someone the role did not add
 * them to it, and removing them did not take them off.
 *
 * Resolving recipients from the role at send time fixes that. The audience is
 * genuinely small (roughly four people hold HR_ADMIN or SUPER_ADMIN), so the
 * fan-out cost is negligible and there is no need to batch or defer it.
 *
 * Never throws: a queue notification failing must not roll back the request
 * that triggered it. Callers may safely `void` this.
 */
export async function notifyRole(
  roles: string[],
  params: NotifyRoleParams,
  opts: NotifyRoleOptions = {},
): Promise<void> {
  try {
    const recipients = await prisma.user.findMany({
      // Covered by the existing @@index([role, isActive]) on User.
      where: {
        role: { in: roles as Prisma.EnumRoleFilter["in"] },
        isActive: true,
        ...(opts.excludeUserId ? { id: { not: opts.excludeUserId } } : {}),
      },
      select: { id: true },
    });

    if (recipients.length === 0) {
      // Worth surfacing: it means an approval queue is filling up with nobody
      // holding the role to action it.
      console.warn(`[notifications] no active recipients for roles ${roles.join(", ")} (${params.type})`);
      return;
    }

    // createNotification already swallows its own per-user failures around
    // preferences, but a hard DB error on one recipient must not stop the rest.
    await Promise.allSettled(
      recipients.map((r) => createNotification({ ...params, userId: r.id })),
    );
  } catch (err) {
    console.error("[notifications] notifyRole failed", err);
  }
}

/** The set that staffs every approval queue in the app. */
export const ADMIN_ROLES = ["HR_ADMIN", "SUPER_ADMIN"] as const;
