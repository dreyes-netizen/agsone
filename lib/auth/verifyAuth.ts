import { NextRequest } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";
import { prisma } from "@/lib/prisma/client";
import type { Role } from "@/lib/generated/prisma/client";

export type AuthUser = {
  id: string;
  firebaseUid: string;
  email: string;
  displayName: string;
  role: Role;
  departmentId: string | null;
};

/**
 * Verify the caller's Firebase ID token and return their DB row.
 *
 * pointsBalance intentionally is NOT selected here (and isn't part of
 * AuthUser): it changes constantly, and its one former consumer
 * (app/api/redemptions/route.ts) now re-checks it atomically inside its own
 * transaction instead of trusting a value read at request-auth time — see
 * that file for why the old read-then-check was a double-spend bug.
 *
 * isActive IS checked here (but not exposed on AuthUser): a deactivated
 * employee's Firebase token stays valid for up to ~1hr after deactivation,
 * so without this check they'd keep full API access until it expired.
 */
export async function verifyAuth(req: NextRequest): Promise<AuthUser | null> {
  try {
    const token = req.headers.get("authorization")?.split("Bearer ")[1];
    if (!token) return null;

    const decoded = await adminAuth.verifyIdToken(token);
    const user = await prisma.user.findUnique({
      where: { firebaseUid: decoded.uid },
      select: {
        id: true,
        firebaseUid: true,
        email: true,
        displayName: true,
        role: true,
        departmentId: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) return null;
    return {
      id: user.id,
      // firebaseUid is nullable in the schema (manually-created employees
      // start with none), but this row was matched BY firebaseUid = decoded.uid
      // above, so it cannot be null for the row we actually got back.
      firebaseUid: user.firebaseUid!,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      departmentId: user.departmentId,
    };
  } catch (err) {
    // Returning null (→ 401) is intentional and the client retry logic depends
    // on it, but log so a Firebase/DB outage during verification is visible
    // rather than silently surfacing as a wave of 401s.
    console.error("[verifyAuth]", err);
    return null;
  }
}

/**
 * Verify the caller's Firebase ID token without a DB round trip. Use when a
 * handler needs a full/wider column selection than AuthUser provides and
 * would otherwise query the User row twice (once inside verifyAuth, once
 * again in the handler) — see app/api/me/route.ts for the motivating case.
 */
export async function verifyToken(req: NextRequest): Promise<string | null> {
  const token = req.headers.get("authorization")?.split("Bearer ")[1];
  if (!token) return null;
  try {
    return (await adminAuth.verifyIdToken(token)).uid;
  } catch (err) {
    console.error("[verifyToken]", err);
    return null;
  }
}

export function requireRole(user: AuthUser | null, roles: Role[]): user is AuthUser {
  if (!user) return false;
  return roles.includes(user.role);
}
