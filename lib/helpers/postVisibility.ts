import type { Prisma } from "@/lib/generated/prisma/client";

/**
 * The feed's department-visibility rule, as a reusable Prisma where-clause
 * fragment: admins see every post; everyone else sees company-wide posts
 * (departmentId: null) plus their own department's.
 *
 * Applied by every route that reaches a post by id — list, react, reactions,
 * comments and vote — so a post a user cannot see in their feed cannot be
 * commented on, voted in, reacted to, or have its reactor list pulled either.
 * That matters doubly now the feed emits notifications: the recipient list is
 * derived from these posts, and an unscoped route would leak a department-only
 * post's existence through a notification title.
 *
 * SUPER_ADMIN is included alongside HR_ADMIN. It was previously omitted, which
 * left super admins scoped like ordinary employees here while every other
 * permission check in the codebase treats the two together.
 */
export function postVisibilityWhere(user: { role: string; departmentId: string | null }): Prisma.SocialPostWhereInput {
  if (user.role === "HR_ADMIN" || user.role === "SUPER_ADMIN") return {};
  return { OR: [{ departmentId: null }, { departmentId: user.departmentId }] };
}
