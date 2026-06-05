# Feed — Layout & Photo Display Redesign

**Date:** 2026-06-05
**Status:** Approved design, ready for implementation plan
**Scope:** `app/(dashboard)/feed/page.tsx` (+ one or two new components)

## Problem

The Feed page has two issues on the screens it's actually used on (mobile **and** desktop):

1. **Dead space.** The feed is a single `max-w-4xl` column centered in a much wider content area. On desktop monitors this leaves large empty margins on both the left and right.
2. **Cropped photos.** Post images are force-cropped to fill a wide box (`object-cover`, `max-h-[480px]`) via a one-at-a-time `ImageCarousel`. Tall/portrait photos get their tops and bottoms chopped off and the original framing is lost.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Layout | **Feed + right sidebar** (two-column) | Only option that *removes* dead space rather than shrinking it; gives recurring actions a home. The classic social-feed pattern. |
| Sidebar contents | **Give Shoutout, Filters, Pinned announcements** | All built from data already on the page — no new API calls. (Top-recognizers leaderboard deferred to a follow-up; needs a new query.) |
| Photo display | **Smart layout** (natural single, mosaic grid for multiple, lightbox for full view) | Respects each photo's framing, scales 1→many gracefully, keeps full viewing in the lightbox. |

---

## Section 1 — Page layout

Restructure the feed page from one centered column into a **two-column grid that only activates on wide screens**.

- **Wrapper:** `max-w-4xl mx-auto` → `max-w-6xl mx-auto` (~1152px). On `lg+`, a CSS grid `grid-cols-[minmax(0,1fr)_300px]` with a gap — main feed left, 300px sidebar right. Below `lg`, single column.
- **Main column:** the feed cards fill the full left column (~800px after the sidebar and gap), with no extra inner cap. At ~800px, feed posts — which are short — stay comfortably readable, and there is no leftover dead space inside the column.
- **Compose box** (write a post) stays at the top of the main column — it is the primary action and does not move to the sidebar.

**Why two columns instead of just a wider column:** a single very-wide column trades dead space for unreadably long text lines. Splitting into an ~800px feed plus a 300px sidebar both removes the margins *and* keeps line length sane.

---

## Section 2 — The sidebar

A new `FeedSidebar` component (extracted from the current page) holding three stacked cards:

1. **Give Shoutout** — the existing "Recognize a colleague" card, moved out of the main flow. Same expand/collapse form and submit logic (`handleShoutoutSubmit`, recipient search, etc.).
2. **Filters** — the All / Updates / Shoutouts tabs rendered as a compact **vertical list**. Driven by the same `activeFilter` state and `setActiveFilter` handler that exist today.
3. **Pinned announcements** — a small card listing pinned posts (title + author). Built from the already-loaded `posts` array filtered by `post.isPinned`; clicking an entry scrolls to / focuses that post in the feed. No new API call. If there are zero pinned posts, the card is hidden.

**Responsive behavior:**
- `lg+`: sidebar sits on the right, `sticky top-8`, staying in view while the feed scrolls.
- below `lg`: grid collapses to one column; the three cards render **inline above the feed**, where this content lives today. Mobile loses nothing — it just stacks.

State note: filter state, shoutout state, and the `posts`/`employees` data stay owned by `FeedPage` and are passed to `FeedSidebar` as props (and the same props feed the inline mobile rendering), so there is a single source of truth.

---

## Section 3 — Photo display

Replace the single-image `ImageCarousel` with a smart **`PostImages`** component:

- **1 photo:** natural aspect ratio, height-capped (~`max-h-[480px]`), no forced crop — fixes chopped portraits.
- **2 photos:** side-by-side equal halves.
- **3 photos:** one large tile left, two stacked tiles right.
- **4+ photos:** 2×2 grid; when more than 4 exist, the 4th tile shows a `+N` overlay for the remainder.
- **Any photo** opens the existing **lightbox**. The lightbox gains **prev/next navigation** so all photos in the post can be paged through full-size — preserving the one good part of the old carousel, moved to the fullscreen view.
- **Composer preview** (the pre-post image grid) gets the same layout treatment so the draft matches the published post.

Grid tiles use `object-cover` (uniform tiling is expected for multi-photo mosaics); the **single-photo** case is the one that must not crop.

---

## Components touched / added

- `app/(dashboard)/feed/page.tsx` — restructure wrapper into the two-column grid; wire sidebar + inline-mobile rendering; swap `ImageCarousel` usage for `PostImages`.
- **New** `FeedSidebar` — the three-card sidebar (also rendered inline on mobile).
- **New** `PostImages` — smart 1/2/3/4+ photo layout, opens lightbox.
- Lightbox — extend with prev/next across a post's `imageUrls`.

## Out of scope (follow-ups)

- Top-recognizers / shoutout-leaderboard sidebar card (needs a new query).
- Any backend / API changes — this is a presentation-only redesign.

## Success criteria

- On desktop, no large empty side margins; feed text stays readable.
- Portrait photos display without top/bottom cropping; multi-photo posts tile cleanly.
- On mobile, sidebar content stacks above the feed and nothing is lost.
- Existing behavior (posting, reactions, comments, voting, pinning, shoutouts, filters) unchanged.
