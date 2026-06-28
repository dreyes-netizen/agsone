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
  pointsBalance: number;
  departmentId: string | null;
};

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
        pointsBalance: true,
        departmentId: true,
      },
    });

    return user as AuthUser | null;
  } catch (err) {
    // Returning null (→ 401) is intentional and the client retry logic depends
    // on it, but log so a Firebase/DB outage during verification is visible
    // rather than silently surfacing as a wave of 401s.
    console.error("[verifyAuth]", err);
    return null;
  }
}

export function requireRole(user: AuthUser | null, roles: Role[]): boolean {
  if (!user) return false;
  return roles.includes(user.role);
}
