import { prisma } from "@/lib/prisma/client";
import { extractMentionIds } from "@/lib/helpers/mentionTokens";

/**
 * Mentions are stored inline in `SocialPost.content` as `@[Display Name|uuid]`.
 * The composer writes that token client-side (see lib/hooks/useFeedActions.ts)
 * and PostMentionText renders it back into a profile link.
 *
 * The server has never looked at it. `POST /api/feed` accepts content as an
 * opaque string, which means the uuid inside the token is entirely
 * attacker-controlled — a crafted request can embed any user's id, or an id
 * that belongs to nobody. Now that a mention generates a notification, that
 * matters: an unvalidated id would let anyone notify anyone, and would leak the
 * existence of a department-only post to someone who cannot see it.
 *
 * So every id is: extracted, deduped, confirmed to be a real active user, and
 * confirmed to be someone who can actually see the post being mentioned in.
 */

// extractMentionIds and stripMentionTokens live in mentionTokens.ts (no
// server imports) so client components can use them too; re-exported here
// so existing callers of this module don't need to change their import.
export { extractMentionIds, stripMentionTokens } from "@/lib/helpers/mentionTokens";

type ResolveArgs = {
  content: string | null | undefined;
  /** The post the mention appears in — null departmentId means company-wide. */
  postDepartmentId: string | null;
  /** Never notify the author of their own mention. */
  authorId: string;
};

/**
 * Resolve a post body's mention tokens to the users who should actually be
 * notified. Returns [] rather than throwing — a mention failing to resolve must
 * never block the post itself.
 */
export async function resolveMentionRecipients({
  content,
  postDepartmentId,
  authorId,
}: ResolveArgs): Promise<{ id: string; displayName: string }[]> {
  const ids = extractMentionIds(content);
  if (ids.length === 0) return [];

  // Cap the fan-out. A post is 1000 chars, so ~25 tokens is the practical
  // ceiling anyway; this stops a crafted body turning one request into a
  // hundred notification writes.
  const capped = ids.slice(0, 25);

  try {
    const users = await prisma.user.findMany({
      where: {
        id: { in: capped, not: authorId },
        isActive: true,
      },
      select: { id: true, displayName: true, departmentId: true, role: true },
    });

    return users
      .filter((u) => {
        // Mirror postVisibilityWhere from the recipient's side: a dept-only
        // post may only be announced to that department (admins excepted).
        if (postDepartmentId === null) return true;
        if (u.role === "HR_ADMIN" || u.role === "SUPER_ADMIN") return true;
        return u.departmentId === postDepartmentId;
      })
      .map((u) => ({ id: u.id, displayName: u.displayName }));
  } catch (err) {
    console.error("[mentions] failed to resolve recipients", err);
    return [];
  }
}
