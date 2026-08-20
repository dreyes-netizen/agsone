import type { CommentItem, ReplyItem } from "@/lib/types/feed";

/**
 * Locates a comment or reply by id within a page of top-level comments (each
 * carrying its own replies) — the nested shape GET /api/feed/[id]/comments
 * returns. Used wherever a caller has just a comment/reply id and needs to
 * read its current state without first knowing whether it's top-level or a
 * reply.
 */
export function findCommentById(
  comments: CommentItem[],
  id: string,
): CommentItem | ReplyItem | undefined {
  for (const c of comments) {
    if (c.id === id) return c;
    const reply = c.replies.find((r) => r.id === id);
    if (reply) return reply;
  }
  return undefined;
}
