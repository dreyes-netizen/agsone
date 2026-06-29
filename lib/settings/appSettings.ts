import { prisma } from "@/lib/prisma/client";

/**
 * Global app settings live in the `AppSetting` key/value table — one row per
 * flag. This module is the single source of truth for the keys and their
 * defaults so the rest of the app never touches raw rows or hard-codes a key.
 */

export const SETTING_KEYS = {
  ALLY_ENABLED: "ally_enabled",
} as const;

/**
 * Whether the Ally HR assistant is available to employees.
 * Defaults to `true` when the row has never been set (Ally on out of the box).
 */
export async function getAllyEnabled(): Promise<boolean> {
  const row = await prisma.appSetting.findUnique({
    where: { key: SETTING_KEYS.ALLY_ENABLED },
  });
  if (!row) return true;
  return row.value === true;
}

/** Set the Ally on/off flag, recording who changed it. */
export async function setAllyEnabled(enabled: boolean, userId: string): Promise<void> {
  await prisma.appSetting.upsert({
    where: { key: SETTING_KEYS.ALLY_ENABLED },
    create: { key: SETTING_KEYS.ALLY_ENABLED, value: enabled, updatedById: userId },
    update: { value: enabled, updatedById: userId },
  });
}
