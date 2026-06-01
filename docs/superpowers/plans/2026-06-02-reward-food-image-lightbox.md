# Reward & Food Image Upload + Lightbox — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Cloudinary photo upload to admin reward management, display photos on Marketplace cards, and add click-to-zoom lightbox to both Marketplace and Food pages.

**Architecture:** A single shared `<ImageLightbox>` component handles full-screen zoom for both pages. The `imageUrl` column on `Reward` already exists in the DB — only the API schemas and UI need updating. Food images already work end-to-end; only the lightbox needs to be wired up there.

**Tech Stack:** Next.js 16 (App Router), React, Tailwind CSS, Cloudinary (existing `uploadToCloudinary` utility), Lucide icons, Zod (existing API validation), Prisma

---

## File Map

| Action | File | Purpose |
|---|---|---|
| Create | `components/ImageLightbox.tsx` | Shared full-screen zoom overlay |
| Modify | `app/api/rewards/route.ts` | Add `imageUrl` to POST schema |
| Modify | `app/api/rewards/[id]/route.ts` | Add `imageUrl` to PATCH schema |
| Modify | `app/admin/rewards/page.tsx` | Photo upload field in create/edit form |
| Modify | `app/(dashboard)/marketplace/page.tsx` | Photo area on cards + lightbox |
| Modify | `app/(dashboard)/food/page.tsx` | Click-to-zoom on existing hero images |

---

## Task 1: Build `<ImageLightbox>` component

**Files:**
- Create: `components/ImageLightbox.tsx`

- [ ] **Step 1: Create the component**

```tsx
// components/ImageLightbox.tsx
"use client";

import { useEffect, useState } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

type Props = {
  images: string[];
  initialIndex?: number;
  open: boolean;
  onClose: () => void;
};

export function ImageLightbox({ images, initialIndex = 0, open, onClose }: Props) {
  const [index, setIndex] = useState(initialIndex);

  // Sync index when caller changes initialIndex or reopens
  useEffect(() => {
    setIndex(initialIndex);
  }, [initialIndex, open]);

  // Keyboard: ESC closes, arrows navigate
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") setIndex((i) => Math.max(0, i - 1));
      if (e.key === "ArrowRight") setIndex((i) => Math.min(images.length - 1, i + 1));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, images.length]);

  if (!open || images.length === 0) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Close */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white/70 hover:text-white p-2 rounded-full bg-black/40 hover:bg-black/60 transition-colors"
        aria-label="Close"
      >
        <X className="w-5 h-5" />
      </button>

      {/* Prev arrow — only when multiple images and not at start */}
      {images.length > 1 && index > 0 && (
        <button
          onClick={(e) => { e.stopPropagation(); setIndex((i) => i - 1); }}
          className="absolute left-4 text-white/70 hover:text-white p-2 rounded-full bg-black/40 hover:bg-black/60 transition-colors"
          aria-label="Previous"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
      )}

      {/* Main image — stopPropagation so clicking it doesn't close */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={images[index]}
        alt=""
        className="max-h-[90vh] max-w-[90vw] object-contain rounded-lg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />

      {/* Next arrow — only when multiple images and not at end */}
      {images.length > 1 && index < images.length - 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); setIndex((i) => i + 1); }}
          className="absolute right-4 text-white/70 hover:text-white p-2 rounded-full bg-black/40 hover:bg-black/60 transition-colors"
          aria-label="Next"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      )}

      {/* Dot indicators — only for multi-image */}
      {images.length > 1 && (
        <div className="absolute bottom-4 flex gap-2">
          {images.map((_, i) => (
            <button
              key={i}
              onClick={(e) => { e.stopPropagation(); setIndex(i); }}
              className={`w-2 h-2 rounded-full transition-colors ${
                i === index ? "bg-white" : "bg-white/40 hover:bg-white/60"
              }`}
              aria-label={`Image ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify the file compiles**

Check the dev server console (running on port 3001) — no red TypeScript errors should appear for `components/ImageLightbox.tsx`.

- [ ] **Step 3: Commit**

```bash
git add components/ImageLightbox.tsx
git commit -m "feat: add shared ImageLightbox component"
```

---

## Task 2: Expose `imageUrl` in the Rewards API

**Files:**
- Modify: `app/api/rewards/route.ts:18-24`
- Modify: `app/api/rewards/[id]/route.ts:6-13`

- [ ] **Step 1: Add `imageUrl` to the POST schema**

In `app/api/rewards/route.ts`, replace the `createSchema` block (lines 18–24):

```typescript
const createSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  imageUrl: z.string().url().optional(),
  pointCost: z.number().int().min(1),
  stockQuantity: z.number().int().min(-1).default(-1),
  category: z.enum(["PHYSICAL", "VOUCHER", "PRIVILEGE", "DIGITAL"]),
});
```

No other changes needed — `...parsed.data` already spreads into `prisma.reward.create()`.

- [ ] **Step 2: Add `imageUrl` to the PATCH schema**

In `app/api/rewards/[id]/route.ts`, replace the `updateSchema` block (lines 6–13):

```typescript
const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  imageUrl: z.string().url().nullable().optional(),
  pointCost: z.number().int().min(1).optional(),
  stockQuantity: z.number().int().min(-1).optional(),
  category: z.enum(["PHYSICAL", "VOUCHER", "PRIVILEGE", "DIGITAL"]).optional(),
  isActive: z.boolean().optional(),
});
```

`nullable()` allows clearing a photo later by sending `imageUrl: null`.

- [ ] **Step 3: Verify no TypeScript errors in the dev server console**

- [ ] **Step 4: Commit**

```bash
git add app/api/rewards/route.ts app/api/rewards/[id]/route.ts
git commit -m "feat: add imageUrl to rewards API POST and PATCH schemas"
```

---

## Task 3: Add photo upload to the Admin Rewards form

**Files:**
- Modify: `app/admin/rewards/page.tsx`

- [ ] **Step 1: Update imports**

Replace the current import block at the top of `app/admin/rewards/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useApiClient } from "@/lib/hooks/useApiClient";
import { uploadToCloudinary } from "@/lib/cloudinary/upload";
import React from "react";
import { Pencil, Trash2, Plus, Package, Ticket, Star, Monitor, ImagePlus, X } from "lucide-react";
```

- [ ] **Step 2: Add `imageUrl` to the local `Reward` type**

```typescript
type Reward = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  pointCost: number;
  stockQuantity: number;
  category: string;
  isActive: boolean;
};
```

- [ ] **Step 3: Add `imageUrl` and `uploading` state**

Inside `AdminRewardsPage`, after the existing state declarations:

```tsx
const [imageUrl, setImageUrl] = useState("");
const [uploading, setUploading] = useState(false);
```

- [ ] **Step 4: Add the photo upload handler**

Add this function after `handleDelete`:

```tsx
async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
  const file = e.target.files?.[0];
  if (!file) return;
  setUploading(true);
  setError("");
  try {
    const url = await uploadToCloudinary(file);
    setImageUrl(url);
  } catch {
    setError("Image upload failed — try again.");
  } finally {
    setUploading(false);
    e.target.value = "";
  }
}
```

- [ ] **Step 5: Update `handleEdit` to pre-populate the image**

Replace the existing `handleEdit` function:

```tsx
function handleEdit(reward: Reward) {
  setForm({
    name: reward.name,
    description: reward.description ?? "",
    pointCost: String(reward.pointCost),
    stockQuantity: String(reward.stockQuantity),
    category: reward.category,
  });
  setImageUrl(reward.imageUrl ?? "");
  setEditingId(reward.id);
  setShowForm(true);
}
```

- [ ] **Step 6: Update `handleSubmit` to include `imageUrl` in the payload**

Replace the `payload` object inside `handleSubmit`:

```tsx
const payload = {
  name: form.name,
  description: form.description || undefined,
  imageUrl: imageUrl || undefined,
  pointCost: Number(form.pointCost),
  stockQuantity: Number(form.stockQuantity),
  category: form.category,
};
```

- [ ] **Step 7: Reset `imageUrl` on form close and after save**

Replace the post-save reset block (lines 65–68 in the original):

```tsx
setForm(emptyForm);
setImageUrl("");
setEditingId(null);
setShowForm(false);
await loadRewards();
```

Replace the Cancel button's onClick:

```tsx
onClick={() => { setShowForm(false); setEditingId(null); setImageUrl(""); }}
```

- [ ] **Step 8: Add the photo upload UI field to the form**

In the form JSX, add this block **after the Description field** (after the closing `</div>` of the description textarea block) and **before the Point Cost field**:

```tsx
{/* Photo */}
<div className="col-span-2 space-y-1.5">
  <label className="text-sm font-medium text-gray-700">
    Photo <span className="text-gray-400 font-normal">(optional)</span>
  </label>
  {imageUrl ? (
    <div className="relative w-24 h-24">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imageUrl}
        alt="Preview"
        className="w-24 h-24 object-cover rounded-xl border border-gray-200"
      />
      <button
        type="button"
        onClick={() => setImageUrl("")}
        className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-gray-800 text-white flex items-center justify-center hover:bg-red-600 transition-colors"
        aria-label="Remove photo"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  ) : (
    <label
      className={`flex items-center gap-2 px-3 py-2 text-sm border border-dashed border-gray-300 rounded-xl cursor-pointer hover:bg-gray-50 text-gray-500 w-fit ${
        uploading ? "opacity-50 pointer-events-none" : ""
      }`}
    >
      <ImagePlus className="w-4 h-4" />
      {uploading ? "Uploading…" : "Upload photo"}
      <input
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handlePhotoChange}
        disabled={uploading}
      />
    </label>
  )}
</div>
```

- [ ] **Step 9: Verify in browser**

1. Navigate to `http://localhost:3001/admin/rewards`
2. Click **Add Reward** — confirm the Photo field appears
3. Select an image — confirm it uploads and shows a thumbnail
4. Click × — confirm it removes the thumbnail
5. Save the reward — confirm no errors
6. Click the edit pencil on that reward — confirm the thumbnail pre-populates

- [ ] **Step 10: Commit**

```bash
git add app/admin/rewards/page.tsx
git commit -m "feat: add photo upload to admin rewards form"
```

---

## Task 4: Update Marketplace cards to show photos + lightbox

**Files:**
- Modify: `app/(dashboard)/marketplace/page.tsx`

- [ ] **Step 1: Update imports**

Replace the top import block:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useApiClient } from "@/lib/hooks/useApiClient";
import React from "react";
import { ShoppingBag, CheckCircle, AlertCircle, Coins, Package, Ticket, Star, Monitor } from "lucide-react";
import { useConfetti } from "@/lib/hooks/useConfetti";
import { ImageLightbox } from "@/components/ImageLightbox";
```

- [ ] **Step 2: Add `imageUrl` to the `Reward` type**

```typescript
type Reward = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  pointCost: number;
  stockQuantity: number;
  category: string;
};
```

- [ ] **Step 3: Add lightbox state**

Inside `MarketplacePage`, after the existing state declarations:

```tsx
const [lightboxImg, setLightboxImg] = useState<string | null>(null);
```

- [ ] **Step 4: Replace the color-accent strip with a photo area**

Inside the card's `return`, find this line:

```tsx
{/* Color accent */}
<div className={`h-1 bg-gradient-to-r ${cfg.accent}`} />
```

Replace it with:

```tsx
{/* Photo or color accent */}
{reward.imageUrl ? (
  <button
    type="button"
    className="block w-full focus:outline-none cursor-zoom-in"
    onClick={() => setLightboxImg(reward.imageUrl!)}
    aria-label={`View photo of ${reward.name}`}
  >
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img
      src={reward.imageUrl}
      alt={reward.name}
      className="w-full h-40 object-cover"
    />
  </button>
) : (
  <div className={`h-1 bg-gradient-to-r ${cfg.accent}`} />
)}
```

- [ ] **Step 5: Render the lightbox at page level**

At the very end of the returned JSX, just before the final closing `</div>` of `<div className="space-y-5">`:

```tsx
<ImageLightbox
  images={lightboxImg ? [lightboxImg] : []}
  open={!!lightboxImg}
  onClose={() => setLightboxImg(null)}
/>
```

- [ ] **Step 6: Verify in browser**

1. Navigate to `http://localhost:3001/marketplace`
2. For a reward **with** a photo: confirm the card shows the full-width image (h-40). Click it — confirm the lightbox opens. Press ESC or click outside — confirm it closes.
3. For a reward **without** a photo: confirm the card shows the 4px color accent strip as before. No zoom cursor.

- [ ] **Step 7: Commit**

```bash
git add app/(dashboard)/marketplace/page.tsx
git commit -m "feat: add photo display and lightbox to marketplace cards"
```

---

## Task 5: Wire lightbox to Food page hero images

**Files:**
- Modify: `app/(dashboard)/food/page.tsx`

- [ ] **Step 1: Import ImageLightbox**

In `app/(dashboard)/food/page.tsx`, add to the existing import block:

```tsx
import { ImageLightbox } from "@/components/ImageLightbox";
```

- [ ] **Step 2: Add lightbox state**

Inside `FoodPage`, after the existing state declarations:

```tsx
const [lightbox, setLightbox] = useState<{ images: string[]; index: number } | null>(null);
```

- [ ] **Step 3: Wire onClick to the hero image and thumbnails**

Find the existing hero image block (around line 360):

```tsx
{/* Hero image */}
{listing.imageUrls.length > 0 && (
  <div className="relative">
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={listing.imageUrls[0]} alt={listing.title} className="w-full h-36 object-cover" />
    {listing.imageUrls.length > 1 && (
      <div className="flex gap-1 absolute bottom-1.5 right-1.5">
        {listing.imageUrls.slice(1).map((url, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={i} src={url} alt="" className="w-10 h-10 object-cover rounded border-2 border-white" />
        ))}
      </div>
    )}
  </div>
)}
```

Replace it with:

```tsx
{/* Hero image */}
{listing.imageUrls.length > 0 && (
  <div className="relative">
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img
      src={listing.imageUrls[0]}
      alt={listing.title}
      className="w-full h-36 object-cover cursor-zoom-in"
      onClick={() => setLightbox({ images: listing.imageUrls, index: 0 })}
    />
    {listing.imageUrls.length > 1 && (
      <div className="flex gap-1 absolute bottom-1.5 right-1.5">
        {listing.imageUrls.slice(1).map((url, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={i}
            src={url}
            alt=""
            className="w-10 h-10 object-cover rounded border-2 border-white cursor-zoom-in"
            onClick={() => setLightbox({ images: listing.imageUrls, index: i + 1 })}
          />
        ))}
      </div>
    )}
  </div>
)}
```

- [ ] **Step 4: Render the lightbox at page level**

At the very end of the returned JSX, just before the final closing `</div>` of `<div className="space-y-5">`:

```tsx
{lightbox && (
  <ImageLightbox
    images={lightbox.images}
    initialIndex={lightbox.index}
    open={!!lightbox}
    onClose={() => setLightbox(null)}
  />
)}
```

- [ ] **Step 5: Verify in browser**

1. Navigate to `http://localhost:3001/food`
2. On a listing that has photos: confirm the hero image shows `cursor-zoom-in` on hover. Click it — confirm the lightbox opens with the full image.
3. If the listing has 2–3 images: confirm the thumbnail overlays are also clickable and open the lightbox at the correct image index. Confirm the dot indicators and arrows work.
4. Press ESC — confirm the lightbox closes.
5. On a listing **without** photos: confirm no zoom cursor and no lightbox.

- [ ] **Step 6: Commit**

```bash
git add app/(dashboard)/food/page.tsx
git commit -m "feat: wire click-to-zoom lightbox to food listing images"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|---|---|
| `<ImageLightbox>` — fixed overlay, dark bg, ×, ESC, click-outside, arrows, dots | Task 1 |
| Admin rewards — Cloudinary upload, preview thumbnail, ×-to-remove | Task 3 |
| Admin rewards — `imageUrl` in POST/PATCH payload | Tasks 2 + 3 |
| Admin rewards edit — pre-populate existing image | Task 3 Step 5 |
| Upload failure shows inline error | Task 3 Step 4 |
| API POST accepts `imageUrl` | Task 2 Step 1 |
| API PATCH accepts `imageUrl` (nullable to allow clearing) | Task 2 Step 2 |
| Marketplace card — full-width photo when `imageUrl` present | Task 4 |
| Marketplace card — falls back to color accent when no image | Task 4 |
| Marketplace lightbox wired — single image, no arrows | Task 4 |
| Food hero image — `cursor-zoom-in`, onClick opens lightbox at index 0 | Task 5 |
| Food thumbnails — onClick opens lightbox at correct index | Task 5 |
| Food lightbox — arrows + dots for multi-image | Task 1 (supports it) + Task 5 |

All spec requirements covered. No TBDs or placeholders. Type names are consistent across all tasks (`ImageLightbox`, `lightboxImg`, `lightbox`).
