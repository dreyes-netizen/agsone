# Comment Reactions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let employees react to feed comments and replies with the same eight emojis used on posts, including a "who reacted" details modal and a notification to the comment's author.

**Architecture:** A new `CommentReaction` Prisma model (mirroring the existing `SocialReaction`) backs two new API routes (`react`, `reactions`) that duplicate the post-reaction routes' toggle/swap/notify logic scoped to a comment. The existing comments GET/POST route embeds per-comment reaction data the same way `GET /api/feed` already does for posts. On the client, `ReactionBar` and `useReactionDetails`/`ReactionDetailsDialog` are generalized (via a `variant` prop and a `{key,url}` target, respectively) so posts and comments share the same picker and details-modal code instead of forking it.

**Tech Stack:** Next.js 16 App Router, Prisma 7 (`@/lib/generated/prisma`), Zod, React 19, Vitest.

## Global Constraints

- TypeScript strict mode — every new file must type-check under the project's existing `tsconfig.json`.
- Every API route starts with `verifyAuth(req)` and returns 401 on failure, matching every existing route in `app/api/feed/`.
- A post/comment a user cannot see (per `postVisibilityWhere`, `lib/helpers/postVisibility.ts`) must not be reactable, nor should its reactor list be readable — apply the same visibility join used by every sibling comment/reaction route.
- New reaction routes mirror the exact response shape of their post-level siblings (`app/api/feed/[id]/react/route.ts`, `app/api/feed/[id]/reactions/route.ts`) rather than the general `{ data: ... }` success envelope — consistency with the twin endpoint takes priority here.
- Fire-and-forget side effects (notifications) use `void promise.catch(...)`, never `await`, matching every existing notification call site in this codebase.
- No new pure-logic helper gets added without a Vitest spec in the same task, per this project's existing convention (`lib/helpers/reactionSummary.test.ts`, `lib/helpers/postVisibility.test.ts`, etc.). Next.js API routes and React hooks are **not** unit-tested anywhere in this codebase today (zero test files exist for any route or hook) — this plan follows that established convention and verifies routes/UI manually via `npm run dev` instead of writing route/hook tests from scratch.
- Run `npm run lint` before the final commit of this plan.

---

## File Structure

| File | Responsibility |
|---|---|
| `prisma/schema.prisma` | Add `CommentReaction` model + back-relations on `User`/`SocialComment` |
| `app/api/feed/[id]/comments/[commentId]/react/route.ts` (new) | Toggle/swap/add a reaction on one comment; notifies the comment author |
| `app/api/feed/[id]/comments/[commentId]/reactions/route.ts` (new) | Per-emoji counts + paginated reactor list for one comment |
| `app/api/feed/[id]/comments/route.ts` (modify) | Embed `reactions`/`myReactions` on every comment/reply returned by GET and the create POST |
| `lib/constants/notificationTypes.ts` (modify) | Add `REACTION_ON_COMMENT` catalog entry |
| `lib/types/feed.ts` (modify) | Add `reactions`/`myReactions` fields to `CommentItem`/`ReplyItem` |
| `lib/helpers/commentTree.ts` (new) | `findCommentById` — locate a comment or reply by id in the nested cache shape |
| `lib/hooks/useFeedActions.ts` (modify) | Add `toggleCommentReaction` optimistic-update handler |
| `components/feed/ReactionBar.tsx` (modify) | Add a `variant: "post" \| "compact"` prop so comments can reuse the same picker |
| `lib/hooks/useReactionDetails.ts` (modify) | Generalize from a bare `postId` to a `{ key, url }` target |
| `components/feed/ReactionDetailsDialog.tsx` (modify) | Same generalization, at the prop level |
| `components/feed/PostEngagement.tsx` (modify) | Adapt to `ReactionBar`'s new `onReact(emoji)` signature |
| `components/feed/CommentThread.tsx` (modify) | Render the compact reaction trigger + summary on comments and replies |
| `components/feed/PostViewerSidebar.tsx` (modify) | Thread the two new comment-reaction callbacks to `CommentList` |
| `components/feed/MediaViewer.tsx` (modify) | Thread the two new comment-reaction callbacks to `PostViewerSidebar` |
| `app/(dashboard)/feed/page.tsx` (modify) | Own the reactions-dialog target state; wire the new callbacks everywhere `CommentThread`/`MediaViewer` render |

---

### Task 1: `CommentReaction` Prisma model + migration

**Files:**
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Produces: `prisma.commentReaction` delegate with fields `{ id, commentId, userId, emoji, createdAt }`, unique on `(commentId, userId, emoji)`. Every later task that touches the database uses this delegate.

- [ ] **Step 1: Add the back-relation on `User`**

In `prisma/schema.prisma`, find this block (around line 186-189):

```prisma
  posts                SocialPost[]
  shoutoutsReceived    ShoutoutRecipient[] @relation("ShoutoutsReceived")
  reactions            SocialReaction[]
  comments             SocialComment[]
```

Change it to:

```prisma
  posts                SocialPost[]
  shoutoutsReceived    ShoutoutRecipient[] @relation("ShoutoutsReceived")
  reactions            SocialReaction[]
  comments             SocialComment[]
  commentReactions     CommentReaction[]
```

- [ ] **Step 2: Add the back-relation on `SocialComment` and the new model**

Find the `SocialComment` model (around line 408-430):

```prisma
model SocialComment {
  id          String      @id @default(uuid())
  postId      String
  authorId    String
  parentId    String?
  content     String?
  commentType CommentType @default(TEXT)
  // Canonical external GIF identity only — media/preview URLs are never
  // persisted (GIPHY's API terms prohibit caching/storing its media URLs
  // server-side); renderers resolve current URLs live from the provider by id.
  gifProvider String?
  gifId       String?
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt

  post    SocialPost      @relation(fields: [postId], references: [id], onDelete: Cascade)
  author  User            @relation(fields: [authorId], references: [id])
  parent  SocialComment?  @relation("CommentReplies", fields: [parentId], references: [id], onDelete: Cascade)
  replies SocialComment[] @relation("CommentReplies")

  @@index([postId])
  @@index([createdAt])
}
```

Change the relations block to add `reactions`, and add the new `CommentReaction` model right after it:

```prisma
model SocialComment {
  id          String      @id @default(uuid())
  postId      String
  authorId    String
  parentId    String?
  content     String?
  commentType CommentType @default(TEXT)
  // Canonical external GIF identity only — media/preview URLs are never
  // persisted (GIPHY's API terms prohibit caching/storing its media URLs
  // server-side); renderers resolve current URLs live from the provider by id.
  gifProvider String?
  gifId       String?
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt

  post      SocialPost        @relation(fields: [postId], references: [id], onDelete: Cascade)
  author    User              @relation(fields: [authorId], references: [id])
  parent    SocialComment?    @relation("CommentReplies", fields: [parentId], references: [id], onDelete: Cascade)
  replies   SocialComment[]   @relation("CommentReplies")
  reactions CommentReaction[]

  @@index([postId])
  @@index([createdAt])
}

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

- [ ] **Step 3: Validate the schema**

Run: `npx prisma validate`
Expected: `The schema at prisma\schema.prisma is valid 🚀`

- [ ] **Step 4: Create and apply the migration**

Run: `npx prisma migrate dev --name add_comment_reactions`
Expected: a new folder under `prisma/migrations/` timestamped today, containing a `migration.sql` that creates the `CommentReaction` table plus its indexes/foreign keys, ending with `Your database is now in sync with your schema.` and `✔ Generated Prisma Client`.

- [ ] **Step 5: Confirm the client was regenerated**

Run: `grep -r "commentReaction" "lib/generated/prisma/client.d.ts" | head -3`
Expected: at least one match referencing `commentReaction` (the generated delegate name is the camelCased model name).

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat: add CommentReaction model for comment-level reactions"
```

---

### Task 2: `REACTION_ON_COMMENT` notification type + POST react route

**Files:**
- Modify: `lib/constants/notificationTypes.ts`
- Create: `app/api/feed/[id]/comments/[commentId]/react/route.ts`

**Interfaces:**
- Consumes: `prisma.commentReaction` (Task 1), `verifyAuth` (`lib/auth/verifyAuth.ts`), `postVisibilityWhere` (`lib/helpers/postVisibility.ts`), `createNotification` (`lib/helpers/createNotification.ts`), `REACTION_EMOJIS` (`lib/constants/reactions.ts`), `scheduleBroadcast`/`realtimeTopics` (`lib/realtime/`).
- Produces: `POST /api/feed/:id/comments/:commentId/react` returning `{ action: "added" | "removed" | "changed", emoji: string, previous?: string }`, 404 if the comment doesn't exist or its post isn't visible to the caller, 400 on an invalid emoji.

- [ ] **Step 1: Add the notification catalog entry**

In `lib/constants/notificationTypes.ts`, find the `REACTION` entry (around line 243-253):

```ts
  REACTION: {
    label: "Reactions to your post",
    description: "When someone reacts to something you posted",
    group: "Social",
    audience: "everyone",
    href: feedPost,
    toggleable: true,
    // Highest-volume event in the app. Grouped, and push off by default.
    defaults: { inApp: true, push: false },
    groupKey: (d) => (str(d, "postId") ? `reaction:${str(d, "postId")}` : null),
  },
```

Add a new entry directly after it (before `POLL_VOTE`):

```ts
  REACTION: {
    label: "Reactions to your post",
    description: "When someone reacts to something you posted",
    group: "Social",
    audience: "everyone",
    href: feedPost,
    toggleable: true,
    // Highest-volume event in the app. Grouped, and push off by default.
    defaults: { inApp: true, push: false },
    groupKey: (d) => (str(d, "postId") ? `reaction:${str(d, "postId")}` : null),
  },
  REACTION_ON_COMMENT: {
    label: "Reactions to your comments",
    description: "When someone reacts to a comment you wrote",
    group: "Social",
    audience: "everyone",
    href: feedPost,
    toggleable: true,
    defaults: { inApp: true, push: false },
    groupKey: (d) => (str(d, "commentId") ? `reaction-comment:${str(d, "commentId")}` : null),
  },
```

- [ ] **Step 2: Create the react route**

Create `app/api/feed/[id]/comments/[commentId]/react/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";
import { z } from "zod";
import { scheduleBroadcast } from "@/lib/realtime/broadcast";
import { realtimeTopics } from "@/lib/realtime/topics";
import { REACTION_EMOJIS } from "@/lib/constants/reactions";
import { postVisibilityWhere } from "@/lib/helpers/postVisibility";
import { createNotification } from "@/lib/helpers/createNotification";

const schema = z.object({ emoji: z.enum(REACTION_EMOJIS) });

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  const user = await verifyAuth(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, commentId } = await params;
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { emoji } = parsed.data;

  // Same department-visibility scoping as every other comment/post route: a
  // comment on a post the user cannot see must not be reactable either.
  const comment = await prisma.socialComment.findFirst({
    where: { id: commentId, postId: id, post: postVisibilityWhere(user) },
    select: { id: true, authorId: true },
  });
  if (!comment) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const existing = await prisma.commentReaction.findFirst({
    where: { commentId, userId: user.id },
  });

  if (existing) {
    if (existing.emoji === emoji) {
      await prisma.commentReaction.delete({ where: { id: existing.id } });
      scheduleBroadcast([{ topic: realtimeTopics.feed }]);
      return NextResponse.json({ action: "removed", emoji });
    } else {
      await prisma.commentReaction.update({
        where: { id: existing.id },
        data: { emoji },
      });
      scheduleBroadcast([{ topic: realtimeTopics.feed }]);
      return NextResponse.json({ action: "changed", emoji, previous: existing.emoji });
    }
  }

  try {
    await prisma.commentReaction.create({ data: { commentId, userId: user.id, emoji } });
  } catch (err) {
    // Two concurrent first-time reactions can both pass the findFirst check and
    // race to create, the second hitting the @@unique([commentId,userId,emoji])
    // constraint. That's a benign no-op (the reaction exists), not a 500 — same
    // reasoning as the post react route.
    if (err && typeof err === "object" && "code" in err && err.code === "P2002") {
      scheduleBroadcast([{ topic: realtimeTopics.feed }]);
      return NextResponse.json({ action: "added", emoji });
    }
    throw err;
  }

  // Only a first-time reaction notifies, and never for reacting to your own
  // comment — same reasoning as the post react route.
  if (comment.authorId !== user.id) {
    void createNotification({
      userId: comment.authorId,
      type: "REACTION_ON_COMMENT",
      title: `${user.displayName} reacted to your comment`,
      body: `Reacted ${emoji}`,
      data: { postId: id, commentId },
    }).catch((err) => console.error("comment reaction notification failed", err));
  }

  scheduleBroadcast([{ topic: realtimeTopics.feed }]);
  return NextResponse.json({ action: "added", emoji });
}
```

- [ ] **Step 3: Manual verification**

Run: `npm run dev`, sign in, open the feed, open your browser's network tab or a REST client, and POST to `/api/feed/<a-real-post-id>/comments/<a-real-comment-id>/react` with `{"emoji":"👍"}` and a valid `Authorization: Bearer <firebase-id-token>` header.
Expected: first call returns `{"action":"added","emoji":"👍"}`; calling again with the same emoji returns `{"action":"removed","emoji":"👍"}`; calling with a different emoji after re-adding returns `{"action":"changed","emoji":"❤️","previous":"👍"}`. A comment id from a post you cannot see (e.g. another department's dept-only post) returns 404.

- [ ] **Step 4: Commit**

```bash
git add lib/constants/notificationTypes.ts "app/api/feed/[id]/comments/[commentId]/react/route.ts"
git commit -m "feat: add POST /api/feed/:id/comments/:commentId/react"
```

---

### Task 3: GET comment reactions route

**Files:**
- Create: `app/api/feed/[id]/comments/[commentId]/reactions/route.ts`

**Interfaces:**
- Consumes: `prisma.commentReaction` (Task 1).
- Produces: `GET /api/feed/:id/comments/:commentId/reactions?emoji=&cursor=&limit=` returning `{ data: { counts: Record<string, number>, total: number, reactors: ReactorItem[] }, nextCursor: string | null }` — identical shape to `GET /api/feed/:id/reactions`.

- [ ] **Step 1: Create the route**

Create `app/api/feed/[id]/comments/[commentId]/reactions/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";
import { REACTION_EMOJIS } from "@/lib/constants/reactions";
import { postVisibilityWhere } from "@/lib/helpers/postVisibility";

const PAGE_SIZE = 30;
const MAX_PAGE_SIZE = 50;

const userSelect = {
  id: true,
  displayName: true,
  avatarUrl: true,
  department: { select: { name: true } },
};

/**
 * Who reacted to a comment, and with what — the comment-level twin of
 * GET /api/feed/[id]/reactions. Same shape, same pagination/filter
 * behavior, scoped to commentId instead of postId.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  const user = await verifyAuth(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, commentId } = await params;

  // Same department-visibility scoping as the react route: a user who can't
  // see the post can't pull its comment's reactor list either.
  const comment = await prisma.socialComment.findFirst({
    where: { id: commentId, postId: id, post: postVisibilityWhere(user) },
    select: { id: true },
  });
  if (!comment) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { searchParams } = new URL(req.url);
  const emojiParam = searchParams.get("emoji");
  const emojiFilter = REACTION_EMOJIS.includes(emojiParam as (typeof REACTION_EMOJIS)[number])
    ? emojiParam
    : null;
  const cursor = searchParams.get("cursor") ?? undefined;
  const parsedLimit = parseInt(searchParams.get("limit") ?? String(PAGE_SIZE), 10);
  const limit = Number.isFinite(parsedLimit)
    ? Math.min(Math.max(parsedLimit, 1), MAX_PAGE_SIZE)
    : PAGE_SIZE;

  const [countsRaw, reactions] = await Promise.all([
    prisma.commentReaction.groupBy({
      by: ["emoji"],
      where: { commentId },
      _count: true,
    }),
    prisma.commentReaction.findMany({
      where: { commentId, ...(emojiFilter ? { emoji: emojiFilter } : {}) },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: { user: { select: userSelect } },
    }),
  ]);

  const counts: Record<string, number> = {};
  let total = 0;
  for (const c of countsRaw) {
    counts[c.emoji] = c._count;
    total += c._count;
  }

  const hasMore = reactions.length > limit;
  const page = hasMore ? reactions.slice(0, limit) : reactions;
  const nextCursor = hasMore ? page[page.length - 1].id : null;

  const reactors = page.map((r) => ({
    id: r.id,
    emoji: r.emoji,
    createdAt: r.createdAt.toISOString(),
    isCurrentUser: r.userId === user.id,
    user: {
      id: r.user.id,
      displayName: r.user.displayName,
      avatarUrl: r.user.avatarUrl,
      department: r.user.department?.name ?? null,
    },
  }));

  return NextResponse.json({ data: { counts, total, reactors }, nextCursor });
}
```

- [ ] **Step 2: Manual verification**

Run: `npm run dev`, then (after reacting to a comment via Task 2's route) GET `/api/feed/<postId>/comments/<commentId>/reactions` with a valid auth header.
Expected: `{"data":{"counts":{"👍":1},"total":1,"reactors":[{"id":"...","emoji":"👍","createdAt":"...","isCurrentUser":true,"user":{"id":"...","displayName":"...","avatarUrl":null,"department":null}}]},"nextCursor":null}`.

- [ ] **Step 3: Commit**

```bash
git add "app/api/feed/[id]/comments/[commentId]/reactions/route.ts"
git commit -m "feat: add GET /api/feed/:id/comments/:commentId/reactions"
```

---

### Task 4: Embed reaction data in the comments route + client types

**Files:**
- Modify: `app/api/feed/[id]/comments/route.ts`
- Modify: `lib/types/feed.ts`

**Interfaces:**
- Produces: `GET /api/feed/:id/comments` and the create `POST` response both add `reactions: Record<string, number>` and `myReactions: string[]` to every top-level comment and every reply. `CommentItem`/`ReplyItem` (`lib/types/feed.ts`) gain matching fields, consumed by every later client task.

- [ ] **Step 1: Add the fields to the client types**

In `lib/types/feed.ts`, change `ReplyItem`:

```ts
export type ReplyItem = {
  id: string;
  content: string | null;
  commentType: CommentType;
  gifProvider: string | null;
  gifId: string | null;
  createdAt: string;
  parentId: string | null;
  authorId: string;
  author: { displayName: string; avatarUrl: string | null };
  reactions: Record<string, number>;
  myReactions: string[];
};
```

And `CommentItem`:

```ts
export type CommentItem = {
  id: string;
  content: string | null;
  commentType: CommentType;
  gifProvider: string | null;
  gifId: string | null;
  createdAt: string;
  authorId: string;
  author: { displayName: string; avatarUrl: string | null };
  reactions: Record<string, number>;
  myReactions: string[];
  replies: ReplyItem[];
};
```

- [ ] **Step 2: Compute and embed reaction data in GET**

In `app/api/feed/[id]/comments/route.ts`, find:

```ts
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? page[page.length - 1].id : null;
  const comments = page.reverse();

  const data = comments.map((c) => ({
    id: c.id,
    content: c.content,
    commentType: c.commentType,
    gifProvider: c.gifProvider,
    gifId: c.gifId,
    createdAt: c.createdAt.toISOString(),
    authorId: c.authorId,
    author: { displayName: c.author.displayName, avatarUrl: c.author.avatarUrl },
    replies: c.replies.map((r) => ({
      id: r.id,
      content: r.content,
      commentType: r.commentType,
      gifProvider: r.gifProvider,
      gifId: r.gifId,
      createdAt: r.createdAt.toISOString(),
      authorId: r.authorId,
      author: { displayName: r.author.displayName, avatarUrl: r.author.avatarUrl },
      parentId: r.parentId,
    })),
  }));

  return NextResponse.json({ data, nextCursor });
```

Replace it with:

```ts
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? page[page.length - 1].id : null;
  const comments = page.reverse();

  // Same pattern GET /api/feed uses for posts: one groupBy for per-emoji
  // counts and one targeted query for this user's own reactions, across
  // every comment AND reply id in the page — not N+1 queries per comment.
  const commentIds: string[] = [];
  for (const c of comments) {
    commentIds.push(c.id);
    for (const r of c.replies) commentIds.push(r.id);
  }

  const [reactionCounts, myReactions] = await Promise.all([
    prisma.commentReaction.groupBy({
      by: ["commentId", "emoji"],
      where: { commentId: { in: commentIds } },
      _count: true,
    }),
    prisma.commentReaction.findMany({
      where: { commentId: { in: commentIds }, userId: user.id },
      select: { commentId: true, emoji: true },
    }),
  ]);

  const reactionMap = new Map<string, Record<string, number>>();
  for (const r of reactionCounts) {
    const m = reactionMap.get(r.commentId) ?? {};
    m[r.emoji] = r._count;
    reactionMap.set(r.commentId, m);
  }
  const myReactionMap = new Map<string, string[]>();
  for (const r of myReactions) {
    const arr = myReactionMap.get(r.commentId) ?? [];
    arr.push(r.emoji);
    myReactionMap.set(r.commentId, arr);
  }

  const data = comments.map((c) => ({
    id: c.id,
    content: c.content,
    commentType: c.commentType,
    gifProvider: c.gifProvider,
    gifId: c.gifId,
    createdAt: c.createdAt.toISOString(),
    authorId: c.authorId,
    author: { displayName: c.author.displayName, avatarUrl: c.author.avatarUrl },
    reactions: reactionMap.get(c.id) ?? {},
    myReactions: myReactionMap.get(c.id) ?? [],
    replies: c.replies.map((r) => ({
      id: r.id,
      content: r.content,
      commentType: r.commentType,
      gifProvider: r.gifProvider,
      gifId: r.gifId,
      createdAt: r.createdAt.toISOString(),
      authorId: r.authorId,
      author: { displayName: r.author.displayName, avatarUrl: r.author.avatarUrl },
      parentId: r.parentId,
      reactions: reactionMap.get(r.id) ?? {},
      myReactions: myReactionMap.get(r.id) ?? [],
    })),
  }));

  return NextResponse.json({ data, nextCursor });
```

- [ ] **Step 3: Embed empty reaction data on a freshly created comment**

In the same file, find the `POST` handler's response (near the end of the file):

```ts
  return NextResponse.json({
    data: {
      id: comment.id,
      content: comment.content,
      commentType: comment.commentType,
      gifProvider: comment.gifProvider,
      gifId: comment.gifId,
      createdAt: comment.createdAt.toISOString(),
      authorId: comment.authorId,
      author: { displayName: comment.author.displayName, avatarUrl: comment.author.avatarUrl },
      parentId: comment.parentId ?? null,
      replies: [],
    },
  }, { status: 201 });
```

Replace it with:

```ts
  return NextResponse.json({
    data: {
      id: comment.id,
      content: comment.content,
      commentType: comment.commentType,
      gifProvider: comment.gifProvider,
      gifId: comment.gifId,
      createdAt: comment.createdAt.toISOString(),
      authorId: comment.authorId,
      author: { displayName: comment.author.displayName, avatarUrl: comment.author.avatarUrl },
      parentId: comment.parentId ?? null,
      reactions: {},
      myReactions: [],
      replies: [],
    },
  }, { status: 201 });
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors (the `useFeedActions.ts`/`CommentThread.tsx` consumers of `CommentItem`/`ReplyItem` are updated in later tasks — if this step surfaces errors in those files right now, that's expected and resolved by Tasks 6 and 9; there should be no errors in `app/api/feed/[id]/comments/route.ts` or `lib/types/feed.ts` themselves).

- [ ] **Step 5: Manual verification**

Run: `npm run dev`, open the feed, open a post's comments, and inspect the network response for `GET /api/feed/<id>/comments`.
Expected: every comment and reply object now has `"reactions":{}` and `"myReactions":[]` (or real data, if you already reacted via Task 2's route).

- [ ] **Step 6: Commit**

```bash
git add "app/api/feed/[id]/comments/route.ts" lib/types/feed.ts
git commit -m "feat: embed comment reaction data in GET/POST comments route"
```

---

### Task 5: `findCommentById` helper

**Files:**
- Create: `lib/helpers/commentTree.ts`
- Test: `lib/helpers/commentTree.test.ts`

**Interfaces:**
- Consumes: `CommentItem`, `ReplyItem` (`lib/types/feed.ts`, Task 4).
- Produces: `findCommentById(comments: CommentItem[], id: string): CommentItem | ReplyItem | undefined`, consumed by Task 10 (the feed page needs to look up a comment/reply's current `myReactions` without knowing ahead of time whether it's top-level or a reply).

- [ ] **Step 1: Write the failing test**

Create `lib/helpers/commentTree.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { findCommentById } from "./commentTree";
import type { CommentItem, ReplyItem } from "@/lib/types/feed";

function makeComment(overrides: Partial<CommentItem> = {}): CommentItem {
  return {
    id: "c1",
    content: "hello",
    commentType: "TEXT",
    gifProvider: null,
    gifId: null,
    createdAt: "2026-08-20T00:00:00.000Z",
    authorId: "u1",
    author: { displayName: "Alice", avatarUrl: null },
    reactions: {},
    myReactions: [],
    replies: [],
    ...overrides,
  };
}

function makeReply(overrides: Partial<ReplyItem> = {}): ReplyItem {
  return {
    id: "r1",
    content: "hi",
    commentType: "TEXT",
    gifProvider: null,
    gifId: null,
    createdAt: "2026-08-20T00:00:00.000Z",
    parentId: "c1",
    authorId: "u2",
    author: { displayName: "Bob", avatarUrl: null },
    reactions: {},
    myReactions: [],
    ...overrides,
  };
}

describe("findCommentById", () => {
  it("finds a top-level comment by id", () => {
    const comments = [makeComment({ id: "c1" }), makeComment({ id: "c2" })];
    expect(findCommentById(comments, "c2")?.id).toBe("c2");
  });

  it("finds a reply nested under a top-level comment", () => {
    const comments = [makeComment({ id: "c1", replies: [makeReply({ id: "r1" })] })];
    expect(findCommentById(comments, "r1")?.id).toBe("r1");
  });

  it("returns undefined when the id doesn't exist anywhere", () => {
    const comments = [makeComment({ id: "c1", replies: [makeReply({ id: "r1" })] })];
    expect(findCommentById(comments, "missing")).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/helpers/commentTree.test.ts`
Expected: FAIL — `Cannot find module './commentTree'` (the file doesn't exist yet).

- [ ] **Step 3: Write the implementation**

Create `lib/helpers/commentTree.ts`:

```ts
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run lib/helpers/commentTree.test.ts`
Expected: PASS — 3 tests passed.

- [ ] **Step 5: Commit**

```bash
git add lib/helpers/commentTree.ts lib/helpers/commentTree.test.ts
git commit -m "feat: add findCommentById helper for the comment/reply cache"
```

---

### Task 6: `toggleCommentReaction` in `useFeedActions`

**Files:**
- Modify: `lib/hooks/useFeedActions.ts`

**Interfaces:**
- Consumes: `apiFetch` (already in scope in this file), `commentsCache`/`setCommentsCache` (already in scope), `CommentItem`/`ReplyItem` (Task 4).
- Produces: `toggleCommentReaction(postId: string, commentId: string, emoji: string, parentId?: string): Promise<void>`, returned from the hook alongside `toggleReaction`. Consumed by Task 10 (wired as `onReactToComment` on `CommentThread`/`PostViewerSidebar`).

- [ ] **Step 1: Add the handler**

In `lib/hooks/useFeedActions.ts`, find the end of `toggleReaction` (it ends right before the `return {` block):

```ts
    try {
      await apiFetch(`/api/feed/${postId}/react`, { method: "POST", body: JSON.stringify({ emoji }) });
    } catch {
      setPosts(previousPosts);
    }
  }

  return {
```

Insert a new function between them:

```ts
    try {
      await apiFetch(`/api/feed/${postId}/react`, { method: "POST", body: JSON.stringify({ emoji }) });
    } catch {
      setPosts(previousPosts);
    }
  }

  async function toggleCommentReaction(postId: string, commentId: string, emoji: string, parentId?: string) {
    const previousCache = commentsCache;
    // Optimistic update — mirrors toggleReaction's post-level logic above,
    // applied to whichever comment or reply carries this id inside the
    // nested per-post cache. `parentId` disambiguates a reply from a
    // top-level comment sharing the lookup, same as onDeleteComment already
    // does elsewhere in this file.
    function patch<T extends { reactions: Record<string, number>; myReactions: string[] }>(item: T): T {
      const current = item.myReactions[0] ?? null;
      const newReactions = { ...item.reactions };
      if (current) {
        newReactions[current] = (newReactions[current] ?? 1) - 1;
        if (newReactions[current] <= 0) delete newReactions[current];
      }
      if (current === emoji) {
        return { ...item, reactions: newReactions, myReactions: [] };
      }
      newReactions[emoji] = (newReactions[emoji] ?? 0) + 1;
      return { ...item, reactions: newReactions, myReactions: [emoji] };
    }

    setCommentsCache((prev) => {
      const comments = prev[postId] ?? [];
      const updated = comments.map((c) => {
        if (!parentId && c.id === commentId) return patch(c);
        if (parentId && c.id === parentId) {
          return { ...c, replies: c.replies.map((r) => (r.id === commentId ? patch(r) : r)) };
        }
        return c;
      });
      return { ...prev, [postId]: updated };
    });

    try {
      await apiFetch(`/api/feed/${postId}/comments/${commentId}/react`, {
        method: "POST",
        body: JSON.stringify({ emoji }),
      });
    } catch {
      setCommentsCache(previousCache);
    }
  }

  return {
```

- [ ] **Step 2: Export it from the hook**

Find the end of the returned object (near `toggleReaction,` at the very end of the `return { ... }` block):

```ts
    autoResize,
    handleComposerChange,
    insertMention,
    toggleReaction,
  };
}
```

Change to:

```ts
    autoResize,
    handleComposerChange,
    insertMention,
    toggleReaction,
    toggleCommentReaction,
  };
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors in `lib/hooks/useFeedActions.ts`.

- [ ] **Step 4: Commit**

```bash
git add lib/hooks/useFeedActions.ts
git commit -m "feat: add toggleCommentReaction handler to useFeedActions"
```

---

### Task 7: `ReactionBar` compact variant

**Files:**
- Modify: `components/feed/ReactionBar.tsx`
- Modify: `components/feed/PostEngagement.tsx`

**Interfaces:**
- Produces: `ReactionBar({ myReactions: string[], onReact: (emoji: string) => void, variant?: "post" | "compact" })` — the `postId` prop is removed (it was only ever forwarded into `onReact`, never used for rendering; every caller already has the id in closure scope). Consumed by `PostEngagement` (this task) and `CommentThread` (Task 9).

- [ ] **Step 1: Rewrite `ReactionBar`**

Replace the full contents of `components/feed/ReactionBar.tsx`:

```tsx
"use client";

import React, { useRef, useState } from "react";
import { SmilePlus } from "lucide-react";
import { REACTIONS as EMOJIS } from "@/lib/constants/reactions";

/**
 * Just the interactive "React" trigger + its emoji picker — the reaction
 * count/summary line lives separately in PostEngagement so it can sit above
 * this button instead of squeezed beside it.
 *
 * `variant="post"` (default) renders the flat flex-1 segment used in the
 * post footer's two-up React/Comment row. `variant="compact"` renders a
 * small text trigger matching the Reply/Delete links in a comment's action
 * row, for the same picker reused on comments (see CommentThread).
 *
 * Takes no id — every caller already has the post/comment id in closure
 * scope for its own `onReact`, so round-tripping it through this component
 * would be pure ceremony.
 */
export function ReactionBar({
  myReactions,
  onReact,
  variant = "post",
}: {
  myReactions: string[];
  onReact: (emoji: string) => void;
  variant?: "post" | "compact";
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const myReaction = myReactions[0] ?? null;

  function openPicker() {
    hoverTimer.current = setTimeout(() => setPickerOpen(true), 350);
  }
  function closePicker() {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = null;
    setPickerOpen(false);
  }
  function handleMainClick() {
    if (myReaction) {
      onReact(myReaction); // toggle off
    } else {
      setPickerOpen((v) => !v);
    }
  }
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (myReaction) {
        onReact(myReaction);
      } else {
        setPickerOpen((v) => !v);
      }
    } else if (e.key === "Escape" && pickerOpen) {
      e.preventDefault();
      closePicker();
    }
  }

  return (
    <div
      className={variant === "compact" ? "relative inline-block" : "relative flex-1"}
      onMouseEnter={openPicker}
      onMouseLeave={closePicker}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      {/* Floating picker — pb-2 bridges the gap so mouse doesn't leave container */}
      {pickerOpen && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 z-20 pb-2 max-w-[92vw]">
          <div className="flex items-center gap-1 bg-white rounded-full shadow-xl border border-gray-100 px-3 py-2.5 overflow-x-auto" role="group" aria-label="Emoji reactions">
            {EMOJIS.map(({ emoji, label }) => (
              <button
                key={emoji}
                type="button"
                title={label}
                onClick={() => { onReact(emoji); closePicker(); }}
                className={`text-xl leading-none transition-all duration-150 hover:scale-[1.4] active:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-navy-400 focus-visible:ring-offset-1 ${
                  myReaction === emoji ? "scale-125" : ""
                }`}
                aria-label={label}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={handleMainClick}
        aria-haspopup="true"
        aria-expanded={pickerOpen}
        aria-label={myReaction ? `Remove ${EMOJIS.find(e => e.emoji === myReaction)?.label ?? "reaction"}` : "Add reaction"}
        className={
          variant === "compact"
            ? `text-[11px] font-semibold transition-colors ${myReaction ? "text-navy-600" : "text-gray-500 hover:text-navy-600"}`
            : `flex w-full items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition-colors ${
                myReaction ? "text-navy-600" : "text-gray-600 hover:bg-gray-50"
              }`
        }
      >
        {variant === "compact" ? (
          myReaction ?? "React"
        ) : (
          <>
            {myReaction ? (
              <span className="text-base leading-none">{myReaction}</span>
            ) : (
              <SmilePlus className="w-4 h-4" />
            )}
            <span>{myReaction ? EMOJIS.find((e) => e.emoji === myReaction)?.label ?? "Reacted" : "React"}</span>
          </>
        )}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Update `PostEngagement`'s call site**

In `components/feed/PostEngagement.tsx`, find:

```tsx
        <ReactionBar postId={postId} myReactions={myReactions} onReact={onReact} />
```

Change to:

```tsx
        <ReactionBar myReactions={myReactions} onReact={(emoji) => onReact(postId, emoji)} />
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Manual verification**

Run: `npm run dev`, open the feed, and confirm the post-level React button still opens its picker on hover, reacts, and toggles off exactly as before (this is a pure refactor of `ReactionBar` — no post-level behavior should change).

- [ ] **Step 5: Commit**

```bash
git add components/feed/ReactionBar.tsx components/feed/PostEngagement.tsx
git commit -m "refactor: add a compact ReactionBar variant for comment reactions"
```

---

### Task 8: Generalize `useReactionDetails` / `ReactionDetailsDialog`

**Files:**
- Modify: `lib/hooks/useReactionDetails.ts`
- Modify: `components/feed/ReactionDetailsDialog.tsx`

**Interfaces:**
- Produces: `ReactionTarget = { key: string; url: string } | null` (exported from `lib/hooks/useReactionDetails.ts`); `useReactionDetails(target: ReactionTarget)`; `ReactionDetailsDialog({ target: ReactionTarget, onClose, myEmoji, currentUser, onOpenProfile })`. Consumed by Task 10 (feed page passes a post-shaped or comment-shaped target).

- [ ] **Step 1: Rewrite `useReactionDetails`**

Replace the full contents of `lib/hooks/useReactionDetails.ts`:

```ts
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useApiClient } from "@/lib/hooks/useApiClient";
import type { ReactorItem } from "@/lib/types/feed";

export const ALL_TAB = "ALL";

/**
 * Identifies which reactions endpoint is open. `key` is whatever uniquely
 * identifies the target (a post id, or `postId:commentId` for a comment) —
 * used only to detect "the open target changed" so cached tabs reset. `url`
 * is the full reactions endpoint to fetch.
 */
export type ReactionTarget = { key: string; url: string } | null;

type TabCache = {
  items: ReactorItem[];
  nextCursor: string | null;
  loaded: boolean;
};

type CurrentUserMeta = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  department: string | null;
};

/**
 * Backs the reaction-details modal: fetches per-emoji counts + a
 * cursor-paginated reactor list from `target.url`, one page per active
 * filter tab (cached so switching tabs back and forth doesn't re-fetch).
 * Generalized over `target` rather than a bare post id so the same modal
 * backs both GET /api/feed/[id]/reactions (posts) and
 * GET /api/feed/[id]/comments/[commentId]/reactions (comments).
 *
 * `syncCurrentUserReaction` lets the caller keep an already-open modal in
 * sync when the user changes their reaction via the main ReactionBar button
 * (outside the modal) — it patches every cached tab in place instead of
 * re-fetching, matching the optimistic-UI pattern used elsewhere in the feed.
 */
export function useReactionDetails(target: ReactionTarget) {
  const { apiFetch } = useApiClient();

  // Resetting local state when the target changes is done during render
  // (React's documented pattern for "adjusting state when a prop changes")
  // rather than in an effect, so opening a different target's modal starts
  // clean without an extra render or a synchronous setState-in-effect.
  const [trackedKey, setTrackedKey] = useState(target?.key ?? null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [total, setTotal] = useState(0);
  const [activeTab, setActiveTab] = useState<string>(ALL_TAB);
  const [cache, setCache] = useState<Record<string, TabCache>>({});
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestSeq = useRef(0);

  if ((target?.key ?? null) !== trackedKey) {
    setTrackedKey(target?.key ?? null);
    setCache({});
    setActiveTab(ALL_TAB);
    setCounts({});
    setTotal(0);
    setError(null);
  }

  const fetchTab = useCallback(async (url: string, tab: string, cursor?: string, opts: { more?: boolean } = {}) => {
    const seq = ++requestSeq.current;
    if (opts.more) setLoadingMore(true); else setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (tab !== ALL_TAB) params.set("emoji", tab);
      if (cursor) params.set("cursor", cursor);
      const res = await apiFetch<{ data: { counts: Record<string, number>; total: number; reactors: ReactorItem[] }; nextCursor: string | null }>(
        `${url}?${params.toString()}`
      );
      if (seq !== requestSeq.current) return; // stale response (tab/target switched again mid-flight)
      setCounts(res.data.counts);
      setTotal(res.data.total);
      setCache((prev) => {
        const existing = opts.more ? prev[tab]?.items ?? [] : [];
        return { ...prev, [tab]: { items: [...existing, ...res.data.reactors], nextCursor: res.nextCursor, loaded: true } };
      });
    } catch (err) {
      if (seq === requestSeq.current) setError(err instanceof Error ? err.message : "Failed to load reactions");
    } finally {
      if (seq === requestSeq.current) { setLoading(false); setLoadingMore(false); }
    }
  }, [apiFetch]);

  // Fetch whenever the active tab isn't cached yet. Depends on target?.key
  // and target?.url (primitives), NOT `target` itself — the caller
  // reconstructs a fresh `{key,url}` object literal every render, and
  // depending on that object's identity would re-run this effect (and
  // re-fetch) on every unrelated re-render of the feed page.
  useEffect(() => {
    if (!target) return;
    if (cache[activeTab]?.loaded) return;
    let cancelled = false;
    Promise.resolve().then(() => { if (!cancelled) fetchTab(target.url, activeTab); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target?.key, target?.url, activeTab, fetchTab]);

  function selectTab(tab: string) {
    setActiveTab(tab);
  }

  function loadMore() {
    if (!target || loadingMore) return;
    const tab = cache[activeTab];
    if (!tab?.nextCursor) return;
    fetchTab(target.url, activeTab, tab.nextCursor, { more: true });
  }

  // Patch every already-loaded tab in place: drop the user's row from
  // wherever it was, add it back under the new emoji (if any). Tabs that
  // haven't been fetched yet don't need patching — they'll come back correct
  // on first fetch.
  function syncCurrentUserReaction(prevEmoji: string | null, nextEmoji: string | null, me: CurrentUserMeta) {
    setCache((prev) => {
      const next: Record<string, TabCache> = {};
      for (const [tab, tabCache] of Object.entries(prev)) {
        if (!tabCache.loaded) { next[tab] = tabCache; continue; }
        let items = tabCache.items.filter((r) => !r.isCurrentUser);
        const belongsHere = nextEmoji && (tab === ALL_TAB || tab === nextEmoji);
        if (belongsHere && nextEmoji) {
          items = [
            { id: `optimistic-${me.id}`, emoji: nextEmoji, createdAt: new Date().toISOString(), isCurrentUser: true, user: me },
            ...items,
          ];
        }
        next[tab] = { ...tabCache, items };
      }
      return next;
    });
    setCounts((prev) => {
      const next = { ...prev };
      if (prevEmoji) next[prevEmoji] = Math.max(0, (next[prevEmoji] ?? 1) - 1);
      if (nextEmoji) next[nextEmoji] = (next[nextEmoji] ?? 0) + 1;
      return next;
    });
    setTotal((prev) => prev + (nextEmoji ? 1 : 0) - (prevEmoji ? 1 : 0));
  }

  const activeItems = cache[activeTab]?.items ?? [];
  const hasMore = !!cache[activeTab]?.nextCursor;

  return {
    counts, total, activeTab, selectTab, items: activeItems,
    loading, loadingMore, hasMore, loadMore, error,
    syncCurrentUserReaction,
  };
}
```

- [ ] **Step 2: Rewrite `ReactionDetailsDialog`**

Replace the full contents of `components/feed/ReactionDetailsDialog.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Loader2, AlertCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ReactionFilterTabs } from "@/components/feed/ReactionFilterTabs";
import { ReactionUserRow } from "@/components/feed/ReactionUserRow";
import { useReactionDetails, ALL_TAB, type ReactionTarget } from "@/lib/hooks/useReactionDetails";

/**
 * The "who reacted, and how" popup opened by tapping a reaction summary line
 * — shared by posts and comments. `target` identifies which reactions
 * endpoint to hit (see useReactionDetails). Self-contained: owns its own
 * Dialog wiring and data fetching — the feed page only needs to pass which
 * target is open and forward the current user's live reaction so this stays
 * in sync if it changes from the ReactionBar button while the modal is open.
 */
export function ReactionDetailsDialog({
  target,
  onClose,
  myEmoji,
  currentUser,
  onOpenProfile,
}: {
  target: ReactionTarget;
  /** The current user's active reaction on this target, right now (or null). */
  myEmoji: string | null;
  onClose: () => void;
  currentUser: { id: string; displayName: string; avatarUrl: string | null; department: string | null } | null;
  onOpenProfile: (userId: string) => void;
}) {
  const { counts, total, activeTab, selectTab, items, loading, loadingMore, hasMore, loadMore, error, syncCurrentUserReaction } =
    useReactionDetails(target);

  // Keep an already-open modal in sync when the user changes their reaction
  // via the main ReactionBar button (outside the modal). Done during render
  // (React's "adjusting state when a prop changes" pattern) rather than in
  // an effect: when `target` itself changes we just re-baseline against the
  // newly-opened target without patching anything (its cache was just reset
  // by useReactionDetails); only a same-target reaction change triggers a
  // patch.
  const [trackedKey, setTrackedKey] = useState(target?.key ?? null);
  const [syncedEmoji, setSyncedEmoji] = useState(myEmoji);
  if ((target?.key ?? null) !== trackedKey) {
    setTrackedKey(target?.key ?? null);
    setSyncedEmoji(myEmoji);
  } else if (target && currentUser && myEmoji !== syncedEmoji) {
    syncCurrentUserReaction(syncedEmoji, myEmoji, currentUser);
    setSyncedEmoji(myEmoji);
  }

  return (
    <Dialog open={target !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-md p-0 gap-0 max-h-[80vh] flex flex-col">
        <DialogHeader className="p-4 pb-3 border-b border-gray-100">
          <DialogTitle>Reactions</DialogTitle>
        </DialogHeader>

        <div className="px-4 pt-3">
          <ReactionFilterTabs counts={counts} total={total} active={activeTab} onSelect={selectTab} />
        </div>

        <div className="flex-1 overflow-y-auto px-3 pb-3 min-h-[120px]">
          {loading ? (
            <div className="flex items-center justify-center py-10 text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
              <span className="sr-only">Loading reactions…</span>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-gray-500">
              <AlertCircle className="w-5 h-5 text-gray-400" aria-hidden="true" />
              {error}
            </div>
          ) : items.length === 0 ? (
            <p className="py-10 text-center text-sm text-gray-500">
              {activeTab === ALL_TAB ? "No reactions yet." : "No one reacted this way."}
            </p>
          ) : (
            <>
              <div className="divide-y divide-gray-50">
                {items.map((reactor) => (
                  <ReactionUserRow key={reactor.id} reactor={reactor} onOpenProfile={onOpenProfile} />
                ))}
              </div>
              {hasMore && (
                <div className="flex justify-center pt-2">
                  <button
                    type="button"
                    onClick={loadMore}
                    disabled={loadingMore}
                    className="text-xs font-semibold text-navy-600 hover:underline disabled:opacity-50 py-2"
                  >
                    {loadingMore ? "Loading…" : "Load more"}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: errors only in `app/(dashboard)/feed/page.tsx` (its `ReactionDetailsDialog` call site still passes the old `postId` prop) — resolved in Task 10. No errors in the two files touched by this task.

- [ ] **Step 4: Commit**

```bash
git add lib/hooks/useReactionDetails.ts components/feed/ReactionDetailsDialog.tsx
git commit -m "refactor: generalize useReactionDetails/ReactionDetailsDialog to a {key,url} target"
```

---

### Task 9: `CommentThread` UI — reaction trigger + summary

**Files:**
- Modify: `components/feed/CommentThread.tsx`

**Interfaces:**
- Consumes: `ReactionBar` (Task 7), `getReactionSummary` (`lib/helpers/reactionSummary.ts`, unchanged).
- Produces: `CommentList`/`CommentThread` gain two new required props — `onReactToComment: (postId: string, commentId: string, emoji: string, parentId?: string) => void` and `onOpenCommentReactions: (postId: string, commentId: string) => void` — consumed by Task 10.

- [ ] **Step 1: Import the new dependencies and extend `ListProps`**

In `components/feed/CommentThread.tsx`, find the imports and the `ListProps` type:

```ts
import { Avatar } from "./Avatar";
import { MentionDropdown } from "./MentionDropdown";
import { PostMentionText } from "./PostMentionText";
import { useMentionInput, hasMentionTrigger, type MentionEmployee, type MentionInput } from "@/lib/hooks/useMentionInput";
import { GifButton } from "./GifButton";
import { GifPicker } from "./GifPicker";
import { GifCommentMedia } from "./GifCommentMedia";
import { timeAgo } from "@/lib/helpers/timeAgo";
import { useGifResolution, type GifMapEntry } from "@/lib/hooks/useGifResolution";
import type { GifResult } from "@/lib/giphy/client";
import type { CommentItem, ReplyItem } from "@/lib/types/feed";
```

Change to:

```ts
import { Avatar } from "./Avatar";
import { MentionDropdown } from "./MentionDropdown";
import { PostMentionText } from "./PostMentionText";
import { useMentionInput, hasMentionTrigger, type MentionEmployee, type MentionInput } from "@/lib/hooks/useMentionInput";
import { GifButton } from "./GifButton";
import { GifPicker } from "./GifPicker";
import { GifCommentMedia } from "./GifCommentMedia";
import { ReactionBar } from "./ReactionBar";
import { getReactionSummary } from "@/lib/helpers/reactionSummary";
import { timeAgo } from "@/lib/helpers/timeAgo";
import { useGifResolution, type GifMapEntry } from "@/lib/hooks/useGifResolution";
import type { GifResult } from "@/lib/giphy/client";
import type { CommentItem, ReplyItem } from "@/lib/types/feed";
```

Then find the `ListProps` type and add the two new callbacks (placed right after `onSubmitReply`):

```ts
  onSetReplyingTo: (value: ReplyTarget) => void;
  onReplyDraftChange: (commentId: string, value: string) => void;
  onSubmitReply: (postId: string, commentId: string, gif?: GifResult, encodedContent?: string) => void;
  /** Whether an older page of top-level comments exists behind a cursor. */
  hasMoreComments: boolean;
```

Change to:

```ts
  onSetReplyingTo: (value: ReplyTarget) => void;
  onReplyDraftChange: (commentId: string, value: string) => void;
  onSubmitReply: (postId: string, commentId: string, gif?: GifResult, encodedContent?: string) => void;
  /** React to a comment (parentId omitted) or a reply (parentId = its parent comment's id). */
  onReactToComment: (postId: string, commentId: string, emoji: string, parentId?: string) => void;
  /** Open the "who reacted" modal for a comment or reply. */
  onOpenCommentReactions: (postId: string, commentId: string) => void;
  /** Whether an older page of top-level comments exists behind a cursor. */
  hasMoreComments: boolean;
```

- [ ] **Step 2: Destructure the new props in `CommentList`**

Find the `CommentList` function signature:

```ts
export function CommentList({
  postId,
  comments,
  loading,
  replyingTo,
  replyDraft,
  replySending,
  expandedReplies,
  currentUserName,
  currentUserAvatar,
  dbUserId,
  isModerator,
  onSetReplyingTo,
  onReplyDraftChange,
  onSubmitReply,
  hasMoreComments,
```

Change to:

```ts
export function CommentList({
  postId,
  comments,
  loading,
  replyingTo,
  replyDraft,
  replySending,
  expandedReplies,
  currentUserName,
  currentUserAvatar,
  dbUserId,
  isModerator,
  onSetReplyingTo,
  onReplyDraftChange,
  onSubmitReply,
  onReactToComment,
  onOpenCommentReactions,
  hasMoreComments,
```

- [ ] **Step 3: Add the reaction trigger + summary to the top-level comment row**

Find the comment action row (inside `{!loading && comments.map((c) => (`):

```tsx
      {!loading && comments.map((c) => (
        <div key={c.id}>
          <div className="flex gap-2.5">
```

Change the arrow function to a block body so a local reaction summary can be computed once per comment, and add the reaction trigger + summary right after the timestamp span. The full mapped block becomes:

```tsx
      {!loading && comments.map((c) => {
        const { total: cTotal, topEmojis: cTopEmojis } = getReactionSummary(c.reactions);
        return (
        <div key={c.id}>
          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={() => goToProfile(c.authorId)}
              className="shrink-0 hover:opacity-80 transition-opacity"
              aria-label={`View ${c.author.displayName}'s profile`}
            >
              <Avatar name={c.author.displayName} url={c.author.avatarUrl} size="sm" />
            </button>
            <div className="flex-1 min-w-0">
              <div className="bg-gray-50 rounded-2xl px-3.5 py-2.5">
                <button
                  type="button"
                  onClick={() => goToProfile(c.authorId)}
                  className="text-xs font-semibold text-gray-900 hover:underline transition-colors"
                >
                  {c.author.displayName}
                </button>
                <CommentBody item={c} resolvedGif={c.gifId ? gifMap[c.gifId] : undefined} />
              </div>
              <div className="flex items-center gap-3 mt-1 pl-1">
                <span className="text-[11px] text-gray-500">{timeAgo(c.createdAt)}</span>
                <ReactionBar
                  myReactions={c.myReactions}
                  onReact={(emoji) => onReactToComment(postId, c.id, emoji)}
                  variant="compact"
                />
                {cTotal > 0 && (
                  <button
                    type="button"
                    onClick={() => onOpenCommentReactions(postId, c.id)}
                    className="text-[11px] text-gray-500 hover:underline"
                    aria-label={`${cTotal} ${cTotal === 1 ? "reaction" : "reactions"} — view who reacted`}
                  >
                    <span aria-hidden="true">{cTopEmojis.join("")}</span> {cTotal}
                  </button>
                )}
                <button
                  onClick={() =>
                    startReply(
                      replyingTo?.commentId === c.id
                        ? null
                        : { postId, commentId: c.id, displayName: c.author.displayName }
                    )
                  }
                  className="text-[11px] font-semibold text-gray-500 hover:text-navy-600 transition-colors"
                >
                  Reply
                </button>
                {(c.authorId === dbUserId || isModerator) && (
                  <button
                    onClick={() => onDeleteComment(postId, c.id)}
                    className="text-[11px] font-semibold text-gray-500 hover:text-red-500 transition-colors"
                  >
                    Delete
                  </button>
                )}
                {c.replies.length > 0 && (
                  <button
                    onClick={() => onToggleExpandedReplies(c.id)}
                    className="text-[11px] font-semibold text-navy-500 hover:text-navy-700 transition-colors"
                  >
                    {expandedReplies[c.id]
                      ? "Hide replies"
                      : `View ${c.replies.length} ${c.replies.length === 1 ? "reply" : "replies"}`}
                  </button>
                )}
              </div>
              {replyingTo?.commentId === c.id && (
                <div className="mt-2">
                  {replyGif && (
                    <AttachedGifPreview gif={replyGif} onRemove={() => setReplyGif(null)} />
                  )}
                  <div className="flex gap-2">
                    <Avatar name={currentUserName} url={currentUserAvatar} size="sm" />
                    <div className="flex-1 flex gap-2">
                      <div className="relative flex-1">
                        <MentionDropdown
                          mention={replyMention}
                          onSelect={(emp) => pickReplyMention(c.id, emp)}
                        />
                        <textarea
                          ref={replyRef}
                          autoFocus
                          rows={1}
                          placeholder={`Reply to ${c.author.displayName}…`}
                          value={replyDraft[c.id] ?? ""}
                          onChange={(e) => {
                            onReplyDraftChange(c.id, e.target.value);
                            const cur = e.target.selectionStart ?? e.target.value.length;
                            if (hasMentionTrigger(e.target.value, cur)) onNeedEmployees?.();
                            replyMention.detect(e.target.value, cur);
                            autoResize(e.target);
                          }}
                          onKeyDown={(e) => {
                            // The mention handler swallows Escape while its list
                            // is open, so dismissing the list doesn't also
                            // discard the reply draft.
                            handleMentionKeyDown(e, replyMention, (emp) => pickReplyMention(c.id, emp));
                            if (!e.defaultPrevented && e.key === "Escape") startReply(null);
                          }}
                          onBlur={replyMention.close}
                          className="w-full text-sm bg-white border border-gray-200 rounded-xl px-3 py-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-navy-500/30 focus:border-navy-400 placeholder:text-gray-500 transition-all resize-none overflow-hidden"
                        />
                      </div>
                      <GifButton onClick={() => setReplyPickerOpenFor(c.id)} />
                      <button
                        onClick={() => submitReply(c.id)}
                        disabled={replySending[c.id] || (!(replyDraft[c.id] ?? "").trim() && !replyGif)}
                        aria-label="Submit reply"
                        className="flex items-center justify-center w-8 h-8 bg-command-black text-white rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-50 shrink-0"
                      >
                        <Send className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <GifPicker
                    open={replyPickerOpenFor === c.id}
                    onClose={() => setReplyPickerOpenFor(null)}
                    onSelect={setReplyGif}
                  />
                </div>
              )}
              {expandedReplies[c.id] && c.replies.length > 0 && (
                <div className="mt-2 space-y-2 pl-2 border-l-2 border-gray-100">
                  {c.replies.map((r) => {
                    const { total: rTotal, topEmojis: rTopEmojis } = getReactionSummary(r.reactions);
                    return (
                    <div key={r.id} className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => goToProfile(r.authorId)}
                        className="shrink-0 hover:opacity-80 transition-opacity"
                        aria-label={`View ${r.author.displayName}'s profile`}
                      >
                        <Avatar name={r.author.displayName} url={r.author.avatarUrl} size="sm" />
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="bg-gray-50 rounded-2xl px-3.5 py-2.5">
                          <button
                            type="button"
                            onClick={() => goToProfile(r.authorId)}
                            className="text-xs font-semibold text-gray-900 hover:underline transition-colors"
                          >
                            {r.author.displayName}
                          </button>
                          <CommentBody item={r} resolvedGif={r.gifId ? gifMap[r.gifId] : undefined} />
                        </div>
                        <div className="flex items-center gap-3 mt-1 pl-1">
                          <span className="text-[11px] text-gray-500">{timeAgo(r.createdAt)}</span>
                          <ReactionBar
                            myReactions={r.myReactions}
                            onReact={(emoji) => onReactToComment(postId, r.id, emoji, c.id)}
                            variant="compact"
                          />
                          {rTotal > 0 && (
                            <button
                              type="button"
                              onClick={() => onOpenCommentReactions(postId, r.id)}
                              className="text-[11px] text-gray-500 hover:underline"
                              aria-label={`${rTotal} ${rTotal === 1 ? "reaction" : "reactions"} — view who reacted`}
                            >
                              <span aria-hidden="true">{rTopEmojis.join("")}</span> {rTotal}
                            </button>
                          )}
                          {(r.authorId === dbUserId || isModerator) && (
                            <button
                              onClick={() => onDeleteComment(postId, r.id, c.id)}
                              className="text-[11px] font-semibold text-gray-500 hover:text-red-500 transition-colors"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
        );
      })}
```

- [ ] **Step 4: Thread the two new props through the `CommentThread` wrapper**

Find the `CommentThread` function's destructured props:

```ts
export function CommentThread({
  postId,
  comments,
  loading,
  replyingTo,
  replyDraft,
  replySending,
  expandedReplies,
  commentDraft,
  commentSending,
  currentUserName,
  currentUserAvatar,
  dbUserId,
  isModerator,
  onSetReplyingTo,
  onReplyDraftChange,
  onSubmitReply,
  hasMoreComments,
```

Change to:

```ts
export function CommentThread({
  postId,
  comments,
  loading,
  replyingTo,
  replyDraft,
  replySending,
  expandedReplies,
  commentDraft,
  commentSending,
  currentUserName,
  currentUserAvatar,
  dbUserId,
  isModerator,
  onSetReplyingTo,
  onReplyDraftChange,
  onSubmitReply,
  onReactToComment,
  onOpenCommentReactions,
  hasMoreComments,
```

Then find where it renders `<CommentList ... />` and add the two props:

```tsx
      <CommentList
        postId={postId}
        comments={comments}
        loading={loading}
        replyingTo={replyingTo}
        replyDraft={replyDraft}
        replySending={replySending}
        expandedReplies={expandedReplies}
        currentUserName={currentUserName}
        currentUserAvatar={currentUserAvatar}
        dbUserId={dbUserId}
        isModerator={isModerator}
        onSetReplyingTo={onSetReplyingTo}
        onReplyDraftChange={onReplyDraftChange}
        onSubmitReply={onSubmitReply}
        hasMoreComments={hasMoreComments}
```

Change to:

```tsx
      <CommentList
        postId={postId}
        comments={comments}
        loading={loading}
        replyingTo={replyingTo}
        replyDraft={replyDraft}
        replySending={replySending}
        expandedReplies={expandedReplies}
        currentUserName={currentUserName}
        currentUserAvatar={currentUserAvatar}
        dbUserId={dbUserId}
        isModerator={isModerator}
        onSetReplyingTo={onSetReplyingTo}
        onReplyDraftChange={onReplyDraftChange}
        onSubmitReply={onSubmitReply}
        onReactToComment={onReactToComment}
        onOpenCommentReactions={onOpenCommentReactions}
        hasMoreComments={hasMoreComments}
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: errors only in `components/feed/PostViewerSidebar.tsx` and `app/(dashboard)/feed/page.tsx` (their `CommentList`/`CommentThread` call sites are missing the two new required props) — resolved in Task 10. No errors in `components/feed/CommentThread.tsx` itself.

- [ ] **Step 6: Commit**

```bash
git add components/feed/CommentThread.tsx
git commit -m "feat: render reaction trigger and summary on comments and replies"
```

---

### Task 10: Wire everything into the feed page

**Files:**
- Modify: `components/feed/PostViewerSidebar.tsx`
- Modify: `components/feed/MediaViewer.tsx`
- Modify: `app/(dashboard)/feed/page.tsx`

**Interfaces:**
- Consumes: `toggleCommentReaction` (Task 6), `findCommentById` (Task 5), `ReactionTarget` (Task 8), `onReactToComment`/`onOpenCommentReactions` (Task 9).

- [ ] **Step 1: Thread the two new props through `PostViewerSidebar`**

In `components/feed/PostViewerSidebar.tsx`, add to the destructured props (after `onDeleteComment`):

```ts
  onSubmitReply,
  onToggleExpandedReplies,
  onDeleteComment,
  onCommentDraftChange,
```

Change to:

```ts
  onSubmitReply,
  onToggleExpandedReplies,
  onDeleteComment,
  onReactToComment,
  onOpenCommentReactions,
  onCommentDraftChange,
```

Add matching entries to the props type (after `onDeleteComment: (postId: string, commentId: string, parentId?: string) => void;`):

```ts
  onDeleteComment: (postId: string, commentId: string, parentId?: string) => void;
```

Change to:

```ts
  onDeleteComment: (postId: string, commentId: string, parentId?: string) => void;
  onReactToComment: (postId: string, commentId: string, emoji: string, parentId?: string) => void;
  onOpenCommentReactions: (postId: string, commentId: string) => void;
```

Then find the `<CommentList ... />` call and add the two props:

```tsx
        <CommentList
          postId={post.id}
          comments={comments}
          loading={commentsLoading}
          hasMoreComments={hasMoreComments}
          loadingMoreComments={loadingMoreComments}
          onLoadMoreComments={onLoadMoreComments}
          replyingTo={replyingTo}
          replyDraft={replyDraft}
          replySending={replySending}
          expandedReplies={expandedReplies}
          currentUserName={currentUserName}
          currentUserAvatar={currentUserAvatar}
          dbUserId={dbUserId}
          isModerator={isModerator}
          onSetReplyingTo={onSetReplyingTo}
          onReplyDraftChange={onReplyDraftChange}
          onSubmitReply={onSubmitReply}
          onToggleExpandedReplies={onToggleExpandedReplies}
          onDeleteComment={onDeleteComment}
          autoResize={autoResize}
          employees={employees}
          onNeedEmployees={onNeedEmployees}
        />
```

Change to:

```tsx
        <CommentList
          postId={post.id}
          comments={comments}
          loading={commentsLoading}
          hasMoreComments={hasMoreComments}
          loadingMoreComments={loadingMoreComments}
          onLoadMoreComments={onLoadMoreComments}
          replyingTo={replyingTo}
          replyDraft={replyDraft}
          replySending={replySending}
          expandedReplies={expandedReplies}
          currentUserName={currentUserName}
          currentUserAvatar={currentUserAvatar}
          dbUserId={dbUserId}
          isModerator={isModerator}
          onSetReplyingTo={onSetReplyingTo}
          onReplyDraftChange={onReplyDraftChange}
          onSubmitReply={onSubmitReply}
          onReactToComment={onReactToComment}
          onOpenCommentReactions={onOpenCommentReactions}
          onToggleExpandedReplies={onToggleExpandedReplies}
          onDeleteComment={onDeleteComment}
          autoResize={autoResize}
          employees={employees}
          onNeedEmployees={onNeedEmployees}
        />
```

- [ ] **Step 2: Thread the two new props through `MediaViewer`**

In `components/feed/MediaViewer.tsx`, add to the destructured props (after `onDeleteComment`):

```ts
  onSubmitReply,
  onToggleExpandedReplies,
  onDeleteComment,
  onCommentDraftChange,
```

Change to:

```ts
  onSubmitReply,
  onToggleExpandedReplies,
  onDeleteComment,
  onReactToComment,
  onOpenCommentReactions,
  onCommentDraftChange,
```

Add matching entries to the props type (after `onDeleteComment: (postId: string, commentId: string, parentId?: string) => void;`):

```ts
  onDeleteComment: (postId: string, commentId: string, parentId?: string) => void;
```

Change to:

```ts
  onDeleteComment: (postId: string, commentId: string, parentId?: string) => void;
  onReactToComment: (postId: string, commentId: string, emoji: string, parentId?: string) => void;
  onOpenCommentReactions: (postId: string, commentId: string) => void;
```

Then find the `<PostViewerSidebar ... />` call and add the two props:

```tsx
              onSubmitReply={onSubmitReply}
              onToggleExpandedReplies={onToggleExpandedReplies}
              onDeleteComment={onDeleteComment}
              onCommentDraftChange={onCommentDraftChange}
```

Change to:

```tsx
              onSubmitReply={onSubmitReply}
              onReactToComment={onReactToComment}
              onOpenCommentReactions={onOpenCommentReactions}
              onToggleExpandedReplies={onToggleExpandedReplies}
              onDeleteComment={onDeleteComment}
              onCommentDraftChange={onCommentDraftChange}
```

- [ ] **Step 3: Wire the feed page — imports and destructured hook values**

In `app/(dashboard)/feed/page.tsx`, add an import for `findCommentById` near the top:

```ts
import { PollVotersDialog } from "@/components/feed/PollVotersDialog";
```

Change to:

```ts
import { PollVotersDialog } from "@/components/feed/PollVotersDialog";
import { findCommentById } from "@/lib/helpers/commentTree";
```

In the `useFeedActions()` destructure, add `toggleCommentReaction` next to `toggleReaction`:

```ts
    jumpToPost,
    autoResize,
    handleComposerChange,
    insertMention,
    toggleReaction,
  } = useFeedActions();
```

Change to:

```ts
    jumpToPost,
    autoResize,
    handleComposerChange,
    insertMention,
    toggleReaction,
    toggleCommentReaction,
  } = useFeedActions();
```

- [ ] **Step 4: Replace the reactions-modal state with a generalized target**

Find:

```ts
  // Which post's "who reacted" modal is open, if any. Kept local to the page
  // (not in useFeedActions) — it's transient UI state only relevant while the
  // dialog is mounted, unlike the reaction data itself which lives on `posts`.
  const [reactionsPostId, setReactionsPostId] = React.useState<string | null>(null);
  const reactionsPost = posts.find((p) => p.id === reactionsPostId) ?? null;
```

Change to:

```ts
  // Which post's or comment's "who reacted" modal is open, if any. Kept
  // local to the page (not in useFeedActions) — it's transient UI state only
  // relevant while the dialog is mounted, unlike the reaction data itself
  // which lives on `posts`/`commentsCache`.
  const [reactionsTarget, setReactionsTarget] = React.useState<
    { kind: "post"; postId: string } | { kind: "comment"; postId: string; commentId: string } | null
  >(null);

  const reactionsDialogTarget = !reactionsTarget
    ? null
    : reactionsTarget.kind === "post"
      ? { key: reactionsTarget.postId, url: `/api/feed/${reactionsTarget.postId}/reactions` }
      : {
          key: `${reactionsTarget.postId}:${reactionsTarget.commentId}`,
          url: `/api/feed/${reactionsTarget.postId}/comments/${reactionsTarget.commentId}/reactions`,
        };

  const reactionsMyEmoji = !reactionsTarget
    ? null
    : reactionsTarget.kind === "post"
      ? posts.find((p) => p.id === reactionsTarget.postId)?.myReactions[0] ?? null
      : findCommentById(commentsCache[reactionsTarget.postId] ?? [], reactionsTarget.commentId)?.myReactions[0] ?? null;
```

- [ ] **Step 5: Update the three `onOpenReactions` call sites to set the new target shape**

There are three occurrences of `onOpenReactions={() => setReactionsPostId(post.id)}` (two inline feed-card `PostEngagement` calls) and one `onOpenReactions={() => lightboxPost && setReactionsPostId(lightboxPost.id)}` (the `MediaViewer` call). Change each:

```tsx
                  onOpenReactions={() => setReactionsPostId(post.id)}
```

to:

```tsx
                  onOpenReactions={() => setReactionsTarget({ kind: "post", postId: post.id })}
```

(there are two of these — one inside the `SHOUTOUT` post block, one inside the regular post block; change both), and:

```tsx
        onOpenReactions={() => lightboxPost && setReactionsPostId(lightboxPost.id)}
```

to:

```tsx
        onOpenReactions={() => lightboxPost && setReactionsTarget({ kind: "post", postId: lightboxPost.id })}
```

- [ ] **Step 6: Add the two new callbacks to both inline `<CommentThread ... />` calls**

There are two `<CommentThread ... />` calls in the file (one in the `SHOUTOUT` post block, one in the regular post block) — both have this shape:

```tsx
                    onSubmitReply={submitReply}
                    hasMoreComments={!!commentsCursor[post.id]}
```

Change both occurrences to:

```tsx
                    onSubmitReply={submitReply}
                    onReactToComment={toggleCommentReaction}
                    onOpenCommentReactions={(postId, commentId) => setReactionsTarget({ kind: "comment", postId, commentId })}
                    hasMoreComments={!!commentsCursor[post.id]}
```

- [ ] **Step 7: Add the two new callbacks to the `<MediaViewer ... />` call**

Find:

```tsx
        onSubmitReply={submitReply}
        onToggleExpandedReplies={(commentId) => setExpandedReplies((prev) => ({ ...prev, [commentId]: !prev[commentId] }))}
        onDeleteComment={deleteComment}
        onCommentDraftChange={(pid, value) => setCommentDraft((prev) => ({ ...prev, [pid]: value }))}
        onSubmitComment={submitComment}
      />
```

Change to:

```tsx
        onSubmitReply={submitReply}
        onReactToComment={toggleCommentReaction}
        onOpenCommentReactions={(postId, commentId) => setReactionsTarget({ kind: "comment", postId, commentId })}
        onToggleExpandedReplies={(commentId) => setExpandedReplies((prev) => ({ ...prev, [commentId]: !prev[commentId] }))}
        onDeleteComment={deleteComment}
        onCommentDraftChange={(pid, value) => setCommentDraft((prev) => ({ ...prev, [pid]: value }))}
        onSubmitComment={submitComment}
      />
```

- [ ] **Step 8: Update the `ReactionDetailsDialog` call**

Find:

```tsx
      <ReactionDetailsDialog
        postId={reactionsPostId}
        onClose={() => setReactionsPostId(null)}
        myEmoji={reactionsPost?.myReactions[0] ?? null}
        currentUser={currentUserMeta}
        onOpenProfile={(id) => { setReactionsPostId(null); router.push(`/employees/${id}`); }}
      />
```

Change to:

```tsx
      <ReactionDetailsDialog
        target={reactionsDialogTarget}
        onClose={() => setReactionsTarget(null)}
        myEmoji={reactionsMyEmoji}
        currentUser={currentUserMeta}
        onOpenProfile={(id) => { setReactionsTarget(null); router.push(`/employees/${id}`); }}
      />
```

- [ ] **Step 9: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors anywhere in the project.

- [ ] **Step 10: Lint**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 11: Manual verification**

Run: `npm run dev`, sign in, open the feed, and walk through:
1. Open a post's comments, hover the new reaction trigger next to "Reply" on a top-level comment — the same 8-emoji picker used on posts should appear above it.
2. Pick an emoji — the trigger shows that emoji, and a summary (`👍 1`) appears next to it.
3. Click the summary — the "who reacted" modal opens showing you, with the filter tabs matching the post-level modal's look.
4. Pick a different emoji from the trigger — the summary updates (swap, not add).
5. Click the trigger again with the same emoji already active — the reaction and summary disappear (toggle off).
6. Repeat steps 1-5 on a reply (expand "View replies" first).
7. As a second user (or by checking the notification bell / DB `Notification` table as the comment's author), confirm reacting to someone else's comment creates a `REACTION_ON_COMMENT` notification, and reacting to your own comment does not.
8. Open the media viewer (click a post's image) and confirm the same reaction trigger/summary/modal work identically in the sidebar's comment list.
9. Refresh the page — reactions persist (confirms the GET route is returning embedded reaction data correctly).

- [ ] **Step 12: Commit**

```bash
git add components/feed/PostViewerSidebar.tsx components/feed/MediaViewer.tsx "app/(dashboard)/feed/page.tsx"
git commit -m "feat: wire comment reactions into the feed page, media viewer, and sidebar"
```

---

## Self-Review Notes

- **Spec coverage:** Data model (Task 1), react route (Task 2), reactions route (Task 3), embedded comment data (Task 4), notification (Task 2), client types (Task 4), `toggleCommentReaction` (Task 6), `ReactionBar` variant (Task 7), generalized details dialog (Task 8), comment/reply UI (Task 9), full wiring including `PostViewerSidebar`/`MediaViewer` (Task 10) — every spec section has a task.
- **Placeholder scan:** No TBDs; every step has complete, runnable code or an exact command with expected output.
- **Type consistency:** `onReactToComment(postId, commentId, emoji, parentId?)` and `onOpenCommentReactions(postId, commentId)` are named and typed identically everywhere they appear (Tasks 6, 9, 10). `ReactionTarget = { key: string; url: string } | null` is defined once (Task 8) and consumed as-is by the feed page (Task 10). `ReactionBar`'s `onReact(emoji: string)` signature (Task 7) matches every call site added in Tasks 7 and 9.
