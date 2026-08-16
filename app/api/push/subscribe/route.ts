import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";
import { getVapidPublicKey } from "@/lib/push/send";
import { z } from "zod";

/**
 * GET — hand the browser the VAPID public key it needs to subscribe.
 *
 * Served at runtime rather than inlined as a NEXT_PUBLIC_ build-time variable
 * so the key can be set or rotated without a rebuild. It is public by
 * definition (it ships to every client), so there is nothing to protect here
 * beyond requiring a signed-in user.
 */
export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const key = getVapidPublicKey();
  if (!key) {
    // Push is simply not configured on this deployment. The client treats this
    // as "unsupported" and hides the toggle rather than showing a broken one.
    return NextResponse.json({ data: { publicKey: null } });
  }
  return NextResponse.json({ data: { publicKey: key } });
}

const subscribeSchema = z.object({
  endpoint: z.string().url().max(1000),
  keys: z.object({
    p256dh: z.string().min(1).max(255),
    auth: z.string().min(1).max(255),
  }),
});

/**
 * POST — register this device.
 *
 * Upserts on `endpoint`, which the push service guarantees is stable per
 * device, so re-subscribing is idempotent. The upsert also reassigns the row
 * if a different user signs in on the same device — otherwise the previous
 * user would keep receiving that device's notifications.
 */
export async function POST(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = subscribeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { endpoint, keys } = parsed.data;
  const userAgent = req.headers.get("user-agent")?.slice(0, 255) ?? null;

  await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: { userId: user.id, endpoint, p256dh: keys.p256dh, auth: keys.auth, userAgent },
    update: { userId: user.id, p256dh: keys.p256dh, auth: keys.auth, userAgent, lastUsedAt: new Date() },
  });

  return NextResponse.json({ data: { ok: true } }, { status: 201 });
}
