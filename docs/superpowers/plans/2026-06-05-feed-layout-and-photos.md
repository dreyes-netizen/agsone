# Feed Layout & Photo Display Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the Feed page's left/right dead space by moving to a responsive two-column layout (feed + right sidebar), and fix cropped photos with a smart 1/2/3/4+ image layout.

**Architecture:** Restructure `app/(dashboard)/feed/page.tsx` into a CSS-grid two-column layout (feed left, sidebar right on `lg+`; stacked on mobile). Extract a `FeedSidebar` component holding the Filters, Give Shoutout, and Pinned Announcements cards (Give Shoutout owns its own form state; everything else is props). Replace the inline single-image `ImageCarousel` with a new `PostImages` mosaic component that opens the **existing** shared `components/ImageLightbox.tsx` (which already supports prev/next/keyboard/dots).

**Tech Stack:** Next.js 16, React 19, Tailwind CSS v4, lucide-react. **No test framework is installed** (scripts are only `lint` and `build`).

---

## Testing approach (read first — deviation from default TDD)

This repo has **no test runner** (no vitest/jest/playwright config, no test files; `package.json` scripts are only `dev`, `build`, `start`, `lint`). This change is presentation-only (layout + CSS + a pure layout helper). Introducing a test framework is out of scope and not requested.

Therefore each task is verified by:
1. **Typecheck:** `npx tsc --noEmit` → expect no errors.
2. **Lint:** `npm run lint` → expect no new errors/warnings on touched files.
3. **Visual check (final task):** run `npm run dev`, open `/feed`, and confirm behavior using the Playwright MCP browser tools (screenshots at desktop 1440px and mobile 390px widths).

The one piece of pure logic — choosing a grid layout from image count — is extracted into a small exported helper (`photoGridClass`) so it is independently readable and could be unit-tested later if a runner is added.

If, while implementing, you decide a test runner IS warranted, STOP and ask the user first — do not add one unilaterally.

---

## File Structure

**Create:**
- `components/feed/PostImages.tsx` — smart photo layout (1 natural, 2 side-by-side, 3 = big+stack, 4+ = 2×2 with `+N`). Pure presentational; calls `onOpen(index)`. Exports `photoGridClass(count)` helper.
- `components/feed/FeedSidebar.tsx` — the right-column sidebar: Filters list, Give Shoutout card (owns its own form state), Pinned Announcements card.

**Modify:**
- `app/(dashboard)/feed/page.tsx` — restructure into the two-column grid; remove the inline filter tabs JSX, the inline Give Shoutout card JSX, and the shoutout-related state (moves into `FeedSidebar`); delete the inline `ImageCarousel` component and inline lightbox; wire in `PostImages`, `FeedSidebar`, and the shared `ImageLightbox`; add jump-to-post anchors.

**Reuse (no change):**
- `components/ImageLightbox.tsx` — already supports `images: string[]`, `initialIndex`, `open`, `onClose`, prev/next, keyboard, dots.
- `lib/flairs`, `lib/helpers/timeAgo`, `lib/cloudinary/upload`, `lib/hooks/useApiClient` — unchanged.

---

## Task 1: `PostImages` component + `photoGridClass` helper

**Files:**
- Create: `components/feed/PostImages.tsx`

- [ ] **Step 1: Create the component file**

Create `components/feed/PostImages.tsx` with this exact content:

```tsx
"use client";

import { ZoomIn } from "lucide-react";

/**
 * Returns the Tailwind grid classes for the image container given how many
 * photos there are. Pure function so the layout decision is testable.
 *  1 -> single (natural aspect, height-capped, handled separately)
 *  2 -> two equal columns
 *  3 -> two columns (first tile spans both rows = "big + stack")
 *  4+ -> 2x2 grid
 */
export function photoGridClass(count: number): string {
  if (count === 2) return "grid grid-cols-2 gap-1";
  if (count === 3) return "grid grid-cols-2 grid-rows-2 gap-1";
  return "grid grid-cols-2 gap-1"; // 4+
}

export function PostImages({
  urls,
  onOpen,
}: {
  urls: string[];
  onOpen: (index: number) => void;
}) {
  if (urls.length === 0) return null;

  // ── Single image: natural aspect ratio, never cropped ──
  if (urls.length === 1) {
    return (
      <div className="mt-3 rounded-xl overflow-hidden bg-black/5">
        <button
          type="button"
          onClick={() => onOpen(0)}
          className="group/img relative block w-full focus:outline-none"
          aria-label="View image"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={urls[0]}
            alt="Post image"
            className="w-full max-h-[480px] object-contain"
            draggable={false}
          />
          <span className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover/img:bg-black/15 transition-colors">
            <span className="opacity-0 group-hover/img:opacity-100 transition-opacity bg-black/50 backdrop-blur-sm rounded-full p-2">
              <ZoomIn className="w-4 h-4 text-white" />
            </span>
          </span>
        </button>
      </div>
    );
  }

  // ── Multiple images: mosaic grid ──
  const shown = urls.slice(0, 4);
  const extra = urls.length - 4;

  return (
    <div className={`mt-3 rounded-xl overflow-hidden ${photoGridClass(urls.length)}`}>
      {shown.map((url, i) => {
        // For exactly 3 images, the first tile spans both rows on the left.
        const spanClass = urls.length === 3 && i === 0 ? "row-span-2" : "";
        const isLastWithExtra = i === 3 && extra > 0;
        return (
          <button
            key={url}
            type="button"
            onClick={() => onOpen(i)}
            className={`group/img relative block w-full focus:outline-none ${spanClass}`}
            aria-label={`View image ${i + 1}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt={`Post image ${i + 1}`}
              className={`w-full object-cover ${urls.length === 3 && i === 0 ? "h-full min-h-[160px]" : "h-40"}`}
              draggable={false}
            />
            {isLastWithExtra ? (
              <span className="absolute inset-0 flex items-center justify-center bg-black/55 text-white text-xl font-semibold">
                +{extra}
              </span>
            ) : (
              <span className="absolute inset-0 bg-black/0 group-hover/img:bg-black/15 transition-colors" />
            )}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. (The component isn't imported yet, but it must compile on its own.)

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: no errors/warnings for `components/feed/PostImages.tsx`.

- [ ] **Step 4: Commit**

```bash
git add components/feed/PostImages.tsx
git commit -m "feat: add PostImages smart photo layout component"
```

---

## Task 2: Use `PostImages` in the feed + swap inline lightbox for shared `ImageLightbox`

**Files:**
- Modify: `app/(dashboard)/feed/page.tsx`

- [ ] **Step 1: Update imports**

In `app/(dashboard)/feed/page.tsx`, find the top imports. Remove the now-unused `ZoomIn`, `ChevronLeft`, `ChevronRight` from the `lucide-react` import (they were only used by the inline carousel/lightbox). Then add the two new imports below the existing `import { FLAIRS, flairById } from "@/lib/flairs";` line:

```tsx
import { PostImages } from "@/components/feed/PostImages";
import { ImageLightbox } from "@/components/ImageLightbox";
```

The `lucide-react` import line should now read (keep every other icon exactly as-is, just drop the three):

```tsx
import { Send, ImagePlus, X, MessageCircle, SmilePlus, Trash2, Pencil, Check, PartyPopper, Megaphone, Trophy, BarChart2, Sparkles, Pin } from "lucide-react";
```

- [ ] **Step 2: Delete the inline `ImageCarousel` component**

Delete the entire `function ImageCarousel({ ... }) { ... }` definition (currently spanning the `ImageCarousel` declaration through its closing `}` — roughly lines 235–323). It is fully replaced by `PostImages`.

- [ ] **Step 3: Replace the lightbox state**

Find:

```tsx
const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
```

Replace with:

```tsx
const [lightbox, setLightbox] = useState<{ images: string[]; index: number } | null>(null);
```

- [ ] **Step 4: Remove the now-redundant Escape handler**

The shared `ImageLightbox` handles its own Escape/arrow keys. Delete this effect (it referenced `setLightboxUrl`):

```tsx
useEffect(() => {
  function onKey(e: KeyboardEvent) {
    if (e.key === "Escape") setLightboxUrl(null);
  }
  window.addEventListener("keydown", onKey);
  return () => window.removeEventListener("keydown", onKey);
}, []);
```

- [ ] **Step 5: Swap the carousel usage in the post body**

Find the UPDATE/POLL post render (around the old line 1544):

```tsx
{post.imageUrls?.length > 0 && (
  <ImageCarousel urls={post.imageUrls} onOpen={setLightboxUrl} />
)}
```

Replace with:

```tsx
{post.imageUrls?.length > 0 && (
  <PostImages
    urls={post.imageUrls}
    onOpen={(index) => setLightbox({ images: post.imageUrls, index })}
  />
)}
```

- [ ] **Step 6: Replace the inline lightbox JSX**

Find the inline lightbox block at the end of the component (the `{lightboxUrl && ( ... )}` `<div className="fixed inset-0 z-50 ...">` … through its closing `)}`, around old lines 1703–1724). Replace the entire block with:

```tsx
{/* ── Lightbox (shared component, supports prev/next + keyboard) ── */}
<ImageLightbox
  images={lightbox?.images ?? []}
  initialIndex={lightbox?.index ?? 0}
  open={lightbox !== null}
  onClose={() => setLightbox(null)}
/>
```

- [ ] **Step 7: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. (If it complains about an unused `X` import — `X` is still used elsewhere in the file for buttons, so it should remain. Only remove icons the typechecker flags as unused: `ZoomIn`, `ChevronLeft`, `ChevronRight`.)

- [ ] **Step 8: Lint**

Run: `npm run lint`
Expected: no errors/warnings for `app/(dashboard)/feed/page.tsx`.

- [ ] **Step 9: Commit**

```bash
git add "app/(dashboard)/feed/page.tsx"
git commit -m "feat: render feed photos with PostImages + shared lightbox"
```

---

## Task 3: Match the composer image preview to the mosaic layout

**Files:**
- Modify: `app/(dashboard)/feed/page.tsx`

The composer preview must visually match how the post will render. It stays editable (remove buttons), so it does NOT use `PostImages`; it reuses the same `photoGridClass` helper for consistency.

- [ ] **Step 1: Import the helper**

Update the PostImages import added in Task 2 to also pull in the helper:

```tsx
import { PostImages, photoGridClass } from "@/components/feed/PostImages";
```

- [ ] **Step 2: Replace the preview grid markup**

Find the composer preview block (around old lines 942–957):

```tsx
{/* Image previews */}
{imagePreviews.length > 0 && (
  <div className={`grid gap-2 ${imagePreviews.length === 1 ? "grid-cols-1" : imagePreviews.length === 2 ? "grid-cols-2" : "grid-cols-2"}`}>
    {imagePreviews.map((src, i) => (
      <div key={i} className="relative group">
        <img src={src} alt={`Preview ${i + 1}`} className="w-full h-32 rounded-xl object-cover border border-gray-200" />
        <button
          type="button"
          onClick={() => removeImage(i)}
          className="absolute top-1.5 right-1.5 w-6 h-6 bg-gray-900/70 text-white rounded-full flex items-center justify-center hover:bg-red-500 transition-colors"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    ))}
  </div>
)}
```

Replace with:

```tsx
{/* Image previews — mirrors PostImages layout */}
{imagePreviews.length > 0 && (
  <div className={imagePreviews.length === 1 ? "" : `rounded-xl overflow-hidden ${photoGridClass(imagePreviews.length)}`}>
    {imagePreviews.map((src, i) => {
      const spanClass = imagePreviews.length === 3 && i === 0 ? "row-span-2" : "";
      return (
        <div key={i} className={`relative group ${spanClass}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={`Preview ${i + 1}`}
            className={
              imagePreviews.length === 1
                ? "w-full max-h-[320px] object-contain rounded-xl border border-gray-200 bg-black/5"
                : `w-full object-cover ${imagePreviews.length === 3 && i === 0 ? "h-full min-h-[160px]" : "h-40"}`
            }
          />
          <button
            type="button"
            onClick={() => removeImage(i)}
            className="absolute top-1.5 right-1.5 w-6 h-6 bg-gray-900/70 text-white rounded-full flex items-center justify-center hover:bg-red-500 transition-colors z-10"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      );
    })}
  </div>
)}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Lint**

Run: `npm run lint`
Expected: no errors/warnings.

- [ ] **Step 5: Commit**

```bash
git add "app/(dashboard)/feed/page.tsx"
git commit -m "feat: match composer image preview to post mosaic layout"
```

---

## Task 4: Create the `FeedSidebar` component

**Files:**
- Create: `components/feed/FeedSidebar.tsx`

This component renders three cards. It owns the **Give Shoutout** form state internally (that state is used nowhere else in `FeedPage`). Filters and Pinned data come in as props.

- [ ] **Step 1: Create the component file**

Create `components/feed/FeedSidebar.tsx` with this exact content:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles, X, Pin } from "lucide-react";
import { useApiClient } from "@/lib/hooks/useApiClient";

type Employee = { id: string; displayName: string; avatarUrl: string | null };

type PinnedItem = { id: string; title: string | null; authorName: string };

const FILTERS = [
  { label: "All", value: "ALL" },
  { label: "Updates", value: "UPDATE" },
  { label: "Shoutouts", value: "SHOUTOUT" },
] as const;

export function FeedSidebar({
  activeFilter,
  onFilterChange,
  employees,
  onShoutoutCreated,
  pinned,
  onJumpToPost,
}: {
  activeFilter: string;
  onFilterChange: (value: string) => void;
  employees: Employee[];
  onShoutoutCreated: (post: unknown) => void;
  pinned: PinnedItem[];
  onJumpToPost: (id: string) => void;
}) {
  const { apiFetch } = useApiClient();

  // ── Give Shoutout form state (owned here) ──
  const [open, setOpen] = useState(false);
  const [recipientId, setRecipientId] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function resetForm() {
    setContent("");
    setRecipientId("");
    setRecipientName("");
    setSearch("");
    setSearchOpen(false);
  }

  async function submit() {
    if (!recipientId || !content.trim()) return;
    setSubmitting(true);
    try {
      const res = await apiFetch<{ data: unknown }>("/api/feed", {
        method: "POST",
        body: JSON.stringify({ type: "SHOUTOUT", content: content.trim(), recipientId }),
      });
      onShoutoutCreated(res.data);
      resetForm();
      setOpen(false);
    } catch {
      // silent — caller's list is unchanged on failure
    } finally {
      setSubmitting(false);
    }
  }

  const filteredEmployees = employees.filter((e) =>
    e.displayName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      {/* ── Filters ── */}
      <div className="bg-white rounded-xl border border-zinc-200 p-2">
        <p className="px-2 pt-1 pb-2 text-[11px] font-semibold text-zinc-400 uppercase tracking-wide">Filter</p>
        <div className="space-y-0.5">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => onFilterChange(f.value)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeFilter === f.value
                  ? "bg-zinc-900 text-white"
                  : "text-zinc-600 hover:bg-zinc-100"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Give Shoutout ── */}
      <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
        <div className="px-4 py-3 flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-zinc-700">Recognize a colleague</span>
          <button
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-colors shrink-0"
          >
            <Sparkles className="w-3.5 h-3.5" /> Shoutout
          </button>
        </div>

        {open && (
          <div className="px-4 pb-4 border-t border-zinc-100 pt-3 space-y-3">
            <div ref={searchRef} className="relative">
              {recipientId ? (
                <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  <span className="text-sm text-amber-800 font-medium flex-1 truncate">{recipientName}</span>
                  <button
                    type="button"
                    onClick={() => { setRecipientId(""); setRecipientName(""); setSearch(""); }}
                    className="text-amber-500 hover:text-amber-700 transition-colors shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <input
                  type="text"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setSearchOpen(true); }}
                  onFocus={() => setSearchOpen(true)}
                  placeholder="Search colleague…"
                  className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 text-zinc-800 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400 transition"
                />
              )}
              {searchOpen && !recipientId && (
                <div className="absolute z-10 mt-1 w-full bg-white border border-zinc-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {filteredEmployees.map((e) => (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => {
                        setRecipientId(e.id);
                        setRecipientName(e.displayName);
                        setSearch("");
                        setSearchOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 text-sm text-zinc-700 hover:bg-amber-50 hover:text-amber-800 transition-colors"
                    >
                      {e.displayName}
                    </button>
                  ))}
                  {filteredEmployees.length === 0 && (
                    <p className="px-3 py-2 text-sm text-zinc-400">No results</p>
                  )}
                </div>
              )}
            </div>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder="What did they do that deserves recognition?"
              className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 text-zinc-800 placeholder-zinc-400 resize-none focus:outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400 transition"
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-400">{content.length}/500</span>
              <div className="flex gap-2">
                <button
                  onClick={() => { setOpen(false); resetForm(); }}
                  className="text-sm text-zinc-500 hover:text-zinc-700 px-3 py-1.5 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={submit}
                  disabled={submitting || !recipientId || !content.trim()}
                  className="text-sm bg-amber-500 hover:bg-amber-600 text-white font-semibold px-4 py-1.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? "Sending…" : "Send"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Pinned announcements ── */}
      {pinned.length > 0 && (
        <div className="bg-white rounded-xl border border-zinc-200 p-3">
          <p className="flex items-center gap-1.5 px-1 pb-2 text-[11px] font-semibold text-amber-600 uppercase tracking-wide">
            <Pin className="w-3 h-3" /> Pinned
          </p>
          <div className="space-y-1">
            {pinned.map((p) => (
              <button
                key={p.id}
                onClick={() => onJumpToPost(p.id)}
                className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-amber-50 transition-colors"
              >
                <p className="text-sm font-medium text-zinc-800 truncate">{p.title ?? "Untitled post"}</p>
                <p className="text-xs text-zinc-400 truncate">{p.authorName}</p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. (Not imported yet; must compile standalone.)

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: no errors/warnings for `components/feed/FeedSidebar.tsx`.

- [ ] **Step 4: Commit**

```bash
git add components/feed/FeedSidebar.tsx
git commit -m "feat: add FeedSidebar (filters, give shoutout, pinned)"
```

---

## Task 5: Restructure the feed page into the two-column grid

**Files:**
- Modify: `app/(dashboard)/feed/page.tsx`

This wires in `FeedSidebar`, removes the inline filter tabs + inline Give Shoutout card + their state, and builds the responsive grid. The compose box stays at the top of the main (left) column.

- [ ] **Step 1: Add the FeedSidebar import**

Below the imports added earlier, add:

```tsx
import { FeedSidebar } from "@/components/feed/FeedSidebar";
```

- [ ] **Step 2: Remove the shoutout state that moved into FeedSidebar**

Delete these state declarations (they now live inside `FeedSidebar`):

```tsx
const shoutoutSearchRef = useRef<HTMLDivElement>(null);
const [showShoutoutForm, setShowShoutoutForm] = useState(false);
const [shoutoutRecipientId, setShoutoutRecipientId] = useState("");
const [shoutoutRecipientName, setShoutoutRecipientName] = useState("");
const [shoutoutSearch, setShoutoutSearch] = useState("");
const [shoutoutSearchOpen, setShoutoutSearchOpen] = useState(false);
const [shoutoutContent, setShoutoutContent] = useState("");
const [shoutoutSubmitting, setShoutoutSubmitting] = useState(false);
```

Keep `const [employees, setEmployees] = useState(...)` — it's passed to the sidebar.

- [ ] **Step 3: Remove the click-outside effect for the old shoutout search**

Delete:

```tsx
useEffect(() => {
  function handleClickOutside(e: MouseEvent) {
    if (shoutoutSearchRef.current && !shoutoutSearchRef.current.contains(e.target as Node)) {
      setShoutoutSearchOpen(false);
    }
  }
  document.addEventListener("mousedown", handleClickOutside);
  return () => document.removeEventListener("mousedown", handleClickOutside);
}, []);
```

- [ ] **Step 4: Delete the `handleShoutoutSubmit` function**

Delete the whole `async function handleShoutoutSubmit() { ... }` definition. Its logic now lives in `FeedSidebar.submit()`; the page only needs a small handler to prepend the created post (added in Step 6).

- [ ] **Step 5: Add jump-to-post helper + derive pinned list**

Just before the `return (` of the component, add:

```tsx
function jumpToPost(id: string) {
  const el = document.getElementById(`feed-post-${id}`);
  if (el) {
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    el.classList.add("ring-2", "ring-amber-300");
    setTimeout(() => el.classList.remove("ring-2", "ring-amber-300"), 1600);
  }
}

const pinnedItems = posts
  .filter((p) => p.isPinned)
  .map((p) => ({ id: p.id, title: p.title, authorName: p.author.displayName }));

function handleShoutoutCreated(post: unknown) {
  setPosts((prev) => [post as FeedPost, ...prev]);
}
```

- [ ] **Step 6: Replace the page wrapper + remove inline filter/shoutout blocks**

Find the outer wrapper opening:

```tsx
return (
  <div className="max-w-4xl mx-auto space-y-5">
    <div>
      <h1 className="text-2xl font-bold text-zinc-900">Activity Feed</h1>
      <p className="text-zinc-500 text-sm mt-1">What&apos;s happening across the company</p>
    </div>
```

Replace the opening wrapper line only:

```tsx
return (
  <div className="max-w-6xl mx-auto space-y-5">
    <div>
      <h1 className="text-2xl font-bold text-zinc-900">Activity Feed</h1>
      <p className="text-zinc-500 text-sm mt-1">What&apos;s happening across the company</p>
    </div>
```

Then **delete** these two inline blocks entirely (they move to the sidebar):

(a) The Filter tabs block — the comment `{/* Filter tabs */}` through the end of that `</div>` (the `flex gap-1 bg-zinc-100 rounded-xl p-1 w-fit` container and its mapped buttons).

(b) The Give Shoutout block — the comment `{/* Give Shoutout */}` through the end of its container `</div>` (the `bg-white rounded-xl border border-zinc-200 overflow-hidden` card containing `showShoutoutForm` markup).

- [ ] **Step 7: Wrap compose + posts + sidebar in the grid**

The remaining structure after the header is: the Compose `<form>` card, then the Posts block (`{loadError ? ... : loading ? ... : posts.length === 0 ? ... : posts.map(...)}`), then the lightbox.

Wrap the **Compose card** and the **Posts block** and a new **sidebar aside** in a grid. Concretely, immediately after the header `</div>` (the one closing the `<h1>`/`<p>` block), open the grid:

```tsx
{/* Two-column layout: compose+posts (left), sidebar (right). Stacks on mobile. */}
<div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:grid-rows-[auto_1fr] items-start">

  {/* Sidebar — right column on desktop (spans both rows), first on mobile */}
  <aside className="order-1 lg:order-none lg:col-start-2 lg:row-start-1 lg:row-span-2 lg:sticky lg:top-8 space-y-4">
    <FeedSidebar
      activeFilter={activeFilter}
      onFilterChange={(value) => { setActiveFilter(value); setPosts([]); setNextCursor(null); }}
      employees={employees}
      onShoutoutCreated={handleShoutoutCreated}
      pinned={pinnedItems}
      onJumpToPost={jumpToPost}
    />
  </aside>

  {/* Compose — left column, row 1 */}
  <div className="order-2 lg:order-none lg:col-start-1 lg:row-start-1">
    {/* (existing Compose <div className="bg-white rounded-xl border border-zinc-200 p-4"> ... </div> goes here) */}
  </div>

  {/* Posts — left column, row 2 */}
  <div className="order-3 lg:order-none lg:col-start-1 lg:row-start-2 space-y-5">
    {/* (existing Posts block: loadError / loading / empty / posts.map goes here) */}
  </div>

</div>
```

Move the existing **Compose `<div className="bg-white rounded-xl border border-zinc-200 p-4">…</div>`** inside the "Compose — left column" wrapper, and the existing **Posts block** (everything from `{loadError ? (` through the closing `)}` of `posts.map`) inside the "Posts — left column" wrapper. The `{/* ── Lightbox ── */}` block stays OUTSIDE the grid (it's a fixed overlay), as the last child before the component's final `</div>`.

> Note: the previous top-level `space-y-5` spacing between compose/filters/shoutout/posts is replaced by the grid `gap-6` and the posts wrapper's `space-y-5`.

- [ ] **Step 8: Add the jump anchor + highlight transition to each post**

Both post render branches have an outer `<div key={post.id} className="...">`. Add `id={`feed-post-${post.id}`}` and a `transition-shadow` class to each.

For the SHOUTOUT branch, change:

```tsx
<div key={post.id} className={`bg-white rounded-xl border overflow-hidden ${post.isPinned ? "border-amber-300" : "border-zinc-200"}`}>
```
to:
```tsx
<div id={`feed-post-${post.id}`} key={post.id} className={`bg-white rounded-xl border overflow-hidden transition-shadow ${post.isPinned ? "border-amber-300" : "border-zinc-200"}`}>
```

For the UPDATE/POLL branch, change:

```tsx
<div key={post.id} className={`rounded-xl border overflow-hidden ${post.isPinned ? "border-amber-300 bg-amber-50/30" : meta.bg}`}>
```
to:
```tsx
<div id={`feed-post-${post.id}`} key={post.id} className={`rounded-xl border overflow-hidden transition-shadow ${post.isPinned ? "border-amber-300 bg-amber-50/30" : meta.bg}`}>
```

- [ ] **Step 9: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. If the typechecker reports unused symbols, they should be exactly the deleted shoutout state setters and `handleShoutoutSubmit` — confirm none remain referenced.

- [ ] **Step 10: Lint**

Run: `npm run lint`
Expected: no errors/warnings.

- [ ] **Step 11: Commit**

```bash
git add "app/(dashboard)/feed/page.tsx"
git commit -m "feat: two-column feed layout with responsive sidebar"
```

---

## Task 6: Build + visual verification

**Files:** none (verification only)

- [ ] **Step 1: Production build (full typecheck)**

Run: `npm run build`
Expected: build succeeds with no type errors.

- [ ] **Step 2: Start the dev server**

Run: `npm run dev` (leave running in the background)
Expected: server ready on `http://localhost:3000`.

- [ ] **Step 3: Visual check — desktop**

Using the Playwright MCP browser tools: navigate to `http://localhost:3000/feed`, resize to 1440×900, take a snapshot/screenshot. Confirm:
- No large empty margins on left/right — the feed fills the left column, sidebar sits on the right.
- Sidebar shows Filter list, Recognize-a-colleague card, and (if any pinned posts) the Pinned card.
- A single-image post shows the whole image (no top/bottom crop); a multi-image post tiles cleanly; clicking a photo opens the lightbox with working prev/next.
- Sidebar stays in view (sticky) while scrolling the feed.

- [ ] **Step 4: Visual check — mobile**

Resize to 390×844, take a screenshot. Confirm:
- Single column; sidebar cards (Filters / Shoutout / Pinned) appear above the compose box and posts; nothing overflows horizontally.
- Filters still switch the feed; Give Shoutout form opens and submits.

- [ ] **Step 5: Functional spot-check**

In the browser: switch a filter, open the Give Shoutout form and confirm the colleague search dropdown works, click a Pinned entry and confirm it smooth-scrolls to and briefly highlights the post.

- [ ] **Step 6: Final commit (only if any fixes were needed)**

```bash
git add -A
git commit -m "fix: feed layout/photo visual polish from QA"
```

---

## Self-Review (completed by plan author)

**Spec coverage:**
- Section 1 (two-column layout, max-w-6xl grid, compose at top of main column, ~800px readable feed) → Task 5.
- Section 2 (FeedSidebar with Give Shoutout + Filters + Pinned; sticky on desktop, stacked above feed on mobile; single source of truth via props/lifted state) → Tasks 4 + 5.
- Section 3 (PostImages: 1 natural / 2 / 3 / 4+ with +N; lightbox prev/next via shared ImageLightbox; composer preview matches) → Tasks 1, 2, 3.
- Out-of-scope items (top-recognizers, API changes) correctly excluded.

**Placeholder scan:** No TBD/TODO; all code blocks are complete; the only "(existing … goes here)" markers are explicit move instructions in Task 5 Step 7, paired with exact identifiers of what to move.

**Type consistency:** `photoGridClass(count: number): string` defined in Task 1, imported/used in Tasks 2–3. `FeedSidebar` prop names (`activeFilter`, `onFilterChange`, `employees`, `onShoutoutCreated`, `pinned`, `onJumpToPost`) defined in Task 4 match the call site in Task 5 Step 7. `lightbox` state shape `{ images, index }` defined in Task 2 Step 3 matches usage in Steps 5–6. `ImageLightbox` props (`images`, `initialIndex`, `open`, `onClose`) match the real component signature.
