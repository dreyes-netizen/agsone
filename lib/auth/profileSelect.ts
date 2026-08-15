import type { Prisma } from "@/lib/generated/prisma/client";

/**
 * The authenticated user's own profile shape, shared by `GET /api/me` and
 * `POST /api/auth/bootstrap`.
 *
 * Both routes hand the same object to the same client-side consumers
 * (AuthProvider's `dbUser`, the profile page), so they have to stay identical.
 * Keeping one select means a field added for one caller can't silently go
 * missing from the other.
 *
 * `isActive` is selected but must be stripped before responding — it is read
 * to reject deactivated employees, never returned. See `stripInternal` below.
 */
export const PROFILE_SELECT = {
  id: true,
  displayName: true,
  email: true,
  avatarUrl: true,
  role: true,
  pointsBalance: true,
  level: true,
  onboardingComplete: true,
  birthday: true,
  hireDate: true,
  bio: true,
  skills: true,
  isActive: true,
  department: { select: { id: true, name: true } },
  userBadges: {
    orderBy: { awardedAt: "desc" },
    select: {
      id: true,
      awardedAt: true,
      badge: { select: { name: true, description: true } },
    },
  },
} satisfies Prisma.UserSelect;

export type ProfileWithInternal = Prisma.UserGetPayload<{
  select: typeof PROFILE_SELECT;
}>;

/** Drop server-only fields before the profile crosses the wire. */
export function stripInternal(profile: ProfileWithInternal) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- destructured only to omit isActive
  const { isActive: _isActive, ...data } = profile;
  return data;
}
