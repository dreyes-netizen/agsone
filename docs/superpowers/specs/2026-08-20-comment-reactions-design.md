# Design: Reactions on Feed Comments

**Date:** 2026-08-20
**Status:** Approved, pending implementation plan

## Problem

Employees can react to a feed post with one of eight emojis (👍❤️👏🎉🔥😂💡💪), but cannot react to the comments (or replies) underneath a post. Multiple employees asked for the ability to react to comments on their posts.

## Goal

Let employees react to any top-level comment or reply in the feed with the same emoji set and toggle/swap semantics already used for posts, including a "who reacted" details view and a notification to the comment's author.

## Non-goals

- No new emoji set — reuse `REACTIONS` from `lib/constants/reactions.ts` unchanged.
- No changes to post-level reactions or their existing API/UI.
- No reaction analytics/reporting.

## Data model

A new `CommentReaction` model, mirroring `SocialReaction` (see `prisma/schema.prisma`) rather than making `SocialReaction` polymorphic. This keeps the unique constraint and every downstream query simple, and matches the existing pattern of dedicated join/detail models (`ShoutoutRecipient`, `PollVote`) instead of a shared polymorphic table.

```prisma
model CommentReaction {
  id        String   @id @default(uuid())
  commentId String
  userId    String
  emoji     String
  createdAt DateTime @default(now())

  comment SocialComment @relation(fields: [commentId], references: [id], onDelete: Cascade)
  user    User          @relation(fields: [userId], references: [id])

  @@unique([commentId, userId, emoji])
  @@index([createdAt])
}
```

`SocialComment` gets a `reactions CommentReaction[]` back-relation, and `User` gets a `commentReactions CommentReaction[]` back-relation, matching the existing `reactions`/`comments` relations already on `User` and `SocialPost`.

One user may have exactly one active emoji per comment at a time — reacting with a second emoji swaps the first, same as post reactions. Reacting with the same emoji again removes it.

## API

### `POST /api/feed/[id]/comments/[commentId]/react`

Same toggle/swap logic as `app/api/feed/[id]/react/route.ts`, adapted for comments:

1. `verifyAuth`.
2. Validate `{ emoji: z.enum(REACTION_EMOJIS) }`.
3. Look up the comment, joined to its post, filtered through `postVisibilityWhere(user)` on the post — a user who cannot see a post cannot react to its comments, matching every other comment/post route's visibility scoping. 404 if not found or not visible.
4. Find any existing `CommentReaction` from this user on this comment (any emoji).
   - Same emoji → delete (toggle off).
   - Different emoji → update to the new emoji (swap).
   - None → create. Race on the unique constraint (`P2002`) is a benign no-op, same as the post route.
5. On a genuine first-time add (not toggle-off, not swap), if the comment's author isn't the reacting user, fire a `REACTION_ON_COMMENT` notification (see below).
6. `scheduleBroadcast([{ topic: realtimeTopics.feed }])`.

Response shape matches the post route: `{ action: "added" | "removed" | "changed", emoji, previous? }`.

### `GET /api/feed/[id]/comments/[commentId]/reactions`

Identical shape to `app/api/feed/[id]/reactions/route.ts` (per-emoji `counts`, `total`, cursor-paginated `reactors` with `isCurrentUser` flags), scoped to `commentId` instead of `postId`, with the same post-visibility check as the POST route above.

### Existing comment routes — embed reaction data

- `GET /api/feed/[id]/comments` and the `POST` (create) response in `app/api/feed/[id]/comments/route.ts` both add `reactions: Record<string, number>` and `myReactions: string[]` to every top-level comment and every reply.
- Computed the same way `GET /api/feed` already does it for posts: after fetching the page of comments/replies, collect every comment+reply id in the page, then run one `groupBy(by: ["commentId", "emoji"])` for counts and one `findMany` scoped to `userId: user.id` for "my reactions" — not N+1 queries per comment.
- A freshly created comment/reply always returns `reactions: {}`, `myReactions: []`.

## Notifications

New entry in `lib/constants/notificationTypes.ts`:

```ts
REACTION_ON_COMMENT: {
  label: "Reactions to your comments",
  description: "When someone reacts to a comment you wrote",
  group: "Social",
  audience: "everyone",
  href: feedPost,
  toggleable: true,
  defaults: { inApp: true, push: false }, // matches REACTION (post reactions)
  groupKey: (d) => (str(d, "commentId") ? `reaction-comment:${str(d, "commentId")}` : null),
},
```

Fired with `data: { postId, commentId }` (same shape as `REPLY_TO_COMMENT`) so the bell's existing `feedPost` deep link works unchanged.

## Client types (`lib/types/feed.ts`)

`CommentItem` and `ReplyItem` both gain:

```ts
reactions: Record<string, number>;
myReactions: string[];
```

## Client state (`lib/hooks/useFeedActions.ts`)

New handler:

```ts
async function toggleCommentReaction(postId: string, commentId: string, emoji: string, parentId?: string)
```

- Optimistic update into `commentsCache`, following the exact pattern of the existing `toggleReaction` (compute old/new reaction maps, flip `myReactions` to `[]` or `[emoji]`), but locating the target comment either directly by id (top-level) or inside a parent's `replies` array when `parentId` is given.
- On failure, roll back to the previous `commentsCache` snapshot (same pattern used elsewhere in this hook, e.g. `confirmDeleteComment`).
- Returned from the hook alongside the existing `toggleReaction`.

## UI

### `ReactionBar` — compact variant

`ReactionBar` gains a `variant: "post" | "compact"` prop (default `"post"`, preserving all current post-footer behavior unchanged). The hover-picker mechanics (open/close timers, keyboard handling, floating emoji panel, positioning) are shared as-is; only the trigger element's markup changes:

- `"post"` (existing): the current full-width `flex-1` button with icon + label.
- `"compact"` (new): a small text-only trigger styled like the existing `Reply`/`Delete` links in `CommentThread.tsx` (`text-[11px] font-semibold text-gray-500 hover:text-navy-600`), showing the emoji itself when the user has reacted, or a neutral "React" label otherwise.

### Comment/reply action row

In `components/feed/CommentThread.tsx`, both the top-level comment row and the reply row's action line (`timeAgo · Reply · Delete · View replies`) gain:

1. A compact `ReactionBar` trigger (`variant="compact"`) positioned right after the timestamp.
2. When the comment/reply has at least one reaction, a small clickable summary immediately after the trigger — e.g. `👍❤️ 3` — built from `getReactionSummary(item.reactions)` (reused unchanged from `lib/helpers/reactionSummary.ts`). Clicking it opens the reactor-details modal.

### `ReactionDetailsDialog` / `useReactionDetails` — generalized target

Both currently hardcode a `postId` prop and build the URL as `` `/api/feed/${postId}/reactions` ``. Generalized to take an explicit target instead:

```ts
type ReactionTarget = { key: string; url: string } | null;
```

- `key` is whatever uniquely identifies the open target (post id, or `` `${postId}:${commentId}` `` for a comment) — used exactly like `postId` is today to detect "the open target changed" and reset cached tabs.
- `url` is the full reactions endpoint to fetch (`` `/api/feed/${postId}/reactions` `` for a post, `` `/api/feed/${postId}/comments/${commentId}/reactions` `` for a comment).

The feed page passes a post-shaped target when opening from `PostEngagement`, and a comment-shaped target when opening from a comment/reply's new reaction summary. No other behavior of the dialog changes (filter tabs, pagination, current-user-sync-while-open all stay as-is).

## Migration

One `prisma migrate dev` migration adding the `CommentReaction` table plus its two back-relations. No changes to any existing table.

## Testing

- No new pure-logic helpers are introduced — comment reactions reuse `getReactionSummary` unchanged, so no new Vitest specs are needed beyond the existing `lib/helpers/reactionSummary.test.ts` coverage.
- Manual verification via `npm run dev`: react/un-react/swap on a top-level comment and a reply, confirm the summary line and details modal, confirm the comment author gets a `REACTION_ON_COMMENT` notification (and does not when reacting to your own comment), confirm `npm run lint` passes.
