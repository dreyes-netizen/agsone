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
  } catch {
    return null;
  }
}

export function requireRole(user: AuthUser | null, roles: Role[]): boolean {
  if (!user) return false;
  return roles.includes(user.role);
}
