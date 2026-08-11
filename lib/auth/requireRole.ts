import type { Role } from "@/lib/generated/prisma/client";

// Split out from verifyAuth.ts so it has zero dependency on Firebase Admin
// (which eagerly initializes from env vars at import time) -- this file is
// pure and safe to import in tests without live credentials.
export type AuthUser = {
  id: string;
  firebaseUid: string;
  email: string;
  displayName: string;
  role: Role;
  departmentId: string | null;
};

export function requireRole(user: AuthUser | null, roles: Role[]): user is AuthUser {
  if (!user) return false;
  return roles.includes(user.role);
}
