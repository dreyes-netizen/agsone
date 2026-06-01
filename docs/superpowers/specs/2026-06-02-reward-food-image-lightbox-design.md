# Reward & Food Image Upload + Lightbox

**Date:** 2026-06-02
**Scope:** Admin reward photo upload · Marketplace card photo display · Food card click-to-zoom lightbox

---

## Problem

- HR admins cannot attach photos to rewards in the admin panel — the `imageUrl` DB column exists but is unused.
- Marketplace reward cards show only a category icon; no product photo.
- Food listing cards already show photos but clicking them does nothing.

## Goal

Facebook-Marketplace-style experience: photos on cards, click any photo to zoom in full-screen.

---

## Architecture

### Shared `<ImageLightbox>` component
**File:** `components/ImageLightbox.tsx`

- Props: `images: string[]`, `initialIndex?: number`, `open: boolean`, `onClose: () => void`
- Renders a fixed full-screen dark overlay (`bg-black/80 backdrop-blur-sm`) with the active image centered
- × close button (top-right corner)
- Closes on ESC keydown or click-outside the image
- Left/right arrow buttons when `images.length > 1` (Food multi-image); hidden for single images (Marketplace)
- No external library — built with React state + `useEffect` for keyboard listener

---

## Admin Rewards Form Changes
**File:** `app/admin/rewards/page.tsx`

- Add a **Photo** field to the create/edit reward form
- File input accepts `image/*`; on change, calls `uploadToCloudinary()` (already in `lib/cloudinary/upload.ts`) and stores the returned URL in local state
- While uploading: show a small spinner in place of the preview
- After upload: show a 64×64 thumbnail with an × button to remove
- `imageUrl` string is included in the POST (create) and PATCH (edit) request body
- If a reward already has an `imageUrl`, the edit form pre-populates the thumbnail

---

## API Changes

### `app/api/rewards/route.ts` (POST)
Add `imageUrl: z.string().url().optional()` to the Zod schema. Pass through to `prisma.reward.create()`.

### `app/api/rewards/[id]/route.ts` (PATCH)
Same addition to the PATCH schema. Pass through to `prisma.reward.update()`.

No DB migration required — `imageUrl String?` already exists on the `Reward` model.

---

## Marketplace Card Redesign
**File:** `app/(dashboard)/marketplace/page.tsx`

Each reward card gains a full-width photo area at the top (~160px, `h-40 object-cover`):
- **With image:** Shows `<img>` with `object-cover`. Clicking it opens `<ImageLightbox>` with `[reward.imageUrl]`. Cursor is `cursor-zoom-in`.
- **Without image:** Falls back to current layout — colored category icon centered on a tinted background. Not clickable.

The rest of the card (name, cost, redeem button) is unchanged below the photo area.

---

## Food Lightbox Wiring
**File:** `app/(dashboard)/food/page.tsx`

No backend changes. Only UI changes:

- Import `<ImageLightbox>`
- Add state: `lightboxImages: string[]`, `lightboxOpen: boolean`, `lightboxIndex: number`
- Wrap the existing hero `<img>` in an `onClick` that sets `lightboxImages = listing.imageUrls`, `lightboxIndex = 0`, `lightboxOpen = true`
- Add `cursor-zoom-in` to the hero image
- The small thumbnail overlays (additional images) also get `onClick` with their index
- Render `<ImageLightbox>` once at the page level (not per card)

---

## Error Handling

| Scenario | Behavior |
|---|---|
| Cloudinary upload fails (admin) | Show inline error: "Upload failed — try again." `imageUrl` stays empty, form can still save |
| Reward has no image | Marketplace card falls back to icon; no lightbox triggered |
| Food listing has no images | No `cursor-zoom-in`, no lightbox |
| Lightbox image fails to load | `onError` on `<img>` shows a gray placeholder with broken-image icon |

---

## Out of Scope

- Deleting the old Cloudinary image when a reward's photo is replaced (Cloudinary retains unreferenced assets; acceptable for now)
- Multiple images per reward (schema supports only one `imageUrl`)
- Drag-to-reorder for Food images (existing order is preserved)
