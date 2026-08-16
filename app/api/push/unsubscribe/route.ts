import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";
import { z } from "zod";

const unsubscribeSchema = z.object({
  endpoint: z.string().url().max(1000),
});

/**
 * Remove this device's subscription.
 *
 * Scoped to the caller's own rows: knowing an endpoint string must not let one
 * user silently switch off another's notifications. Deleting an endpoint that
 * is already gone is a success, not a 404 — the caller's intent is satisfied
 * either way, and the row may well have been pruned already by a 410 from the
 * push service.
 */
export async function POST(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = unsubscribeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  await prisma.pushSubscription.deleteMany({
    where: { endpoint: parsed.data.endpoint, userId: user.id },
  });

  return NextResponse.json({ data: { ok: true } });
}
