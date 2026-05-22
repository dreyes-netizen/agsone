# Food Board — Design Spec
_Date: 2026-05-22_

## Overview

Add a Food Board to AGS One. Any employee can post food listings with a price and an order cutoff. Other employees browse listings, place orders (quantity + optional note), and settle payment offline. The platform is a coordination layer only — no payment processing, no points involved.

---

## 1. Data Layer

### Schema changes (`prisma/schema.prisma`)

```prisma
model FoodListing {
  id          String      @id @default(cuid())
  title       String
  description String?
  price       Decimal     @db.Decimal(10, 2)
  imageUrls   String[]
  cutoffAt    DateTime
  isActive    Boolean     @default(true)
  createdById String
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt

  createdBy   User        @relation("FoodListingsCreated", fields: [createdById], references: [id])
  orders      FoodOrder[]
}

model FoodOrder {
  id        String      @id @default(cuid())
  listingId String
  userId    String
  quantity  Int
  note      String?
  createdAt DateTime    @default(now())

  listing   FoodListing @relation(fields: [listingId], references: [id])
  user      User        @relation("FoodOrdersPlaced", fields: [userId], references: [id])

  @@unique([listingId, userId])
}
```

Add relations to the `User` model:
```prisma
foodListings  FoodListing[] @relation("FoodListingsCreated")
foodOrders    FoodOrder[]   @relation("FoodOrdersPlaced")
```

### Image Storage

Food photos are stored in Supabase Storage in a `food-listings` bucket. Up to 3 images per listing. Images are uploaded before listing creation; the resulting public URLs are stored in `imageUrls String[]`.

### API Routes

| Route | Method | Auth | Purpose |
|---|---|---|---|
| `/api/food` | GET | Any authenticated | List active listings + caller's own order on each |
| `/api/food` | POST | Any authenticated | Create a listing (with image URLs already resolved) |
| `/api/food/[id]` | PATCH | Listing owner only | Toggle `isActive` (close listing early) |
| `/api/food/[id]/order` | POST | Any authenticated | Place an order |
| `/api/food/[id]/order` | DELETE | Any authenticated | Cancel own order (before cutoff only) |

---

## 2. Employee UI — `/food`

**Route:** `app/(dashboard)/food/page.tsx`

**Layout:** Card grid, consistent with `/marketplace`, `/missions`, and `/games`.

### Tabs

| Tab | Shows |
|---|---|
| **Available** | Active listings where `cutoffAt > now()` |
| **My Orders** | Listings where the current user has placed an order |
| **My Listings** | Listings created by the current user |

### Listing card

**If listing has photos:** Hero image (first photo) fills the top of the card. If 2–3 photos, a small thumbnail strip appears below the hero.

**Card body fields:**
- Seller name + avatar initials (top)
- Title + description (2-line clamp)
- Price in ₱ (prominent, green)
- Cutoff time with amber clock icon — "Order by Dec 5, 3:00 PM"
- Order count — "X orders" visible to everyone

**Action area (state-dependent):**

| State | Action area |
|---|---|
| Available, not yet ordered | Green "Order" button |
| Available, already ordered | "Your order: {qty}" + optional note shown + red "Cancel" link |
| Past cutoff or inactive | Gray "Orders closed" badge — no actions |
| Current user is the seller | "View Orders ({n})" button — expands inline order list below the card |

### "Order" inline form

Clicking "Order" expands a form inline on the card (no modal):
- Quantity stepper (1–99)
- Optional note field (placeholder: "e.g. no onions")
- "Confirm Order" button + "Cancel" link

On confirm: `POST /api/food/[id]/order`. Card switches to "already ordered" state optimistically.

### Seller's order list (expanded inline)

Clicking "View Orders" expands below the seller's card:
- Table: Buyer name | Qty | Note | Ordered at
- Read-only — no approve/reject in v1
- "Close Listing" button to toggle `isActive` to false

### "Sell Food" form

A "Sell Food" button at the top right of the page toggles an inline creation form:

**Fields:**
- Title (required)
- Description (optional)
- Price in ₱ (required, min ₱1)
- Cutoff date + time (required, must be in the future)
- Photo upload — up to 3 images (optional). Images upload to Supabase Storage on selection (showing a preview). On submit, resolved URLs are sent with the listing data.

### Navigation

Add "Food" to `app/(dashboard)/layout.tsx` main sidebar nav with the `UtensilsCrossed` icon from lucide-react, between Marketplace and Games.

Also add to `bottomNavItems` (mobile), replacing Games (lower priority on mobile than food):
```
Home | Feed | Missions | Food | Marketplace
```

---

## 3. Rules & Edge Cases

### Cutoff enforcement
- Server-enforced: `POST /api/food/[id]/order` returns 410 if `listing.cutoffAt <= now()` or `listing.isActive === false`
- Frontend hides the Order button past cutoff, but the server check is authoritative

### Cancellation
- `DELETE /api/food/[id]/order` returns 410 if cutoff has passed or listing is inactive
- Buyers can only cancel before the cutoff — gives sellers a stable, final order list

### Closing early
- Only the listing's `createdById` can call `PATCH /api/food/[id]`
- Once closed (`isActive = false`), no new orders and no cancellations
- Seller still sees all orders placed before closing

### Ownership guard
- `PATCH /api/food/[id]`: API checks `listing.createdById === authUser.id` → 403 if not owner
- `DELETE /api/food/[id]/order`: API checks `order.userId === authUser.id` → 403 if not buyer

### Image upload
- Images uploaded client-side to Supabase Storage before form submission
- Upload path: `food-listings/{userId}/{timestamp}-{filename}`
- Max 3 images enforced in the UI; API accepts `imageUrls` as a String array (0–3 entries)
- No server-side file validation in v1 (trust client-side)

### No points, no notifications, no admin moderation
- Food is entirely outside the points economy
- No `PointTransaction`, no `Notification`, no audit log
- HR/Admin have no special controls over food listings

---

## 4. Files Changed

### New files
```
app/(dashboard)/food/page.tsx
app/api/food/route.ts
app/api/food/[id]/route.ts
app/api/food/[id]/order/route.ts
```

### Modified files
```
prisma/schema.prisma           — add FoodListing, FoodOrder models + User relations
app/(dashboard)/layout.tsx     — add Food nav item
```

---

## 5. Out of Scope (v1)

- Editing a listing after creation (close only)
- HR/admin moderation or deletion of listings
- Notifications to buyers when a listing is closed
- Multiple orders from the same buyer on the same listing
- Points integration
- Payment tracking within the platform
