import { prisma } from "@/lib/prisma/client";
import { Prisma } from "@/lib/generated/prisma/client";

type CreateNotificationParams = {
  userId: string;
  type: string;
  title: string;
  body: string;
  data?: Prisma.InputJsonValue;
};

const TOGGLEABLE_TYPES = [
  "SHOUTOUT_RECEIVED",
  "MISSION_COMPLETED",
  "POINTS_AWARDED",
  "MILESTONE_REWARD",
];

export async function createNotification(params: CreateNotificationParams) {
  if (TOGGLEABLE_TYPES.includes(params.type)) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: params.userId },
        select: { notificationPrefs: true },
      });
      const prefs = (user?.notificationPrefs ?? {}) as Record<string, boolean>;
      if (prefs[params.type] === false) return null;
    } catch {
      // fail open — if pref check errors, still send notification
    }
  }
  return prisma.notification.create({ data: params });
}
