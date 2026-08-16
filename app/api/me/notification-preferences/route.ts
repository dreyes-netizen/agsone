import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";
import type { Prisma } from "@/lib/generated/prisma/client";
import { scheduleBroadcast } from "@/lib/realtime/broadcast";
import { realtimeTopics } from "@/lib/realtime/topics";
import {
  NOTIFICATION_TYPES,
  TOGGLEABLE_TYPES,
  PREF_KEY_ALIASES,
} from "@/lib/constants/notificationTypes";

/**
 * Preference keys are derived from the catalog rather than hand-listed here.
 * The previous hardcoded arrays had drifted: two of the four keys they exposed
 * matched no emitter, so the UI rendered switches that did nothing.
 *
 * Each toggleable type yields three keys: `TYPE` (in-app), `TYPE_EMAIL`
 * (always default off — email stays opt-in) and `TYPE_PUSH` (defaults to the
 * catalog's push value). Push is a separate axis on purpose: wanting something
 * in the bell but not on your phone is an entirely reasonable preference.
 */
const PREF_KEYS: string[] = TOGGLEABLE_TYPES.flatMap((t) => [t, `${t}_EMAIL`, `${t}_PUSH`]);
const PREF_KEY_SET = new Set(PREF_KEYS);

function defaults(): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const type of TOGGLEABLE_TYPES) {
    out[type] = NOTIFICATION_TYPES[type].defaults.inApp;
    out[`${type}_EMAIL`] = false;
    out[`${type}_PUSH`] = NOTIFICATION_TYPES[type].defaults.push;
  }
  return out;
}

/**
 * Merge stored values over the catalog defaults, resolving retired keys.
 * A user who opted out under an old key stays opted out.
 */
function resolve(stored: Record<string, boolean>): Record<string, boolean> {
  const merged = defaults();

  for (const [oldKey, newType] of Object.entries(PREF_KEY_ALIASES)) {
    if (oldKey in stored) merged[newType] = stored[oldKey];
    if (`${oldKey}_EMAIL` in stored) merged[`${newType}_EMAIL`] = stored[`${oldKey}_EMAIL`];
    if (`${oldKey}_PUSH` in stored) merged[`${newType}_PUSH`] = stored[`${oldKey}_PUSH`];
  }

  // Current keys win over any aliased value.
  for (const key of PREF_KEYS) {
    if (key in stored) merged[key] = stored[key];
  }
  return merged;
}

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { notificationPrefs: true },
  });

  return NextResponse.json({
    data: resolve((dbUser?.notificationPrefs ?? {}) as Record<string, boolean>),
  });
}

export async function PUT(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as Record<string, unknown>;

  const invalidKeys = Object.keys(body).filter((k) => !PREF_KEY_SET.has(k));
  if (invalidKeys.length > 0) {
    return NextResponse.json(
      { error: `Invalid preference keys: ${invalidKeys.join(", ")}` },
      { status: 400 },
    );
  }

  const invalidValues = Object.entries(body).filter(([, v]) => typeof v !== "boolean");
  if (invalidValues.length > 0) {
    return NextResponse.json({ error: "Preference values must be boolean" }, { status: 400 });
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { notificationPrefs: true },
  });
  const existing = (dbUser?.notificationPrefs ?? {}) as Record<string, boolean>;
  const updated: Record<string, boolean> = { ...existing, ...(body as Record<string, boolean>) };

  await prisma.user.update({
    where: { id: user.id },
    data: { notificationPrefs: updated as Prisma.InputJsonValue },
  });

  scheduleBroadcast([{ topic: realtimeTopics.notificationPreferences(user.id) }]);

  return NextResponse.json({ data: resolve(updated) });
}
