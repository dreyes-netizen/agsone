# Poll Revamp

**Date:** 2026-08-17
**Status:** Approved

## Overview

Revamp the Poll post UI/UX in the AGS One feed to match the visual language of the already-revamped Feed/Reactions/Comments/Shoutout components, and close the biggest functional gap: users can vote but cannot see who voted. This adds voter visibility (with a per-option "who voted" list, mirroring the existing reaction-details modal) and anonymous poll support.

## Design Decisions

| Question | Decision |
|---|---|
| Multi-select voting? | No — stay single-select. Matches current behavior and the existing `@@unique([postId, userId])` constraint on `PollVote`. Documented as a possible future enhancement, not built now. |
| Who can create an anonymous poll? | Any employee who can create a poll today — no role restriction. |
| Does the poll author see voters on an anonymous poll? | No. Anonymous means anonymous to everyone, including the author. |
| New `Poll` entity? | No — add a single `isAnonymous` column to `SocialPost`, consistent with how poll-specific fields already live directly on `SocialPost`/`PollOption`/`PollVote` rather than a separate model. |
| "Who voted" UI pattern | Mirror the existing `ReactionDetailsDialog` / `useReactionDetails` / `/api/feed/[id]/reactions` stack almost exactly, swapping "emoji" for "poll option" throughout. |

## Data Model

One migration, one column:

```prisma
model SocialPost {
  ...
  isAnonymous Boolean @default(false)   // only meaningful when type == POLL
  ...
}
```

Existing polls backfill to `false` (no behavior change for current data). No changes to `PollOption` or `PollVote`.

## API Changes

| Route | Change |
|---|---|
| `POST /api/feed` | POLL branch of `postSchema` gains `isAnonymous: z.boolean().optional().default(false)`, persisted on `SocialPost.create`. |
| `GET /api/feed` | No code change — query uses `include` (no `select`), so the new scalar flows through automatically. `FeedPost` type (`lib/types/feed.ts`) gains `isAnonymous: boolean`. |
| `POST /api/feed/[id]/vote` | Unchanged. Upsert already supports vote-changing; single-vote-per-user already enforced by the unique constraint. |
| **New** `GET /api/feed/[id]/voters` | Modeled directly on `app/api/feed/[id]/reactions/route.ts`: same `verifyAuth` + `postVisibilityWhere` scoping, cursor pagination (`PAGE_SIZE=30`, `MAX_PAGE_SIZE=50`), optional `?option=<optionId>` filter (validated against the post's actual `pollOptions`, analogous to the emoji whitelist check). Returns per-option vote counts (via `pollVote.groupBy`) for tab labels, plus a paginated, most-recent-first voter list where each row includes which option that voter picked. **Guard:** if the post's `isAnonymous` is `true`, return `403` unconditionally (including for the post's own author) — defends the route even though the UI never exposes the affordance for anonymous polls. If the post isn't visible to the caller or isn't type `POLL`, same `404`/`400` handling as the vote route. |

**New type** in `lib/types/feed.ts`:

```ts
type VoterItem = {
  id: string;
  optionId: string;
  optionText: string;
  createdAt: string;
  isCurrentUser: boolean;
  user: { id: string; displayName: string; avatarUrl: string | null; department: string | null };
};
```

## New Components & Hook

All modeled directly on the existing reaction-details stack:

- **`lib/hooks/usePollVoters.ts`** — copy of `useReactionDetails` shape: cursor-paginated cache keyed by tab (`"ALL"` or an option id), loading/error state, `loadMore()`. Adds `syncCurrentUserVote(prevOptionId, nextOptionId, me)` — patches an already-open dialog in place when the user changes their vote from the row underneath it (same technique as `syncCurrentUserReaction`).
- **`components/feed/PollVoteFilterTabs.tsx`** — copy of `ReactionFilterTabs` shape: `All 12` tab plus one tab per poll option showing a truncated label + count (full text via `title` attribute for long labels).
- **`components/feed/PollVoterRow.tsx`** — copy of `ReactionUserRow` shape: avatar, name (links to `/employees/[id]`), department, and a small pill showing which option they picked (in place of the emoji glyph). Marks the current user inline (`(You)`), same as reactions.
- **`components/feed/PollVotersDialog.tsx`** — copy of `ReactionDetailsDialog` shape: owns the `Dialog` chrome + `usePollVoters`, renders loading/error/empty/"Load more" states identically.

### State & wiring

Mirrors the existing `reactionsPostId` pattern exactly:

- Feed page (`app/(dashboard)/feed/page.tsx`) gets `pollVotersQuery: { postId: string; optionId: string | null } | null` state, and renders one `<PollVotersDialog />` at the bottom of the tree (same spot as the existing `<ReactionDetailsDialog />`).
- An `onOpenVoters(postId, optionId | null)` callback threads `PollBlock → PostBody → PostViewerSidebar` / the feed page card, the same path `onOpenReactions` already takes through those same two components.
- Clicking a specific option's vote count opens the dialog pre-filtered to that option's tab; clicking the total-votes line opens it on "All".
- For anonymous polls, `onOpenVoters` is simply never wired to a clickable element — `PollBlock` renders those numbers as plain text.

### `PostBadges.tsx`

Extends the existing "Poll" chip: non-anonymous stays as today (`BarChart2` icon, "Poll"). Anonymous renders a distinct chip (`EyeOff` icon, "Anonymous Poll") so the state is obvious without reading into the options.

### Composer (`app/(dashboard)/feed/page.tsx`)

Adds one more piece of inline state alongside the existing `pollMode`/`pollOptions`: `pollAnonymous`/`setPollAnonymous`, surfaced as a toggle under the poll options list ("Make this poll anonymous — voter identities won't be shown to anyone, including you"), sent as `isAnonymous` in the `POST /api/feed` body. No structural refactor of that file — same inline-state pattern it already uses for poll fields. The anonymous flag is set at creation only and is not editable afterward (consistent with `flair`/`deptOnly`, which are likewise immutable after posting — post editing only touches `title`/`content`).

## `PollBlock` Visual Redesign

Replaces the current pill-shaped rows (heavy border, tinted fill) with a card-list treatment consistent with the rest of the revamped feed — soft borders, restrained color, `rounded-lg` rather than fully pill-rounded, matching `PostEngagement`/`PostBadges`'s more rectangular language.

- **Option row**: label on its own line (`line-clamp-2`, so long text wraps rather than being truncated to nothing useful), a thin `rounded-full` progress bar beneath it (`bg-gray-100` track, single restrained fill tone — no per-option rainbow), then a trailing `70% · 7 votes` line where **`7 votes` is its own nested button** (`stopPropagation`) opening `PollVotersDialog` filtered to that option. This separates the two tap targets cleanly: the row (label + bar) casts a vote; the count text is a distinct, smaller target for "who voted" — the same separation `PostEngagement` already uses between reacting and viewing reactors.
- **Selected state**: a subtle left accent bar + small inline checkmark reading "Your vote," replacing the current thick `border-navy-500` outline.
- **Footer**: total vote count as its own button (`12 votes` → opens the dialog on "All") when not anonymous; plain text when anonymous. Anonymous polls also show the "Anonymous Poll" badge from `PostBadges` above the question.
- **Vote changing**: unchanged behavior (clicking a different option upserts), but bar widths animate (`transition-all`) so switching reads as a smooth reflow.
- **Empty state**: 0 total votes renders all bars at 0% with a muted "No votes yet — be the first to vote" line instead of the count row.
- **Loading state**: existing `voting`-disabled behavior stays, restyled to match the new row treatment; no new loading UI needed since the vote response already returns fast enough via the existing optimistic-via-refetch pattern.
- **Many voters in the dialog**: handled by the existing cursor-pagination + "Load more" pattern inherited from `ReactionDetailsDialog` — no additional design needed.

## Out of Scope

- Multi-select voting.
- A distinct "Question" post type separate from "Poll" — kept one `POLL` type with the Anonymous/visible distinction rather than introducing a new `PostType`.
- Changing poll option count limits (stays 2–4 options).
- Role-restricting anonymous poll creation.
- Any change to how reactions/comments attach to poll posts (already generic via `PostEngagement`, untouched).
- Live-subscribing the open voters dialog to realtime updates — it loads fresh data on open, same as `ReactionDetailsDialog` does today; the existing feed-level `broadcast()` ping already keeps the aggregate bars fresh on the card behind it.
