import type { Prisma } from "@/lib/generated/prisma/client";

/**
 * The feed's department-visibility rule, as a reusable Prisma where-clause
 * fragment: HR_ADMIN sees every post; everyone else sees company-wide posts
 * (departmentId: null) plus their own department's. Originally only applied
 * in GET /api/feed's list query — now shared with the react and reactions
 * routes too, so a post a user can't see in their feed can't be reacted to
 * or have its reactor list pulled by id either.
 */
export function postVisibilityWhere(user: { role: string; departmentId: string | null }): Prisma.SocialPostWhereInput {
  if (user.role === "HR_ADMIN") return {};
  return { OR: [{ departmentId: null }, { departmentId: user.departmentId }] };
}
