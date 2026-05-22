# Food Board Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Food Board where any employee can post food listings with a price and cutoff time, and other employees can place orders (quantity + optional note) with payment settled offline.

**Architecture:** Two new Prisma models (`FoodListing`, `FoodOrder`). Four API route files handle listing CRUD and order placement/cancellation. One employee page (`/food`) with three tabs, inline order form, inline seller order list, and inline listing creation form with Cloudinary image upload.

**Tech Stack:** Next.js 16 App Router, Prisma 7, PostgreSQL (Supabase), TypeScript, Tailwind CSS, Cloudinary (existing `lib/cloudinary/upload.ts`), zod, lucide-react

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `prisma/schema.prisma` | Modify | Add `FoodListing`, `FoodOrder` models + User relations |
| `app/api/food/route.ts` | Create | GET listings + POST create listing |
| `app/api/food/[id]/route.ts` | Create | PATCH toggle isActive (owner only) |
| `app/api/food/[id]/order/route.ts` | Create | POST place order + DELETE cancel order |
| `app/(dashboard)/food/page.tsx` | Create | Employee food board page |
| `app/(dashboard)/layout.tsx` | Modify | Add Food nav item (sidebar + mobile) |

---

## Task 1: Schema Migration

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add the two new models**

In `prisma/schema.prisma`, after the last model (search for the final `}` before end of file), add:

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

  createdBy User        @relation("FoodListingsCreated", fields: [createdById], references: [id])
  orders    FoodOrder[]
}

model FoodOrder {
  id        String      @id @default(cuid())
  listingId String
  userId    String
  quantity  Int
  note      String?
  createdAt DateTime    @default(now())

  listing FoodListing @relation(fields: [listingId], references: [id])
  user    User        @relation("FoodOrdersPlaced", fields: [userId], references: [id])

  @@unique([listingId, userId])
}
```

- [ ] **Step 2: Add relations to the User model**

In the `User` model, after the `auditLogs` relation line, add:

```prisma
  foodListings FoodListing[] @relation("FoodListingsCreated")
  foodOrders   FoodOrder[]   @relation("FoodOrdersPlaced")
```

- [ ] **Step 3: Apply to database**

```bash
npx prisma db push
```

Expected: `Your database is now in sync with your Prisma schema.`

- [ ] **Step 4: Regenerate Prisma client**

```bash
npx prisma generate
```

Expected: Client regenerated in `lib/generated/prisma/`.

- [ ] **Step 5: Type-check**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: add FoodListing and FoodOrder to schema"
```

---

## Task 2: GET + POST /api/food

**Files:**
- Create: `app/api/food/route.ts`

- [ ] **Step 1: Create the route**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";
import { z } from "zod";

const createSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  price: z.number().positive(),
  imageUrls: z.array(z.string().url()).max(3).default([]),
  cutoffAt: z.string().datetime(),
});

export async function GET(req: NextRequest) {
  const authUser = await verifyAuth(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const listings = await prisma.foodListing.findMany({
    include: {
      createdBy: { select: { id: true, displayName: true, avatarUrl: true } },
      orders: {
        where: { userId: authUser.id },
        select: { id: true, quantity: true, note: true, createdAt: true },
      },
      _count: { select: { orders: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const data = listings.map((l) => ({
    ...l,
    price: l.price.toString(),
    myOrder: l.orders[0] ?? null,
    orders: undefined,
  }));

  return NextResponse.json({ data });
}

export async function POST(req: NextRequest) {
  const authUser = await verifyAuth(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { title, description, price, imageUrls, cutoffAt } = parsed.data;

  if (new Date(cutoffAt) <= new Date()) {
    return NextResponse.json({ error: "Cutoff must be in the future" }, { status: 400 });
  }

  const listing = await prisma.foodListing.create({
    data: {
      title,
      description: description ?? null,
      price,
      imageUrls,
      cutoffAt: new Date(cutoffAt),
      createdById: authUser.id,
    },
  });

  return NextResponse.json({ data: { ...listing, price: listing.price.toString() } }, { status: 201 });
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/food/route.ts
git commit -m "feat: add GET+POST /api/food endpoints"
```

---

## Task 3: PATCH /api/food/[id] — Close listing

**Files:**
- Create: `app/api/food/[id]/route.ts`

- [ ] **Step 1: Create the route**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = await verifyAuth(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const listing = await prisma.foodListing.findUnique({ where: { id } });
  if (!listing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (listing.createdById !== authUser.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const updated = await prisma.foodListing.update({
    where: { id },
    data: { isActive: false },
  });

  return NextResponse.json({ data: { ...updated, price: updated.price.toString() } });
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add "app/api/food/[id]/route.ts"
git commit -m "feat: add PATCH /api/food/[id] close listing endpoint"
```

---

## Task 4: POST + DELETE /api/food/[id]/order

**Files:**
- Create: `app/api/food/[id]/order/route.ts`

- [ ] **Step 1: Create the route**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";
import { z } from "zod";

const orderSchema = z.object({
  quantity: z.number().int().min(1).max(99),
  note: z.string().max(500).optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = await verifyAuth(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const listing = await prisma.foodListing.findUnique({ where: { id } });
  if (!listing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!listing.isActive || listing.cutoffAt <= new Date()) {
    return NextResponse.json({ error: "Orders closed" }, { status: 410 });
  }

  const existing = await prisma.foodOrder.findUnique({
    where: { listingId_userId: { listingId: id, userId: authUser.id } },
  });
  if (existing) return NextResponse.json({ error: "Already ordered" }, { status: 409 });

  const body = await req.json();
  const parsed = orderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const order = await prisma.foodOrder.create({
    data: {
      listingId: id,
      userId: authUser.id,
      quantity: parsed.data.quantity,
      note: parsed.data.note ?? null,
    },
  });

  return NextResponse.json({ data: order }, { status: 201 });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = await verifyAuth(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const order = await prisma.foodOrder.findUnique({
    where: { listingId_userId: { listingId: id, userId: authUser.id } },
    include: { listing: { select: { cutoffAt: true, isActive: true } } },
  });
  if (!order) return NextResponse.json({ error: "No order found" }, { status: 404 });
  if (!order.listing.isActive || order.listing.cutoffAt <= new Date()) {
    return NextResponse.json({ error: "Cannot cancel after cutoff" }, { status: 410 });
  }

  await prisma.foodOrder.delete({
    where: { listingId_userId: { listingId: id, userId: authUser.id } },
  });

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add "app/api/food/[id]/order/route.ts"
git commit -m "feat: add POST+DELETE /api/food/[id]/order endpoints"
```

---

## Task 5: Navigation — Add Food to Employee Sidebar

**Files:**
- Modify: `app/(dashboard)/layout.tsx`

- [ ] **Step 1: Read the current file**

Read `app/(dashboard)/layout.tsx` to see the current import line and nav arrays before editing.

- [ ] **Step 2: Add UtensilsCrossed to imports**

Find the lucide-react import block and add `UtensilsCrossed`:

```typescript
import {
  Home, ShoppingBag, Trophy, User, ShieldCheck, LogOut,
  Rss, Gamepad2, Menu, Target, UtensilsCrossed,
} from "lucide-react";
```

- [ ] **Step 3: Update mainNav — add Food between Marketplace and Games**

```typescript
const mainNav = [
  { href: "/dashboard",   label: "Home",        icon: Home },
  { href: "/feed",        label: "Feed",        icon: Rss },
  { href: "/missions",    label: "Missions",    icon: Target },
  { href: "/marketplace", label: "Marketplace", icon: ShoppingBag },
  { href: "/food",        label: "Food",        icon: UtensilsCrossed },
  { href: "/games",       label: "Games",       icon: Gamepad2 },
  { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
  { href: "/profile",     label: "Profile",     icon: User },
];
```

- [ ] **Step 4: Update bottomNavItems — replace Games with Food**

```typescript
const bottomNavItems = [
  { href: "/dashboard",   label: "Home",        icon: Home },
  { href: "/feed",        label: "Feed",        icon: Rss },
  { href: "/missions",    label: "Missions",    icon: Target },
  { href: "/food",        label: "Food",        icon: UtensilsCrossed },
  { href: "/marketplace", label: "Marketplace", icon: ShoppingBag },
];
```

- [ ] **Step 5: Type-check**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add "app/(dashboard)/layout.tsx"
git commit -m "feat: add Food to employee navigation"
```

---

## Task 6: Employee UI — /food Page

**Files:**
- Create: `app/(dashboard)/food/page.tsx`

- [ ] **Step 1: Create the page**

```typescript
"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useApiClient } from "@/lib/hooks/useApiClient";
import { uploadToCloudinary } from "@/lib/cloudinary/upload";
import { UtensilsCrossed, Clock, X, ChevronDown, ChevronUp, Loader2, ImagePlus } from "lucide-react";

type MyOrder = {
  id: string;
  quantity: number;
  note: string | null;
  createdAt: string;
};

type OrderRow = {
  id: string;
  quantity: number;
  note: string | null;
  createdAt: string;
  user: { displayName: string };
};

type Listing = {
  id: string;
  title: string;
  description: string | null;
  price: string;
  imageUrls: string[];
  cutoffAt: string;
  isActive: boolean;
  createdBy: { id: string; displayName: string; avatarUrl: string | null };
  myOrder: MyOrder | null;
  _count: { orders: number };
};

type Tab = "AVAILABLE" | "MY_ORDERS" | "MY_LISTINGS";

function formatPrice(price: string) {
  return `₱${parseFloat(price).toFixed(2)}`;
}

function formatCutoff(cutoffAt: string) {
  return new Date(cutoffAt).toLocaleString("en-US", {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
}

function isClosed(listing: Listing) {
  return !listing.isActive || new Date(listing.cutoffAt) <= new Date();
}

export default function FoodPage() {
  const { user, dbUser, loading: authLoading } = useAuth();
  const { apiFetch } = useApiClient();

  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("AVAILABLE");

  // Inline order form state
  const [orderingId, setOrderingId] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [orderNote, setOrderNote] = useState("");
  const [submittingOrder, setSubmittingOrder] = useState(false);

  // Expanded seller view
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sellerOrders, setSellerOrders] = useState<Record<string, OrderRow[]>>({});

  // Create listing form
  const [showForm, setShowForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newCutoff, setNewCutoff] = useState("");
  const [newImages, setNewImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (authLoading || !user) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user]);

  async function load() {
    try {
      const r = await apiFetch<{ data: Listing[] }>("/api/food");
      setListings(r.data);
    } catch {
      alert("Failed to load listings");
    } finally {
      setLoading(false);
    }
  }

  // ── Image picker ────────────────────────────────────────────────────────────
  function handleImagePick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    const combined = [...newImages, ...files].slice(0, 3);
    setNewImages(combined);
    setImagePreviews(combined.map((f) => URL.createObjectURL(f)));
  }

  function removeImage(idx: number) {
    const updated = newImages.filter((_, i) => i !== idx);
    setNewImages(updated);
    setImagePreviews(updated.map((f) => URL.createObjectURL(f)));
  }

  // ── Create listing ──────────────────────────────────────────────────────────
  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const imageUrls = await Promise.all(newImages.map((f) => uploadToCloudinary(f)));
      await apiFetch("/api/food", {
        method: "POST",
        body: JSON.stringify({
          title: newTitle,
          description: newDesc || undefined,
          price: parseFloat(newPrice),
          imageUrls,
          cutoffAt: new Date(newCutoff).toISOString(),
        }),
      });
      setShowForm(false);
      setNewTitle(""); setNewDesc(""); setNewPrice(""); setNewCutoff("");
      setNewImages([]); setImagePreviews([]);
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to create listing");
    } finally {
      setCreating(false);
    }
  }

  // ── Place order ─────────────────────────────────────────────────────────────
  async function handleOrder(listing: Listing) {
    setSubmittingOrder(true);
    try {
      await apiFetch(`/api/food/${listing.id}/order`, {
        method: "POST",
        body: JSON.stringify({ quantity: qty, note: orderNote || undefined }),
      });
      setListings((prev) =>
        prev.map((l) =>
          l.id === listing.id
            ? { ...l, myOrder: { id: "optimistic", quantity: qty, note: orderNote || null, createdAt: new Date().toISOString() }, _count: { orders: l._count.orders + 1 } }
            : l
        )
      );
      setOrderingId(null); setQty(1); setOrderNote("");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to place order");
    } finally {
      setSubmittingOrder(false);
    }
  }

  // ── Cancel order ────────────────────────────────────────────────────────────
  async function handleCancel(listing: Listing) {
    if (!confirm("Cancel your order?")) return;
    try {
      await apiFetch(`/api/food/${listing.id}/order`, { method: "DELETE" });
      setListings((prev) =>
        prev.map((l) =>
          l.id === listing.id
            ? { ...l, myOrder: null, _count: { orders: Math.max(0, l._count.orders - 1) } }
            : l
        )
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to cancel order");
    }
  }

  // ── Close listing ────────────────────────────────────────────────────────────
  async function handleClose(listing: Listing) {
    if (!confirm(`Close "${listing.title}"? No more orders will be accepted.`)) return;
    try {
      await apiFetch(`/api/food/${listing.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: false }),
      });
      setListings((prev) => prev.map((l) => l.id === listing.id ? { ...l, isActive: false } : l));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to close listing");
    }
  }

  // ── Load seller orders ───────────────────────────────────────────────────────
  async function toggleSellerOrders(listing: Listing) {
    if (expandedId === listing.id) { setExpandedId(null); return; }
    setExpandedId(listing.id);
    if (sellerOrders[listing.id]) return;
    try {
      const r = await apiFetch<{ data: OrderRow[] }>(`/api/food/${listing.id}/orders`);
      setSellerOrders((prev) => ({ ...prev, [listing.id]: r.data }));
    } catch {
      alert("Failed to load orders");
    }
  }

  // ── Filter ──────────────────────────────────────────────────────────────────
  const filtered = listings.filter((l) => {
    if (tab === "AVAILABLE") return l.isActive && new Date(l.cutoffAt) > new Date();
    if (tab === "MY_ORDERS") return !!l.myOrder;
    if (tab === "MY_LISTINGS") return l.createdBy.id === dbUser?.id;
    return true;
  });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Food Board</h1>
          <p className="text-zinc-500 text-sm mt-1">Order food from your colleagues</p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          <UtensilsCrossed className="w-4 h-4" />
          Sell Food
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-zinc-200 p-5 space-y-4">
          <h2 className="font-semibold text-zinc-900">New Listing</h2>
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-zinc-600 mb-1">Title</label>
                <input
                  required value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Homemade Lumpia"
                  className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-zinc-600 mb-1">Description <span className="text-zinc-400 font-normal">(optional)</span></label>
                <textarea
                  value={newDesc} onChange={(e) => setNewDesc(e.target.value)} rows={2}
                  className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1">Price (₱)</label>
                <input
                  required type="number" min="1" step="0.01" value={newPrice} onChange={(e) => setNewPrice(e.target.value)}
                  placeholder="120.00"
                  className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1">Order cutoff</label>
                <input
                  required type="datetime-local" value={newCutoff} onChange={(e) => setNewCutoff(e.target.value)}
                  className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Image picker */}
            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1">Photos <span className="text-zinc-400 font-normal">(up to 3, optional)</span></label>
              <div className="flex items-center gap-2 flex-wrap">
                {imagePreviews.map((src, i) => (
                  <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden border border-zinc-200">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt="" className="w-full h-full object-cover" />
                    <button type="button" onClick={() => removeImage(i)} className="absolute top-0.5 right-0.5 bg-black/50 rounded-full p-0.5 text-white">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                {newImages.length < 3 && (
                  <label className="w-16 h-16 rounded-lg border-2 border-dashed border-zinc-300 flex flex-col items-center justify-center cursor-pointer hover:border-indigo-400 transition-colors">
                    <ImagePlus className="w-5 h-5 text-zinc-400" />
                    <span className="text-[10px] text-zinc-400 mt-0.5">Add</span>
                    <input type="file" accept="image/*" className="hidden" onChange={handleImagePick} multiple />
                  </label>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="submit" disabled={creating}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
              >
                {creating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {creating ? "Creating…" : "Post Listing"}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="text-sm text-zinc-500 hover:text-zinc-700 px-3 py-2">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2">
        {([["AVAILABLE", "Available"], ["MY_ORDERS", "My Orders"], ["MY_LISTINGS", "My Listings"]] as [Tab, string][]).map(([t, label]) => (
          <button
            key={t} onClick={() => setTab(t)}
            className={`px-3.5 py-1.5 rounded-lg text-sm font-medium border transition-all ${
              tab === t
                ? "bg-indigo-600 text-white border-indigo-600"
                : "bg-white border-zinc-200 text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Listings */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-zinc-200 overflow-hidden animate-pulse">
              <div className="h-36 bg-zinc-100" />
              <div className="p-4 space-y-2">
                <div className="h-4 bg-zinc-100 rounded w-2/3" />
                <div className="h-3 bg-zinc-100 rounded w-full" />
                <div className="h-8 bg-zinc-100 rounded-lg w-full mt-3" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border border-zinc-200 text-center">
          <UtensilsCrossed className="w-10 h-10 text-zinc-200 mb-4" />
          <p className="text-zinc-600 font-medium">Nothing here</p>
          <p className="text-zinc-400 text-sm mt-1">
            {tab === "AVAILABLE" ? "No food listings right now — be the first to post!" : "Nothing to show for this tab."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((listing) => {
            const closed = isClosed(listing);
            const isMine = listing.createdBy.id === dbUser?.id;
            const isExpanded = expandedId === listing.id;

            return (
              <div key={listing.id} className="bg-white rounded-xl border border-zinc-200 overflow-hidden flex flex-col hover:shadow-sm transition-shadow">
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
                {listing.imageUrls.length === 0 && (
                  <div className={`h-1 ${closed ? "bg-zinc-300" : "bg-emerald-500"}`} />
                )}

                <div className="p-4 flex flex-col flex-1 gap-2">
                  {/* Seller */}
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-indigo-500 flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                      {listing.createdBy.displayName.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()}
                    </div>
                    <span className="text-xs text-zinc-500">{listing.createdBy.displayName}</span>
                    <span className="ml-auto text-xs text-zinc-400">{listing._count.orders} orders</span>
                  </div>

                  {/* Title + desc */}
                  <div>
                    <h3 className="font-bold text-zinc-900 leading-snug">{listing.title}</h3>
                    {listing.description && (
                      <p className="text-sm text-zinc-500 mt-0.5 line-clamp-2">{listing.description}</p>
                    )}
                  </div>

                  {/* Price + cutoff */}
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-bold text-emerald-600">{formatPrice(listing.price)}</span>
                    <span className={`flex items-center gap-1 text-xs ${closed ? "text-zinc-400" : "text-amber-600"}`}>
                      <Clock className="w-3.5 h-3.5" />
                      {closed ? "Closed" : `By ${formatCutoff(listing.cutoffAt)}`}
                    </span>
                  </div>

                  {/* Action area */}
                  <div className="mt-auto pt-3 border-t border-zinc-100 space-y-2">
                    {closed && !isMine && (
                      <span className="text-xs font-medium text-zinc-400 bg-zinc-100 px-3 py-1.5 rounded-lg w-full block text-center">
                        Orders closed
                      </span>
                    )}

                    {!closed && !isMine && !listing.myOrder && orderingId !== listing.id && (
                      <button
                        onClick={() => { setOrderingId(listing.id); setQty(1); setOrderNote(""); }}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold py-2 rounded-lg transition-colors"
                      >
                        Order
                      </button>
                    )}

                    {/* Inline order form */}
                    {!closed && !isMine && !listing.myOrder && orderingId === listing.id && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-zinc-500 w-16 shrink-0">Quantity</label>
                          <div className="flex items-center gap-1">
                            <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} className="w-7 h-7 rounded border border-zinc-200 text-zinc-600 hover:bg-zinc-50 text-sm font-bold">−</button>
                            <span className="w-8 text-center text-sm font-semibold">{qty}</span>
                            <button type="button" onClick={() => setQty((q) => Math.min(99, q + 1))} className="w-7 h-7 rounded border border-zinc-200 text-zinc-600 hover:bg-zinc-50 text-sm font-bold">+</button>
                          </div>
                        </div>
                        <input
                          value={orderNote} onChange={(e) => setOrderNote(e.target.value)}
                          placeholder="e.g. no onions (optional)"
                          className="w-full border border-zinc-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleOrder(listing)} disabled={submittingOrder}
                            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold py-1.5 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                          >
                            {submittingOrder && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                            Confirm Order
                          </button>
                          <button onClick={() => setOrderingId(null)} className="text-sm text-zinc-500 hover:text-zinc-700 px-2">
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Existing order */}
                    {!isMine && listing.myOrder && (
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-semibold text-zinc-700">Your order: ×{listing.myOrder.quantity}</p>
                          {listing.myOrder.note && <p className="text-xs text-zinc-400">{listing.myOrder.note}</p>}
                        </div>
                        {!closed && (
                          <button onClick={() => handleCancel(listing)} className="text-xs text-red-500 hover:text-red-600 font-medium">
                            Cancel
                          </button>
                        )}
                      </div>
                    )}

                    {/* Seller view */}
                    {isMine && (
                      <div className="space-y-2">
                        <button
                          onClick={() => toggleSellerOrders(listing)}
                          className="w-full flex items-center justify-between text-sm font-medium text-zinc-700 bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 px-3 py-2 rounded-lg transition-colors"
                        >
                          <span>View Orders ({listing._count.orders})</span>
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                        {!closed && (
                          <button onClick={() => handleClose(listing)} className="w-full text-sm text-red-500 hover:text-red-600 font-medium border border-red-200 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors">
                            Close Listing
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Seller order list (expanded) */}
                {isMine && isExpanded && (
                  <div className="border-t border-zinc-100 px-4 py-3 bg-zinc-50">
                    {!sellerOrders[listing.id] ? (
                      <div className="flex justify-center py-2"><Loader2 className="w-4 h-4 animate-spin text-zinc-400" /></div>
                    ) : sellerOrders[listing.id].length === 0 ? (
                      <p className="text-xs text-zinc-400 text-center py-2">No orders yet.</p>
                    ) : (
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-zinc-400 border-b border-zinc-200">
                            <th className="text-left pb-1.5 font-medium">Name</th>
                            <th className="text-center pb-1.5 font-medium">Qty</th>
                            <th className="text-left pb-1.5 font-medium">Note</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sellerOrders[listing.id].map((o) => (
                            <tr key={o.id} className="border-b border-zinc-100 last:border-0">
                              <td className="py-1.5 font-medium text-zinc-800">{o.user.displayName}</td>
                              <td className="py-1.5 text-center text-zinc-700">×{o.quantity}</td>
                              <td className="py-1.5 text-zinc-400">{o.note ?? "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add the seller orders API endpoint**

The page calls `GET /api/food/[id]/orders` (note: `orders`, plural) to fetch the full order list for a seller. Add this export to `app/api/food/[id]/route.ts`:

```typescript
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = await verifyAuth(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const listing = await prisma.foodListing.findUnique({ where: { id } });
  if (!listing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (listing.createdById !== authUser.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const orders = await prisma.foodOrder.findMany({
    where: { listingId: id },
    include: { user: { select: { displayName: true } } },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ data: orders });
}
```

Add this to the top of `app/api/food/[id]/route.ts` — import `verifyAuth` and `prisma` are already there from Task 3.

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: No errors. If you get a Cloudinary type error, check that `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` and `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET` are in `.env.local`.

- [ ] **Step 4: Smoke test**

```bash
npm run dev
```

1. Sign in as an employee, navigate to `/food`
2. Click "Sell Food" — fill title, price, cutoff in the future, add 1 photo, submit
3. Verify the listing card appears with the photo as hero image and correct price
4. In incognito, sign in as another employee — verify listing appears under Available tab
5. Click "Order", set qty=2, add a note, confirm — verify card switches to "Your order: ×2"
6. Back as the seller — click "View Orders" — verify the order row shows buyer name, qty, note
7. Click "Close Listing" — verify the card shows "Closed" and the Order button is gone

- [ ] **Step 5: Commit**

```bash
git add "app/(dashboard)/food/page.tsx" "app/api/food/[id]/route.ts"
git commit -m "feat: add employee /food page and seller orders endpoint"
```

---

## Self-Review

**Spec coverage:**
- ✅ FoodListing + FoodOrder models — Task 1
- ✅ GET /api/food with myOrder embedded — Task 2
- ✅ POST /api/food with cutoff validation — Task 2
- ✅ PATCH /api/food/[id] owner-only close — Task 3 + GET seller orders added in Task 6 Step 2
- ✅ POST /api/food/[id]/order with 410 on closed — Task 4
- ✅ DELETE /api/food/[id]/order with 410 on closed — Task 4
- ✅ Navigation (sidebar + mobile bottomNavItems) — Task 5
- ✅ Three tabs (Available / My Orders / My Listings) — Task 6
- ✅ Hero image + thumbnail strip — Task 6
- ✅ Inline order form with qty stepper + note — Task 6
- ✅ Seller order list expanded inline with Close Listing button — Task 6
- ✅ Sell Food inline form with Cloudinary image upload (up to 3) — Task 6
- ✅ Cutoff enforcement (frontend hides button, server returns 410) — Tasks 4 + 6
- ✅ Cancellation blocked after cutoff — Task 4

**Type consistency:**
- `Listing.price` is `string` throughout (Prisma Decimal serialized as string) ✅
- `MyOrder` type used in both optimistic update and display ✅
- `OrderRow` type matches what `GET /api/food/[id]` returns (displayName on user) ✅
- `listingId_userId` compound key used consistently in Task 4 ✅
