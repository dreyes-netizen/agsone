# Dashboard Feed Reactions & Comments

**Date:** 2026-06-04  
**Branch:** feature/employee-feedback  
**Status:** Approved

## Overview

Add inline reactions and comments to the "What's happening" feed widget on the Home dashboard (`/dashboard`). Currently the widget is read-only — users can see reaction counts but cannot react or comment without navigating to the full Feed page. This feature brings the interaction layer directly into the dashboard card.

## Design Decisions

| Question | Decision |
|---|---|
| Where do comments live? | Fully inline, expanded inside the dashboard card |
| Emoji picker style | Hover-to-reveal floating picker (identical to `/feed`) |
| Comment depth | Latest 2 comments by default; "View X earlier" reveals the full cached thread |
| Reply threading | Full threading supported (reply to a comment, expand/collapse replies) |
| Implementation approach | Self-contained `DashboardFeedCard` component; feed page untouched |

## File Changes

### New: `components/dashboard/DashboardFeedCard.tsx`

A client component that receives a `FeedPost` prop and owns all interaction state internally. It does not share state with the dashboard page — each card is fully independent.

**State:**
- `reactions: Record<string, number>` — initialized from props, updated optimistically
- `myReactions: string[]` — initialized from props
- `commentCount: number` — initialized from props, incremented/decremented on submit/delete
- `openComments: boolean` — toggles comment section visibility
- `commentsData: CommentItem[]` — fetched once on first open, cached for the lifetime of the card
- `showAll: boolean` — when false, only the last 2 comments are displayed; "View X earlier" sets it to true
- `commentDraft: string` — current text in the new comment input
- `commentSending: boolean`
- `replyingTo: { commentId: string; displayName: string } | null`
- `replyDraft: Record<string, string>` — keyed by comment ID
- `replySending: Record<string, boolean>` — keyed by comment ID
- `expandedReplies: Record<string, boolean>` — keyed by comment ID

**Inlined sub-components:**
- `ReactionBar` — same hover-to-reveal floating emoji picker as the feed page. 350ms hover delay before picker opens. Clicking the main button toggles off the current reaction if one is active. Mouse-leave cancels the hover timer and closes the picker.
- `Avatar` — same initials/image fallback as the feed page

**Constants (inlined):**
- `EMOJIS` — same 6-emoji set as the feed page (`👍 ❤️ 🔥 👏 🎉 💪`)
- `EMOJI_BG` — same color map keyed by emoji

### Updated: `app/(dashboard)/dashboard/page.tsx`

Two changes only:

1. Add `myReactions: string[]` to the local `FeedPost` type (the field already exists in the API response but was missing from the type definition).
2. Replace the inline feed card render block (the `feedPosts.map(...)` inside the "What's happening" widget) with `<DashboardFeedCard post={post} key={post.id} />`.

No other changes to `dashboard/page.tsx`.

## Data Flow

### Reactions
1. Dashboard fetches `/api/feed?limit=5` — response already includes `reactions` and `myReactions` per post.
2. Card initializes local reaction state from those props.
3. User hovers the React button (350ms delay) → floating emoji picker appears above the button.
4. User clicks an emoji → optimistic state update → `POST /api/feed/{id}/react { emoji }`.
5. On API failure → silently revert to pre-click state. No toast, no error UI (matches feed page behavior).

### Comments
1. User clicks the "X comments" button → set `openComments = true`.
2. If `commentsData` is empty (first open) → `GET /api/feed/{id}/comments` → populate `commentsData`.
3. Display: the API returns comments oldest-first. If `commentsData.length > 2` and `showAll === false`, render only the last 2 items (index `length-2` and `length-1` — the most recently posted). Show "View X earlier comments" link above them where X = `commentsData.length - 2`.
4. Clicking "View X earlier" → set `showAll = true` → render all items from `commentsData` (no additional API call).
5. Submit comment → optimistic prepend to `commentsData` → `POST /api/feed/{id}/comments { content }` → replace optimistic item with server response on success, remove it and restore draft on failure.
6. Reply → same flow with `parentId` included in POST body.

### Replies
- Reply input appears below a comment when "Reply" is clicked (same toggle behavior as feed page).
- Replies are nested under their parent comment with a left-border indicator.
- "View N replies" / "Hide replies" toggle per comment.
- `showAll` affects top-level comments only; replies are always fully shown once their parent comment is visible.

## API Endpoints Used

All endpoints already exist — no backend changes required.

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/feed?limit=5` | Dashboard initial load (already called) |
| GET | `/api/feed/{id}/comments` | Load comments on first expand |
| POST | `/api/feed/{id}/react` | Toggle a reaction |
| POST | `/api/feed/{id}/comments` | Submit comment or reply |

## Error Handling

| Scenario | Behavior |
|---|---|
| Reaction API fails | Silently revert optimistic update |
| Comment fetch fails | Show small inline error message with "Try again" link |
| Comment submit fails | Remove optimistic comment, restore draft text to input |
| Reply submit fails | Remove optimistic reply, restore draft text to input |

## Card Navigation Behavior

The current dashboard card wraps the entire post in a `div` with `onClick={() => router.push('/feed')}`. This behavior is preserved in `DashboardFeedCard`: the outer card wrapper still navigates to `/feed` when the post body or metadata area is clicked.

All interactive elements inside the card (React button, emoji picker, Comments button, comment input, reply buttons, "View earlier" link) must call `e.stopPropagation()` to prevent the card-level navigation from firing. This is the same pattern already used in the current dashboard for the author and recipient `<Link>` elements.

## What Is Not In Scope

- Edit / delete comments from the dashboard card (available on `/feed` only)
- Pagination of comments beyond "View all" (all comments are loaded in a single fetch)
- Poll voting from the dashboard card (already not present, stays that way)
- Any changes to the full Feed page (`app/(dashboard)/feed/page.tsx`)
- Any changes to API routes
