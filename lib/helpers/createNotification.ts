import { prisma } from "@/lib/prisma/client";
import { Prisma } from "@/lib/generated/prisma/client";
import { sendMail } from "@/lib/email/mailer";
import { notificationEmail } from "@/lib/email/templates";
import { after } from "next/server";
import { broadcast } from "@/lib/realtime/broadcast";
import { sendPushToUser } from "@/lib/push/send";
import {
  getNotificationEntry,
  PREF_KEY_ALIASES,
  type NotificationData,
} from "@/lib/constants/notificationTypes";

type CreateNotificationParams = {
  userId: string;
  type: string;
  title: string;
  body: string;
  data?: Prisma.InputJsonValue;
};

/**
 * Resolve the stored preference for a type, honouring renamed keys.
 *
 * Preferences are opt-out for in-app (absent = on) and opt-in for email
 * (absent = off). `PREF_KEY_ALIASES` maps a retired key onto its replacement so
 * a user who switched something off before the rename stays switched off
 * instead of being silently re-subscribed.
 */
function readPref(
  prefs: Record<string, boolean>,
  type: string,
  suffix = "",
): boolean | undefined {
  const key = `${type}${suffix}`;
  if (key in prefs) return prefs[key];

  for (const [oldKey, newType] of Object.entries(PREF_KEY_ALIASES)) {
    if (newType === type) {
      const aliased = `${oldKey}${suffix}`;
      if (aliased in prefs) return prefs[aliased];
    }
  }
  return undefined;
}

export async function createNotification(params: CreateNotificationParams) {
  const entry = getNotificationEntry(params.type);

  if (!entry) {
    // Fail open. A missing catalog entry is a developer mistake, not a reason
    // to drop someone's notification — but it means no deep link, no toggle
    // and no push default, so make it loud.
    console.error(
      `[notifications] no catalog entry for type "${params.type}" — see lib/constants/notificationTypes.ts`,
    );
  }

  if (entry?.toggleable) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: params.userId },
        select: { notificationPrefs: true, email: true, displayName: true },
      });
      const prefs = (user?.notificationPrefs ?? {}) as Record<string, boolean>;

      // In-app: explicit false wins, otherwise the catalog default.
      const inApp = readPref(prefs, params.type) ?? entry.defaults.inApp;
      if (inApp === false) return null;

      // Email stays strictly opt-in.
      if (readPref(prefs, params.type, "_EMAIL") === true && user?.email && user?.displayName) {
        const { subject, html } = notificationEmail(user.displayName, params.title, params.body);
        sendMail({ to: user.email, subject, html }).catch((err) =>
          console.error("notification email send failed", err),
        );
      }
    } catch (err) {
      // Fail open — a pref lookup failure must not swallow the notification.
      console.error("notification preference check failed", err);
    }
  }

  const groupKey = entry?.groupKey?.(params.data as NotificationData) ?? null;
  const notification = groupKey
    ? await upsertGrouped(params, groupKey)
    : await prisma.notification.create({ data: params });

  // Third channel: Web Push, for anyone who has installed the app and opted in.
  //
  // This is the only channel that reaches someone who is not looking at a tab.
  // The realtime socket is torn down after 2 minutes hidden
  // (REALTIME_IDLE_GRACE_MS) and the fallback poll pauses with it, so an
  // in-app notification structurally cannot reach a closed app.
  //
  // Deferred via after() so the push round trip never delays the mutation that
  // triggered it, and wrapped so a push failure can never fail the request.
  if (entry) {
    const pushAllowed =
      !entry.toggleable || (await isPushEnabled(params.userId, params.type, entry.defaults.push));

    if (pushAllowed && entry.defaults.push) {
      const url = entry.href(params.data as NotificationData) ?? "/feed";
      after(() =>
        sendPushToUser(params.userId, {
          title: params.title,
          body: params.body,
          url,
          // Reuse the in-app grouping key so the OS collapses the same repeats
          // the bell does, instead of stacking one banner per event.
          tag: groupKey ?? undefined,
        }),
      );
    }
  }

  // Ping the recipient's channel so their notification bell re-fetches instantly.
  await broadcast(`user:${params.userId}`);

  return notification;
}

/**
 * Push is opt-out per type once the user has a subscription, defaulting to the
 * catalog value. Read separately from the in-app check because a user can
 * reasonably want a notification in the bell but not on their phone.
 */
async function isPushEnabled(userId: string, type: string, fallback: boolean): Promise<boolean> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { notificationPrefs: true },
    });
    const prefs = (user?.notificationPrefs ?? {}) as Record<string, boolean>;
    return readPref(prefs, type, "_PUSH") ?? fallback;
  } catch (err) {
    console.error("push preference check failed", err);
    return fallback;
  }
}

/**
 * Merge into the newest *unread* row sharing this key, or insert a new one.
 *
 * Deliberately scoped to unread: once someone has read "2 people reacted",
 * a third reaction should surface again rather than mutate a row they have
 * already dismissed. `createdAt` is bumped so the merged row returns to the top
 * of the bell — otherwise a busy thread would quietly age out of the 30-row
 * window while still collecting activity.
 */
async function upsertGrouped(params: CreateNotificationParams, groupKey: string) {
  const existing = await prisma.notification.findFirst({
    where: { userId: params.userId, groupKey, readAt: null },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });

  if (!existing) {
    return prisma.notification.create({ data: { ...params, groupKey } });
  }

  return prisma.notification.update({
    where: { id: existing.id },
    data: {
      title: params.title,
      body: params.body,
      data: params.data,
      count: { increment: 1 },
      createdAt: new Date(),
    },
  });
}
