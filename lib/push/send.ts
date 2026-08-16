import webpush from "web-push";
import { prisma } from "@/lib/prisma/client";

/**
 * Web Push delivery.
 *
 * No third-party service is involved: the browser vendors' push services (FCM
 * for Chrome/Android, Mozilla autopush, Apple for Safari) are free and
 * unmetered. VAPID is a signature identifying this server, not an API key —
 * which is why the only configuration here is a keypair and a contact address.
 */

export type PushPayload = {
  title: string;
  body: string;
  /** Where a tap should land. */
  url?: string;
  /** Collapses repeats of the same subject into one OS notification. */
  tag?: string;
};

let configured: boolean | null = null;

/**
 * Configure lazily and remember the outcome. Reading env at module scope would
 * make an unconfigured deployment throw at import time and take the whole route
 * down; push not being set up should degrade to "no push", never to a 500.
 */
function ensureConfigured(): boolean {
  if (configured !== null) return configured;

  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;

  if (!publicKey || !privateKey || !subject) {
    console.warn("[push] VAPID keys not configured — push delivery is disabled");
    configured = false;
    return false;
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
  return true;
}

/** The public half, safe to hand to the browser. */
export function getVapidPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY ?? null;
}

type SubscriptionRow = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

/**
 * Deliver to one device. Resolves to false when the subscription is gone.
 *
 * A 404 or 410 means the push service has permanently retired that endpoint —
 * the user revoked permission, cleared site data, or uninstalled the app. Those
 * rows MUST be deleted: nothing else ever removes them, and a table full of
 * dead endpoints makes every subsequent fan-out slower and noisier.
 */
async function sendToSubscription(sub: SubscriptionRow, payload: PushPayload): Promise<boolean> {
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(payload),
      { TTL: 60 * 60 * 24 }, // a day-old notification is not worth delivering
    );
    return true;
  } catch (err) {
    const status = (err as { statusCode?: number })?.statusCode;

    if (status === 404 || status === 410) {
      await prisma.pushSubscription
        .delete({ where: { id: sub.id } })
        .catch(() => {/* already gone — another send pruned it */});
      return false;
    }

    // 413 payload too large, 429 rate limited, 5xx transient. Log and move on;
    // the client's poll and Realtime resync remain the safety net.
    console.error(`[push] send failed (status ${status ?? "unknown"})`, err);
    return false;
  }
}

/** Deliver to every device belonging to one user. Never throws. */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  if (!ensureConfigured()) return;

  try {
    const subs = await prisma.pushSubscription.findMany({
      where: { userId },
      select: { id: true, endpoint: true, p256dh: true, auth: true },
    });
    if (subs.length === 0) return;

    const results = await Promise.all(subs.map((s) => sendToSubscription(s, payload)));

    const deliveredIds = subs.filter((_, i) => results[i]).map((s) => s.id);
    if (deliveredIds.length > 0) {
      await prisma.pushSubscription
        .updateMany({ where: { id: { in: deliveredIds } }, data: { lastUsedAt: new Date() } })
        .catch(() => {/* bookkeeping only */});
    }
  } catch (err) {
    console.error("[push] sendPushToUser failed", err);
  }
}

/**
 * Deliver to several users, bounded so a broadcast cannot open hundreds of
 * concurrent sockets from one serverless invocation.
 */
export async function sendPushToUsers(userIds: string[], payload: PushPayload): Promise<void> {
  const unique = [...new Set(userIds)];
  const CONCURRENCY = 20;

  for (let i = 0; i < unique.length; i += CONCURRENCY) {
    await Promise.all(unique.slice(i, i + CONCURRENCY).map((id) => sendPushToUser(id, payload)));
  }
}
