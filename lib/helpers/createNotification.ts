import { prisma } from "@/lib/prisma/client";
import { Prisma } from "@/lib/generated/prisma/client";
import { sendMail } from "@/lib/email/mailer";
import { notificationEmail } from "@/lib/email/templates";
import { broadcast } from "@/lib/realtime/broadcast";

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
        select: { notificationPrefs: true, email: true, displayName: true },
      });
      const prefs = (user?.notificationPrefs ?? {}) as Record<string, boolean>;

      // In-app opt-out check (default true — only skip if explicitly false)
      if (prefs[params.type] === false) return null;

      // Email opt-in check (default false — only send if explicitly true)
      const emailKey = `${params.type}_EMAIL`;
      if (prefs[emailKey] === true && user?.email && user?.displayName) {
        const { subject, html } = notificationEmail(user.displayName, params.title, params.body);
        sendMail({ to: user.email, subject, html }).catch(() => {});
      }
    } catch {
      // fail open — if pref check errors, still send notification
    }
  }
  const notification = await prisma.notification.create({ data: params });

  // Ping the recipient's channel so their notification bell re-fetches instantly.
  await broadcast(`user:${params.userId}`);

  return notification;
}
