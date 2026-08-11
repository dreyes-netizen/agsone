# Split food & admin/medicine god-files Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split `app/(dashboard)/food/page.tsx` (1380 lines) and `app/admin/medicine/page.tsx` (998 lines) into smaller, single-responsibility files with zero behavior change, closing the "AGSON-31: 5 more god-files" scope for these 2 (the ticket's own recommended minimum).

**Architecture:** Presentational extraction, not a state-ownership rewrite. Rule for every task unless a task explicitly says otherwise: **state, effects, and handlers stay declared in the parent `page.tsx` exactly as they are today (same variable names, same `setState` calls, same effect dependency arrays) — only JSX (render output) moves into new child components, which receive the state values, setters, and handlers they need as explicit props.** This eliminates the cross-section state-coupling risks identified during research (dual-write optimistic updates, shared modal triggers, cross-domain stock decrement on request approval, etc.) because nothing about *how* state is written changes — only *where the markup that reads it* lives. The only two exceptions (both explicitly called out in their tasks, both verified via full-file read that the state has zero external readers/writers) are `AddMedicineForm` (Task 9) and the two grid-open-modal handlers deduped in Task 4.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, Tailwind v4. No test runner exists in this repo (`AGSON-20 — Add automated test coverage` is a separate, not-yet-started backlog item) — every task's verification step uses `npx tsc --noEmit`, `npm run lint`, and a manual click-through in the dev server instead of automated tests, matching how every other completed refactor in this codebase (Dialog/toast migrations, lint/a11y/xlsx hardening — see `docs/superpowers/plans/2026-08-06-lint-a11y-xlsx-hardening.md`) was actually verified.

## Global Constraints

- Every extracted component file starts with `"use client";`? No — only the top-level `page.tsx` files need `"use client"` (App Router convention: a Client Component's imported children inherit client-ness without needing their own directive). Do not add `"use client"` to files under `components/`.
- Every new component is a plain named export (`export function Foo(props: FooProps) { ... }`), not `export default`, so imports read `import { Foo } from "./components/Foo"`.
- Never rename an existing state variable, setter, or handler while moving it — the diff for each task should be "code moved + import/prop wiring added," not "code moved and renamed." This keeps every task's diff mechanically verifiable against the line ranges cited below.
- No `<img>` → `next/image` conversions, no Tailwind class changes, no aria-label additions, no new error handling — this is a pure structural refactor. If you spot an unrelated bug while moving code (there is one dead-code removal flagged explicitly in Task 4 — that's the only sanctioned behavior-level change in this whole plan), leave it and note it, don't fix it here.
- After EVERY task: run `npx tsc --noEmit` (must be clean) and `npm run lint` (must show the same warning count as before the task, zero new errors) before committing.
- Commit after each task with `refactor:` prefix.

---

## Part A — `app/(dashboard)/food/page.tsx`

### Task 1: Extract shared types and pure helpers

**Files:**
- Create: `app/(dashboard)/food/types.ts`
- Create: `app/(dashboard)/food/utils.ts`
- Modify: `app/(dashboard)/food/page.tsx:20-78` (remove, replace with imports)

**Interfaces:**
- Produces: `AddOn`, `MyOrder`, `OrderRow`, `Listing`, `Tab` (exported types) from `types.ts`; `formatPrice(price: string): string`, `formatCutoff(cutoffAt: string): string`, `isClosed(listing: Listing): boolean`, `getUrgencyLabel(cutoffAt: string): string | null` (exported functions) from `utils.ts`.

- [ ] **Step 1: Create `types.ts`**

Move lines 20–55 of `page.tsx` (the `AddOn` through `Tab` type declarations) into this new file verbatim, adding `export` to each:

```ts
export type AddOn = { name: string; price: number };

export type MyOrder = {
  id: string;
  quantity: number;
  note: string | null;
  selectedAddOns: AddOn[];
  createdAt: string;
};

export type OrderRow = {
  id: string;
  quantity: number;
  note: string | null;
  selectedAddOns: AddOn[];
  paidAt: string | null;
  createdAt: string;
  user: { id: string; displayName: string; department: { name: string } | null };
};

export type Listing = {
  id: string;
  title: string;
  description: string | null;
  price: string;
  imageUrls: string[];
  cutoffAt: string;
  deliveryDate: string | null;
  addOns: AddOn[];
  isActive: boolean;
  createdBy: { id: string; displayName: string; avatarUrl: string | null };
  myOrder: MyOrder | null;
  _count: { orders: number };
};

export type Tab = "AVAILABLE" | "MY_ORDERS" | "MY_LISTINGS";
```

- [ ] **Step 2: Create `utils.ts`**

Move lines 57–78 of `page.tsx` verbatim, adding `export` to each, and import `Listing` from `./types`:

```ts
import type { Listing } from "./types";

export function formatPrice(price: string) {
  return `₱${parseFloat(price).toFixed(2)}`;
}

export function formatCutoff(cutoffAt: string) {
  return new Date(cutoffAt).toLocaleString("en-US", {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
}

export function isClosed(listing: Listing) {
  return !listing.isActive || new Date(listing.cutoffAt) <= new Date();
}

export function getUrgencyLabel(cutoffAt: string): string | null {
  const diff = new Date(cutoffAt).getTime() - Date.now();
  if (diff <= 0 || diff > 60 * 60_000) return null;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "Closes in less than a minute";
  if (minutes === 1) return "Closes in 1 min";
  return `Closes in ${minutes} min`;
}
```

- [ ] **Step 3: Update `page.tsx`**

Delete lines 20–78 (the type + helper block). Add after the existing `import { Dialog, DialogContent } from "@/components/ui/dialog";` line:

```ts
import type { AddOn, MyOrder, OrderRow, Listing, Tab } from "./types";
import { formatPrice, formatCutoff, isClosed, getUrgencyLabel } from "./utils";
```

- [ ] **Step 4: Verify**

Run `npx tsc --noEmit` — expect clean (no errors referencing `food/page.tsx`). Run `npm run lint` — expect no new errors. The Food Board page isn't rendered differently yet — this task is pure code motion, no visual check needed.

- [ ] **Step 5: Commit**

```bash
git add "app/(dashboard)/food/types.ts" "app/(dashboard)/food/utils.ts" "app/(dashboard)/food/page.tsx"
git commit -m "refactor: extract food page types and helpers to sibling files"
```

---

### Task 2: Extract `ListingFormPanel` (create/edit listing form)

**Files:**
- Create: `app/(dashboard)/food/components/ListingFormPanel.tsx`
- Modify: `app/(dashboard)/food/page.tsx:418-556` (replace with component usage)

**Interfaces:**
- Consumes: `AddOn`, `Listing` types from `../types` (only `AddOn` needed directly; the panel never receives a full `Listing`).
- Produces: `ListingFormPanel` component, rendered only when `showForm` is true (parent keeps the `{showForm && (...)}` gate — the component itself assumes it's always "open" while mounted).

- [ ] **Step 1: Create the component**

```tsx
import type { AddOn } from "../types";
import { X, ImagePlus, Plus, Loader2 } from "lucide-react";

interface ListingFormPanelProps {
  editingId: string | null;
  newTitle: string;
  onTitleChange: (value: string) => void;
  newDesc: string;
  onDescChange: (value: string) => void;
  newPrice: string;
  onPriceChange: (value: string) => void;
  newCutoff: string;
  onCutoffChange: (value: string) => void;
  newDeliveryDate: string;
  onDeliveryDateChange: (value: string) => void;
  existingImageUrls: string[];
  imagePreviews: string[];
  totalImages: number;
  onImagePick: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveExistingImage: (idx: number) => void;
  onRemoveNewImage: (idx: number) => void;
  newAddOns: AddOn[];
  addOnName: string;
  onAddOnNameChange: (value: string) => void;
  addOnPrice: string;
  onAddOnPriceChange: (value: string) => void;
  onAddAddOn: () => void;
  onRemoveAddOn: (idx: number) => void;
  creating: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
}

export function ListingFormPanel(props: ListingFormPanelProps) {
  const {
    editingId, newTitle, onTitleChange, newDesc, onDescChange, newPrice, onPriceChange,
    newCutoff, onCutoffChange, newDeliveryDate, onDeliveryDateChange,
    existingImageUrls, imagePreviews, totalImages, onImagePick, onRemoveExistingImage, onRemoveNewImage,
    newAddOns, addOnName, onAddOnNameChange, addOnPrice, onAddOnPriceChange, onAddAddOn, onRemoveAddOn,
    creating, onSubmit, onCancel,
  } = props;

  return (
    <div className="bg-white rounded-card border border-table-border p-5 space-y-4">
      {/* paste page.tsx:421-554 verbatim here, replacing every reference as follows: */}
      {/* newTitle -> newTitle, setNewTitle(e.target.value) -> onTitleChange(e.target.value) */}
      {/* newDesc -> newDesc, setNewDesc(e.target.value) -> onDescChange(e.target.value) */}
      {/* newPrice -> newPrice, setNewPrice(e.target.value) -> onPriceChange(e.target.value) */}
      {/* newCutoff -> newCutoff, setNewCutoff(e.target.value) -> onCutoffChange(e.target.value) */}
      {/* newDeliveryDate -> newDeliveryDate, setNewDeliveryDate(e.target.value) -> onDeliveryDateChange(e.target.value) */}
      {/* existingImageUrls, imagePreviews, totalImages -> unchanged (read-only here) */}
      {/* handleImagePick -> onImagePick, removeExistingImage -> onRemoveExistingImage, removeNewImage -> onRemoveNewImage */}
      {/* newAddOns, addOnName, addOnPrice -> unchanged */}
      {/* setAddOnName(e.target.value) -> onAddOnNameChange(e.target.value), setAddOnPrice(e.target.value) -> onAddOnPriceChange(e.target.value) */}
      {/* addAddOn -> onAddAddOn, removeAddOn -> onRemoveAddOn */}
      {/* onSubmit={handleSubmit} -> onSubmit={onSubmit} (the <form> tag's own prop, keep the name "onSubmit" — no change needed) */}
      {/* creating -> unchanged */}
      {/* onClick={resetForm} (Cancel button) -> onClick={onCancel} */}
    </div>
  );
}
```

Do the actual paste-and-replace now: copy `page.tsx` lines 421–554 (the `<h2>` through the closing `</form>`) into the JSX body above, applying every substitution listed in the comments, then delete the comment block. The result is ~140 lines of JSX identical to the original except for the prop-name swaps.

- [ ] **Step 2: Update `page.tsx`**

Replace lines 418–556 with:

```tsx
{/* Create / edit form */}
{showForm && (
  <ListingFormPanel
    editingId={editingId}
    newTitle={newTitle}
    onTitleChange={setNewTitle}
    newDesc={newDesc}
    onDescChange={setNewDesc}
    newPrice={newPrice}
    onPriceChange={setNewPrice}
    newCutoff={newCutoff}
    onCutoffChange={setNewCutoff}
    newDeliveryDate={newDeliveryDate}
    onDeliveryDateChange={setNewDeliveryDate}
    existingImageUrls={existingImageUrls}
    imagePreviews={imagePreviews}
    totalImages={totalImages}
    onImagePick={handleImagePick}
    onRemoveExistingImage={removeExistingImage}
    onRemoveNewImage={removeNewImage}
    newAddOns={newAddOns}
    addOnName={addOnName}
    onAddOnNameChange={setAddOnName}
    addOnPrice={addOnPrice}
    onAddOnPriceChange={setAddOnPrice}
    onAddAddOn={addAddOn}
    onRemoveAddOn={removeAddOn}
    creating={creating}
    onSubmit={handleSubmit}
    onCancel={resetForm}
  />
)}
```

Add the import: `import { ListingFormPanel } from "./components/ListingFormPanel";`

- [ ] **Step 3: Verify**

`npx tsc --noEmit`, `npm run lint` — both clean. Manual check: `npm run dev`, open `/food`, click "Sell Food" — form appears. Type a title/price/cutoff, add an image, add an add-on (name + price + Enter), remove it, submit — listing should be created exactly as before. Click "Cancel" — form closes and clears.

- [ ] **Step 4: Commit**

```bash
git add "app/(dashboard)/food/components/ListingFormPanel.tsx" "app/(dashboard)/food/page.tsx"
git commit -m "refactor: extract ListingFormPanel from food page"
```

---

### Task 3: Extract `SellerOrdersPanel` (expanded per-listing order list)

**Files:**
- Create: `app/(dashboard)/food/components/SellerOrdersPanel.tsx`
- Modify: `app/(dashboard)/food/page.tsx:864-979` (replace with component usage)

**Interfaces:**
- Consumes: `OrderRow`, `formatPrice` from `../types` / `../utils`.
- Produces: `SellerOrdersPanel` component, rendered only when `isMine && isExpanded` (parent keeps that gate).

- [ ] **Step 1: Create the component**

```tsx
import { Loader2 } from "lucide-react";
import type { OrderRow } from "../types";
import { formatPrice } from "../utils";

interface SellerOrdersPanelProps {
  listingPrice: string;
  orders: OrderRow[] | undefined;
  onTogglePaid: (orderId: string, paid: boolean) => void;
  onViewUser: (userId: string) => void;
}

export function SellerOrdersPanel({ listingPrice, orders, onTogglePaid, onViewUser }: SellerOrdersPanelProps) {
  return (
    <div className="border-t border-gray-100 bg-gray-50">
      {/* paste page.tsx:867-977 verbatim here, replacing: */}
      {/* sellerOrders[listing.id] -> orders (the prop) everywhere it's read */}
      {/* listing.price -> listingPrice */}
      {/* router.push(`/employees/${o.user.id}`) (in the onClick at ~934) -> onViewUser(o.user.id) */}
      {/* togglePaid(listing.id, o.id, !isPaid) (~961) -> onTogglePaid(o.id, !isPaid) */}
      {/* e.stopPropagation() calls: DROP them — this component is no longer nested inside the whole-card onClick handler in a way that requires stopping propagation; the card's onClick is on FoodListingCard's outer div (Task 4), and this panel is a sibling section below it, not inside the clickable area. Keep aria-labels, classNames, and all formatting untouched. */}
    </div>
  );
}
```

Do the paste-and-replace: copy lines 867–977, apply the substitutions, delete the comment block. Keep the loading (`<Loader2 .../>`), empty (`No orders yet.`), and populated (summary bar / add-on breakdown / order rows) branches exactly as they are, just reading `orders` instead of `sellerOrders[listing.id]`.

**Note on `e.stopPropagation()`:** verify by reading `FoodListingCard.tsx` after Task 4 that the seller-orders section is NOT inside any element with an `onClick` that would be triggered by a click bubbling up from inside this panel. Per the current file, the outer card `onClick` (line 614 original) is on the div at line 612, and the seller-orders block (864-979) is a sibling of the "inner row" div (619-862), not nested inside it — so no click inside this panel can reach the card's `onClick` even without `stopPropagation`. This is safe to drop. If in doubt, keep the `stopPropagation()` calls — it's a no-op either way, just extra caution.

- [ ] **Step 2: Update `page.tsx`**

Replace lines 864–979 with:

```tsx
{/* Seller order list (expanded) — always full width */}
{isMine && isExpanded && (
  <SellerOrdersPanel
    listingPrice={listing.price}
    orders={sellerOrders[listing.id]}
    onTogglePaid={(orderId, paid) => togglePaid(listing.id, orderId, paid)}
    onViewUser={(userId) => router.push(`/employees/${userId}`)}
  />
)}
```

Add the import: `import { SellerOrdersPanel } from "./components/SellerOrdersPanel";`

- [ ] **Step 3: Verify**

`npx tsc --noEmit`, `npm run lint` — clean. Manual check: on `/food`, find a listing you created (or create one), click "View Orders" — panel expands showing the summary bar / order rows (or "No orders yet."). If there's an order, click "Mark paid" / "Undo" — badge and outstanding total update.

- [ ] **Step 4: Commit**

```bash
git add "app/(dashboard)/food/components/SellerOrdersPanel.tsx" "app/(dashboard)/food/page.tsx"
git commit -m "refactor: extract SellerOrdersPanel from food page"
```

---

### Task 4: Extract `FoodListingCard` (grid card) + dedupe modal-open handlers

**Files:**
- Create: `app/(dashboard)/food/components/FoodListingCard.tsx`
- Modify: `app/(dashboard)/food/page.tsx:260-268` (add `openDetail`, simplify `openEditOrder`), `page.tsx:605-985` (replace card JSX with component usage)

**Interfaces:**
- Consumes: `Listing`, `OrderRow` types, `formatPrice`/`formatCutoff`/`isClosed` from `../utils`, `SellerOrdersPanel` from `./SellerOrdersPanel`.
- Produces: `FoodListingCard` component; two new/changed parent handlers `openDetail(listing)` and `openOrderModal(listing)`.

**Dead-code note (the one sanctioned behavior-level change in this plan):** lines 608–609 of the original (`const addOnsTotal = ...; const orderTotal = ...;` inside the grid `.map`) are computed but never read anywhere in lines 611–980 — confirmed via `grep -n "orderTotal\|addOnsTotal"` returning only the modal's separate copy (lines 1008–1009, which *is* used, at 1187/1237) as consumers. Drop these two lines when extracting; do not carry `qty`/`selectedAddOns` into `FoodListingCard`'s props for this reason, since nothing in the card needs them.

- [ ] **Step 1: Add `openDetail` and simplify call sites in `page.tsx`**

The original has the same 2-line "seed the modal" logic duplicated 3 times (lines 614, 712, 762–767) plus once more inside `openEditOrder` (265–266). Add one new function right before `openEditOrder` (before line 260):

```ts
function openDetail(listing: Listing) {
  setSelectedListing(listing);
  setSelectedListingImageIndex(cardImageIndices[listing.id] ?? 0);
}

function openOrderModal(listing: Listing) {
  openDetail(listing);
  setQty(1);
  setOrderNote("");
  setSelectedAddOns([]);
  setModalOrderMode("order");
}
```

Then simplify the existing `openEditOrder` (lines 260–268) to reuse `openDetail`:

```ts
function openEditOrder(listing: Listing) {
  if (!listing.myOrder) return;
  setQty(listing.myOrder.quantity);
  setOrderNote(listing.myOrder.note ?? "");
  setSelectedAddOns(listing.myOrder.selectedAddOns ?? []);
  openDetail(listing);
  setModalOrderMode("edit");
}
```

This is behavior-identical (same 5 `setState` calls in the same order, just the last two lines replaced by a call to the new shared helper) — confirm by re-reading the diff line-by-line before moving on.

- [ ] **Step 2: Create `FoodListingCard.tsx`**

```tsx
import { useState } from "react";
import { UtensilsCrossed, Clock, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Pencil, Truck, RefreshCw } from "lucide-react";
import type { Listing } from "../types";
import { formatPrice, formatCutoff, isClosed } from "../utils";
import { SellerOrdersPanel } from "./SellerOrdersPanel";

interface FoodListingCardProps {
  listing: Listing;
  currentUserId: string | undefined;
  cardImageIndex: number;
  onImageIndexChange: (index: number) => void;
  isExpanded: boolean;
  sellerOrders: import("../types").OrderRow[] | undefined;
  onOpenDetail: (listing: Listing) => void;
  onOpenOrder: (listing: Listing) => void;
  onOpenEditOrder: (listing: Listing) => void;
  onCancelOrder: (listing: Listing) => void;
  onToggleSellerOrders: (listing: Listing) => void;
  onTogglePaid: (listingId: string, orderId: string, paid: boolean) => void;
  onEdit: (listing: Listing) => void;
  onCloseListing: (listing: Listing) => void;
  onSellAgain: (listing: Listing) => void;
  onDelete: (listing: Listing) => void;
  onViewUser: (userId: string) => void;
}

export function FoodListingCard(props: FoodListingCardProps) {
  const {
    listing, currentUserId, cardImageIndex, onImageIndexChange, isExpanded, sellerOrders,
    onOpenDetail, onOpenOrder, onOpenEditOrder, onCancelOrder, onToggleSellerOrders, onTogglePaid,
    onEdit, onCloseListing, onSellAgain, onDelete, onViewUser,
  } = props;

  const closed = isClosed(listing);
  const isMine = listing.createdBy.id === currentUserId;

  return (
    <div
      onClick={() => onOpenDetail(listing)}
      className="bg-white rounded-card border border-table-border overflow-hidden flex flex-col transition-shadow cursor-pointer"
    >
      {/* paste page.tsx:619-862 verbatim here ("inner row" div through its closing tag), replacing: */}
      {/* cardImageIndices[listing.id] ?? 0 -> cardImageIndex */}
      {/* setCardImageIndices((prev) => ({ ...prev, [listing.id]: i })) (the local `setIdx` at ~625) -> onImageIndexChange(i) */}
      {/* router.push(`/employees/${listing.createdBy.id}`) (~692) -> onViewUser(listing.createdBy.id) */}
      {/* onClick={() => { setSelectedListing(listing); setSelectedListingImageIndex(...); }} on the title button (~712) -> onClick={(e) => { e.stopPropagation(); onOpenDetail(listing); }} */}
      {/* the "Order" button onClick (~762-767) -> onClick={(e) => { e.stopPropagation(); onOpenOrder(listing); }} */}
      {/* openEditOrder(listing) (~798) -> onOpenEditOrder(listing) */}
      {/* handleCancel(listing) (~805) -> onCancelOrder(listing) */}
      {/* toggleSellerOrders(listing) (~820) -> onToggleSellerOrders(listing) */}
      {/* handleEdit(listing) (~830) -> onEdit(listing) */}
      {/* handleClose(listing) (~837) -> onCloseListing(listing) */}
      {/* handleSellAgain(listing) (~846) -> onSellAgain(listing) */}
      {/* handleDelete(listing) (~853) -> onDelete(listing) */}
      {/* DROP lines equivalent to original 608-609 (addOnsTotal/orderTotal) -- they were never referenced in this range */}

      {isMine && isExpanded && (
        <SellerOrdersPanel
          listingPrice={listing.price}
          orders={sellerOrders}
          onTogglePaid={(orderId, paid) => onTogglePaid(listing.id, orderId, paid)}
          onViewUser={onViewUser}
        />
      )}
    </div>
  );
}
```

Remove the unused `useState` import if the pasted body doesn't end up needing it (the original card body has no local `useState` — it only used `cardImageIndices` from the parent — so drop that import; it's listed above only as a placeholder reminder, delete it once you confirm no local state is needed).

- [ ] **Step 3: Update `page.tsx`**

Replace the entire `.map` body (lines 604–985, from `const closed = isClosed(listing);` through the closing `);` and `})}` of the `filtered.map(...)` call — keep the `filtered.map((listing) => (` opening and the final `))}` closing, replace everything in between) with:

```tsx
{filtered.map((listing) => (
  <FoodListingCard
    key={listing.id}
    listing={listing}
    currentUserId={dbUser?.id}
    cardImageIndex={cardImageIndices[listing.id] ?? 0}
    onImageIndexChange={(i) => setCardImageIndices((prev) => ({ ...prev, [listing.id]: i }))}
    isExpanded={expandedId === listing.id}
    sellerOrders={sellerOrders[listing.id]}
    onOpenDetail={openDetail}
    onOpenOrder={openOrderModal}
    onOpenEditOrder={openEditOrder}
    onCancelOrder={handleCancel}
    onToggleSellerOrders={toggleSellerOrders}
    onTogglePaid={togglePaid}
    onEdit={handleEdit}
    onCloseListing={handleClose}
    onSellAgain={handleSellAgain}
    onDelete={handleDelete}
    onViewUser={(userId) => router.push(`/employees/${userId}`)}
  />
))}
```

Add the import: `import { FoodListingCard } from "./components/FoodListingCard";`

- [ ] **Step 4: Verify**

`npx tsc --noEmit`, `npm run lint` — clean. Manual check on `/food`: grid renders all listings with images/carousels working (prev/next arrows, dot indicators). Click a card (not on a button) — detail modal opens on the right image index. As the listing owner: click "View Orders" (from Task 3's verification, still works), "Edit", "Close", "Sell Again", "Delete listing" — each still does what it did before. As a non-owner with no order: click "Order" — modal opens in order mode. As a non-owner with an existing order: "Edit order" / "Cancel order" on the card — both still work.

- [ ] **Step 5: Commit**

```bash
git add "app/(dashboard)/food/components/FoodListingCard.tsx" "app/(dashboard)/food/page.tsx"
git commit -m "refactor: extract FoodListingCard, dedupe modal-open handlers, drop dead orderTotal calc"
```

---

### Task 5: Extract `OrderFormFields` (shared quantity/add-ons/note fields)

**Files:**
- Create: `app/(dashboard)/food/components/OrderFormFields.tsx`
- Modify: `app/(dashboard)/food/page.tsx:1153-1188` and `page.tsx:1320-1355` (both replaced with component usage)

**Interfaces:**
- Consumes: `AddOn` type from `../types`.
- Produces: `OrderFormFields` component, used by both the inline "order" flow and the "edit order" flow inside the still-inline Dialog (this task does NOT move the Dialog itself — that's Task 6).

**Why this exists:** lines 1153–1188 (inline order form) and lines 1320–1355 (edit order form) are near-identical JSX — same quantity stepper, same add-ons checkbox list, same note input, same total line — differing only in the buttons that wrap them (which stay at each call site, untouched).

- [ ] **Step 1: Create the component**

```tsx
import type { AddOn } from "../types";

interface OrderFormFieldsProps {
  addOns: AddOn[];
  qty: number;
  onQtyChange: (qty: number) => void;
  selectedAddOns: AddOn[];
  onSelectedAddOnsChange: (addOns: AddOn[]) => void;
  note: string;
  onNoteChange: (note: string) => void;
  total: number;
}

export function OrderFormFields(props: OrderFormFieldsProps) {
  const { addOns, qty, onQtyChange, selectedAddOns, onSelectedAddOnsChange, note, onNoteChange, total } = props;

  return (
    <>
      {/* paste page.tsx:1153-1188 verbatim here, replacing: */}
      {/* setQty((q) => Math.max(1, q - 1)) -> onQtyChange(Math.max(1, qty - 1)) */}
      {/* setQty((q) => Math.min(99, q + 1)) -> onQtyChange(Math.min(99, qty + 1)) */}
      {/* qty (the {qty} span) -> qty (prop, unchanged reference) */}
      {/* selectedListing.addOns (~1164) -> addOns (prop) */}
      {/* selectedAddOns.some(...) / setSelectedAddOns((prev) => ...) (~1165-1170) -> read selectedAddOns prop; call onSelectedAddOnsChange(checked ? [...selectedAddOns, a] : selectedAddOns.filter((s) => s.name !== a.name)) */}
      {/* orderNote -> note, setOrderNote(e.target.value) -> onNoteChange(e.target.value) */}
      {/* orderTotal (~1187) -> total (prop) */}
    </>
  );
}
```

Do the paste-and-replace now.

- [ ] **Step 2: Update `page.tsx` — inline order form call site (lines 1150–1201)**

Replace lines 1153–1188 (keep the outer `{!closed && !isMine && !hasOrder && modalOrderMode === "order" && (<div className="space-y-3">` wrapper and the "Review Order"/"Cancel" buttons at 1189–1199 exactly as they are) with:

```tsx
<OrderFormFields
  addOns={selectedListing.addOns ?? []}
  qty={qty}
  onQtyChange={setQty}
  selectedAddOns={selectedAddOns}
  onSelectedAddOnsChange={setSelectedAddOns}
  note={orderNote}
  onNoteChange={setOrderNote}
  total={orderTotal}
/>
```

- [ ] **Step 3: Update `page.tsx` — edit order form call site (lines 1317–1370)**

Replace lines 1320–1355 (keep the outer wrapper and the "Save Changes"/"Cancel" buttons at 1356–1367 exactly as they are) with:

```tsx
<OrderFormFields
  addOns={selectedListing.addOns ?? []}
  qty={qty}
  onQtyChange={setQty}
  selectedAddOns={selectedAddOns}
  onSelectedAddOnsChange={setSelectedAddOns}
  note={orderNote}
  onNoteChange={setOrderNote}
  total={(parseFloat(selectedListing.price) + selectedAddOns.reduce((s, a) => s + a.price, 0)) * qty}
/>
```

Note this call site keeps its own original total expression (recomputed inline, same formula as `orderTotal` but written out again) rather than switching to the outer `orderTotal` variable — that preserves the exact original behavior (both are numerically identical, but this task doesn't unify them; that would be a separate, out-of-scope cleanup).

Add the import: `import { OrderFormFields } from "./components/OrderFormFields";`

- [ ] **Step 4: Verify**

`npx tsc --noEmit`, `npm run lint` — clean. Manual check: open a listing's detail modal, click "Order" — quantity stepper, add-on checkboxes, note field, and total all work and update live. Click "Review Order" — confirm screen shows the right total. Go back, then as a listing you've already ordered, click "Edit order" — same fields populate from the existing order and "Save Changes" works.

- [ ] **Step 5: Commit**

```bash
git add "app/(dashboard)/food/components/OrderFormFields.tsx" "app/(dashboard)/food/page.tsx"
git commit -m "refactor: extract shared OrderFormFields, dedupe inline/edit order forms"
```

---

### Task 6: Extract `FoodListingDetailModal` (the Dialog)

**Files:**
- Create: `app/(dashboard)/food/components/FoodListingDetailModal.tsx`
- Modify: `app/(dashboard)/food/page.tsx:996-1377` (replace with component usage)

**Interfaces:**
- Consumes: `Listing`, `AddOn` types, `formatPrice`/`formatCutoff`/`isClosed`/`getUrgencyLabel` from `../utils`, `OrderFormFields` from `./OrderFormFields`, `Dialog`/`DialogContent` from `@/components/ui/dialog`.
- Produces: `FoodListingDetailModal` component, always mounted in `page.tsx` (it owns its own `open` state via the `listing` prop being non-null).

- [ ] **Step 1: Create the component**

```tsx
import { Clock, AlertTriangle, Truck, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import type { Listing, AddOn } from "../types";
import { formatPrice, formatCutoff, isClosed, getUrgencyLabel } from "../utils";
import { OrderFormFields } from "./OrderFormFields";

interface FoodListingDetailModalProps {
  listing: Listing | null;
  imageIndex: number;
  onImageIndexChange: (index: number) => void;
  onOpenLightbox: (images: string[], index: number) => void;
  onClose: () => void;
  onViewSeller: (userId: string) => void;
  currentUserId: string | undefined;
  orderMode: "order" | "edit" | "confirm" | null;
  qty: number;
  setQty: React.Dispatch<React.SetStateAction<number>>;
  orderNote: string;
  setOrderNote: React.Dispatch<React.SetStateAction<string>>;
  selectedAddOns: AddOn[];
  setSelectedAddOns: React.Dispatch<React.SetStateAction<AddOn[]>>;
  submittingOrder: boolean;
  onStartOrder: () => void;
  onReviewOrder: () => void;
  onBackToOrderForm: () => void;
  onPlaceOrder: (listing: Listing) => void;
  onStartEditOrder: () => void;
  onCancelOrderEdit: () => void;
  onUpdateOrder: (listing: Listing) => void;
  onCancelOrder: (listing: Listing) => void;
}

export function FoodListingDetailModal(props: FoodListingDetailModalProps) {
  const {
    listing, imageIndex, onImageIndexChange, onOpenLightbox, onClose, onViewSeller, currentUserId,
    orderMode, qty, setQty, orderNote, setOrderNote, selectedAddOns, setSelectedAddOns, submittingOrder,
    onStartOrder, onReviewOrder, onBackToOrderForm, onPlaceOrder, onStartEditOrder, onCancelOrderEdit,
    onUpdateOrder, onCancelOrder,
  } = props;

  return (
    <Dialog open={!!listing} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        className="max-w-md max-h-[85vh] p-0 rounded-2xl overflow-hidden flex flex-col"
        aria-labelledby={listing ? "food-modal-title" : undefined}
      >
        {listing && (() => {
          const closed = isClosed(listing);
          const isMine = listing.createdBy.id === currentUserId;
          const hasOrder = !!listing.myOrder;
          const addOnsTotal = selectedAddOns.reduce((s, a) => s + a.price, 0);
          const orderTotal = (parseFloat(listing.price) + addOnsTotal) * qty;
          const urgency = !closed ? getUrgencyLabel(listing.cutoffAt) : null;

          return (
            <div className="overflow-y-auto scrollbar-hide flex-1 rounded-2xl">
              {/* paste page.tsx:1016-1370 verbatim here, replacing every occurrence of: */}
              {/* selectedListing -> listing */}
              {/* selectedListingImageIndex -> imageIndex; setSelectedListingImageIndex(...) -> onImageIndexChange(...) */}
              {/* setLightbox({ images: ..., index: ... }) (~1025) -> onOpenLightbox(listing.imageUrls, imageIndex) */}
              {/* setSelectedListing(null); setModalOrderMode(null); router.push(...) (~1076) -> onViewSeller(listing.createdBy.id) then onClose() is NOT needed separately -- call onClose() then onViewSeller(listing.createdBy.id), matching the original's "close modal, then navigate" order */}
              {/* modalOrderMode -> orderMode (read-only in this file) */}
              {/* the "Order" button onClick (~1143) -> onClick={onStartOrder} */}
              {/* the inline order-form block (~1150-1201): replace its fields sub-block with <OrderFormFields addOns={listing.addOns ?? []} qty={qty} onQtyChange={setQty} selectedAddOns={selectedAddOns} onSelectedAddOnsChange={setSelectedAddOns} note={orderNote} onNoteChange={setOrderNote} total={orderTotal} /> (this is Task 5's already-extracted usage -- just carry it over unchanged since Task 5 already rewrote this call site in page.tsx) */}
              {/* setModalOrderMode("confirm") (~1191, "Review Order" button) -> onClick={onReviewOrder} */}
              {/* setModalOrderMode("order") (~1242, "Back" button in confirm step) -> onClick={onBackToOrderForm} */}
              {/* handleOrder(selectedListing) (~1249) -> onPlaceOrder(listing) */}
              {/* the "Edit order" link in the existing-order summary (~1294-1299) -> onClick={onStartEditOrder} */}
              {/* handleCancel(selectedListing) (~1306) -> onCancelOrder(listing) */}
              {/* the edit-order-form block (~1317-1370): carry over Task 5's already-extracted OrderFormFields usage unchanged */}
              {/* handleUpdateOrder(selectedListing) (~1358) -> onUpdateOrder(listing) */}
              {/* setModalOrderMode(null) (~1196 and ~1365, both "Cancel" buttons inside order/edit forms) -> onClick={onCancelOrderEdit} */}
            </div>
          );
        })()}
      </DialogContent>
    </Dialog>
  );
}
```

Do the paste-and-replace now, following every substitution comment. The result should be structurally identical to the original Dialog content, just reading from props instead of parent closure variables.

- [ ] **Step 2: Update `page.tsx`**

Replace lines 996–1377 with:

```tsx
<FoodListingDetailModal
  listing={selectedListing}
  imageIndex={selectedListingImageIndex}
  onImageIndexChange={setSelectedListingImageIndex}
  onOpenLightbox={(images, index) => setLightbox({ images, index })}
  onClose={() => { setSelectedListing(null); setModalOrderMode(null); }}
  onViewSeller={(userId) => router.push(`/employees/${userId}`)}
  currentUserId={dbUser?.id}
  orderMode={modalOrderMode}
  qty={qty}
  setQty={setQty}
  orderNote={orderNote}
  setOrderNote={setOrderNote}
  selectedAddOns={selectedAddOns}
  setSelectedAddOns={setSelectedAddOns}
  submittingOrder={submittingOrder}
  onStartOrder={() => { setModalOrderMode("order"); setQty(1); setOrderNote(""); setSelectedAddOns([]); }}
  onReviewOrder={() => setModalOrderMode("confirm")}
  onBackToOrderForm={() => setModalOrderMode("order")}
  onPlaceOrder={handleOrder}
  onStartEditOrder={() => {
    if (!selectedListing?.myOrder) return;
    setQty(selectedListing.myOrder.quantity);
    setOrderNote(selectedListing.myOrder.note ?? "");
    setSelectedAddOns(selectedListing.myOrder.selectedAddOns ?? []);
    setModalOrderMode("edit");
  }}
  onCancelOrderEdit={() => setModalOrderMode(null)}
  onUpdateOrder={handleUpdateOrder}
  onCancelOrder={handleCancel}
/>
```

Note `onViewSeller` above navigates directly (`router.push`) without first calling `setSelectedListing(null)` — re-check against the ORIGINAL line 1076 (`onClick={() => { setSelectedListing(null); setModalOrderMode(null); router.push(...); }}`): the original clears the modal state before navigating. Since we're navigating away from the page entirely, whether the modal state is cleared first is not user-visible (the page unmounts), but to be exactly behavior-preserving, wire it as `onViewSeller={(userId) => { setSelectedListing(null); setModalOrderMode(null); router.push(`/employees/${userId}`); }}` instead of the simpler version above — use this corrected version.

Add the import: `import { FoodListingDetailModal } from "./components/FoodListingDetailModal";`

- [ ] **Step 3: Verify**

`npx tsc --noEmit`, `npm run lint` — clean. Manual full click-through of `/food`: open a listing's modal (image carousel + lightbox zoom, seller link, description, add-ons list, cutoff/urgency chip, delivery date). Full order flow: Order → fill quantity/add-ons/note → Review Order → Back → Place Order → toast success → card and modal both reflect the new order. Edit order → change quantity → Save Changes → updates. Cancel order → confirmed removed. Close the modal (X, Escape, backdrop click) — closes cleanly, reopening a different listing shows fresh state (no stale `modalOrderMode` bleeding across listings).

- [ ] **Step 4: Commit**

```bash
git add "app/(dashboard)/food/components/FoodListingDetailModal.tsx" "app/(dashboard)/food/page.tsx"
git commit -m "refactor: extract FoodListingDetailModal from food page"
```

---

### Task 7: Final food page cleanup + full verification

**Files:**
- Modify: `app/(dashboard)/food/page.tsx` (import cleanup only)

- [ ] **Step 1: Remove now-unused imports**

After Tasks 1–6, `page.tsx` no longer renders most of the JSX that used `UtensilsCrossed`, `X`, `ChevronDown/Up/Left/Right`, `ImagePlus`, `Pencil`, `Plus`, `AlertTriangle`, `Truck`, `RefreshCw` directly (they moved into the new component files) — it still needs `UtensilsCrossed` (header + empty state) and `Loader2` (loading skeleton). Run `npx tsc --noEmit` and `npm run lint` — ESLint's `no-unused-vars` will flag exactly which lucide-react imports are no longer used in `page.tsx`; delete those from the import line at the top of the file. Do the same check for the `Dialog`/`DialogContent` import (now unused in `page.tsx` — those moved into `FoodListingDetailModal.tsx`) and the `dynamic`/`ImageLightbox` import (still needed — the `<ImageLightbox>` render, lines 987–994 of the original, was NOT moved in this plan and stays in `page.tsx`).

- [ ] **Step 2: Confirm final line count**

Run `wc -l "app/(dashboard)/food/page.tsx"` — expect roughly 250–320 lines (down from 1380), holding: imports, state declarations, `load`/`handleImagePick`/`removeNewImage`/`removeExistingImage`/`addAddOn`/`removeAddOn`/`resetForm`/`handleEdit`/`handleSubmit`/`handleOrder`/`openDetail`/`openOrderModal`/`openEditOrder`/`handleUpdateOrder`/`handleCancel`/`togglePaid`/`handleSellAgain`/`handleDelete`/`handleClose`/`toggleSellerOrders` function bodies, the `filtered`/`totalImages` derivations, the header, the `ListingFormPanel` usage, the tabs, the loading/empty/grid-of-`FoodListingCard` states, the `ImageLightbox` render, and the `FoodListingDetailModal` usage.

- [ ] **Step 3: Full verification pass**

```bash
npx tsc --noEmit
npm run lint
npm run build
```

All three must succeed with the lint warning count unchanged from before Task 1 (check `npm run lint`'s summary line before/after). Then `npm run dev` and re-run the full manual click-through from Task 6's Step 3 one more time end-to-end (fresh listing creation → edit → sell again → close → delete; order → edit order → cancel order; seller's View Orders → mark paid) to catch any cross-task integration issue that a single task's narrower check might have missed.

- [ ] **Step 4: Commit**

```bash
git add "app/(dashboard)/food/page.tsx"
git commit -m "refactor: clean up unused imports after food page split"
```

---

## Part B — `app/admin/medicine/page.tsx`

### Task 8: Extract shared types

**Files:**
- Create: `app/admin/medicine/types.ts`
- Modify: `app/admin/medicine/page.tsx:14-51` (remove, replace with import)

**Interfaces:**
- Produces: `Medicine`, `MedicineRequest`, `AddForm`, `EditForm` (exported types).

**Explicitly out of scope:** `app/(dashboard)/medicine/page.tsx` (the employee-facing page) independently defines its own, slightly different `Medicine` and `MyRequest` types. Reconciling those with this file's types is a separate, larger concern (shared `lib/types/medicine.ts` + updating both consumers) — not part of AGSON-31's god-file split. Do not touch `app/(dashboard)/medicine/page.tsx` in this task.

- [ ] **Step 1: Create `types.ts`**

Move lines 14–51 verbatim, adding `export`:

```ts
export type Medicine = {
  id: string;
  name: string;
  imageUrl: string;
  caption: string;
  stockQuantity: number;
  isActive: boolean;
};

export type MedicineRequest = {
  id: string;
  quantity: number;
  status: "PENDING" | "APPROVED" | "REJECTED";
  notes: string;
  createdAt: string;
  approvedAt?: string | null;
  user: { id: string; displayName: string; avatarUrl?: string | null };
  medicine: { id: string; name: string; imageUrl?: string | null };
  approvedBy?: { id: string; displayName: string } | null;
};

export type AddForm = {
  name: string;
  caption: string;
  stockQuantity: string;
  imageFile: File | null;
  imagePreview: string;
};

export type EditForm = {
  name: string;
  caption: string;
  stockQuantity: string;
  imageUrl: string;
  imageFile: File | null;
  imagePreview: string;
  isActive: boolean;
};
```

- [ ] **Step 2: Update `page.tsx`**

Delete lines 14–51. Add after the existing constants imports (after line 12):

```ts
import type { Medicine, MedicineRequest, AddForm, EditForm } from "./types";
```

- [ ] **Step 3: Verify**

`npx tsc --noEmit`, `npm run lint` — clean. Pure code motion, no visual check needed.

- [ ] **Step 4: Commit**

```bash
git add "app/admin/medicine/types.ts" "app/admin/medicine/page.tsx"
git commit -m "refactor: extract admin medicine page types to sibling file"
```

---

### Task 9: Extract `AddMedicineForm` (fully self-contained — state moves too)

**Files:**
- Create: `app/admin/medicine/components/AddMedicineForm.tsx`
- Modify: `app/admin/medicine/page.tsx` — remove `showAddForm`/`addForm`/`addingMed`/`addImageRef` state (lines 66–70, 76), remove `handleAdd` (lines 143–169), replace JSX at lines 316–409

**Interfaces:**
- Consumes: `Medicine`, `AddForm` types from `../types`.
- Produces: `AddMedicineForm` component, taking only `onAdded: (medicine: Medicine) => void`.

**Exception to the global "no state moves" rule, verified safe:** `showAddForm`, `addForm`, `addingMed`, `addImageRef` are read/written ONLY within lines 314–409 of the original file (confirmed via full-file read — no other section references them), and `handleAdd`'s only external effect is `setMedicines((prev) => [...prev, res.data]...)`, i.e. one callback outward. This is the one component in this plan where state ownership moves into the child, because it's fully self-contained.

- [ ] **Step 1: Create the component**

```tsx
"use client";

import { useRef, useState } from "react";
import { useApiClient } from "@/lib/hooks/useApiClient";
import { useAuth } from "@/lib/auth/AuthProvider";
import { uploadToCloudinary } from "@/lib/cloudinary/upload";
import { Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";
import type { Medicine, AddForm } from "../types";

const inputClass =
  "w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500/30 bg-white";

interface AddMedicineFormProps {
  onAdded: (medicine: Medicine) => void;
}

export function AddMedicineForm({ onAdded }: AddMedicineFormProps) {
  const { apiFetch } = useApiClient();
  const { token } = useAuth();
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState<AddForm>({
    name: "", caption: "", stockQuantity: "", imageFile: null, imagePreview: "",
  });
  const [addingMed, setAddingMed] = useState(false);
  const addImageRef = useRef<HTMLInputElement>(null);

  async function handleAdd() {
    if (!addForm.name.trim() || !addForm.caption.trim() || !addForm.stockQuantity) {
      toast.error("Please fill in all required fields.");
      return;
    }
    setAddingMed(true);
    try {
      const imageUrl = addForm.imageFile ? await uploadToCloudinary(addForm.imageFile, token!) : "";
      const res = await apiFetch<{ data: Medicine }>("/api/admin/medicine", {
        method: "POST",
        body: JSON.stringify({
          name: addForm.name.trim(),
          caption: addForm.caption.trim(),
          stockQuantity: parseInt(addForm.stockQuantity, 10),
          imageUrl,
        }),
      });
      onAdded(res.data);
      setAddForm({ name: "", caption: "", stockQuantity: "", imageFile: null, imagePreview: "" });
      setShowAddForm(false);
      toast.success("Medicine added successfully.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add medicine");
    } finally {
      setAddingMed(false);
    }
  }

  return (
    <>
      <div className="flex justify-end">
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-command-black text-white rounded-xl hover:bg-gray-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-gray-900"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          Add Medicine
        </button>
      </div>

      {showAddForm && (
        <div className="bg-white rounded-card border border-table-border p-5 space-y-4">
          {/* paste page.tsx:328-407 verbatim here (the <h3>New Medicine</h3> through the closing action-buttons div) -- */}
          {/* all state references (addForm, setAddForm, addingMed, addImageRef) are already correct as-is since this component now owns them */}
          {/* onClick={handleAdd} (~401) stays as-is -- handleAdd is now local to this component */}
        </div>
      )}
    </>
  );
}
```

Do the paste-and-replace now — this one needs almost no substitutions since the state names are unchanged, just now locally scoped.

- [ ] **Step 2: Update `page.tsx`**

Delete the `showAddForm`/`addForm`/`addingMed` state (lines 66–70), `addImageRef` (line 76), and `handleAdd` (lines 143–169) entirely — they moved. Replace lines 316–409 (the `<div className="flex justify-end">` button through the closing form panel) with:

```tsx
<AddMedicineForm onAdded={(newMed) => setMedicines((prev) => [...prev, newMed].sort((a, b) => a.name.localeCompare(b.name)))} />
```

Add the import: `import { AddMedicineForm } from "./components/AddMedicineForm";`

- [ ] **Step 3: Verify**

`npx tsc --noEmit`, `npm run lint` — clean (watch for now-unused imports in `page.tsx`: `uploadToCloudinary` may still be needed by `handleSaveEdit`, keep it; check `Plus` icon — likely now unused in `page.tsx`, remove if so). Manual check: `/admin/medicine`, Catalog tab, click "Add Medicine" — form opens, fill required fields + optional photo, submit — new medicine appears in the catalog grid sorted alphabetically, form closes and clears. Cancel — form closes without adding.

- [ ] **Step 4: Commit**

```bash
git add "app/admin/medicine/components/AddMedicineForm.tsx" "app/admin/medicine/page.tsx"
git commit -m "refactor: extract self-contained AddMedicineForm from admin medicine page"
```

---

### Task 10: Extract `EditMedicineDialog`

**Files:**
- Create: `app/admin/medicine/components/EditMedicineDialog.tsx`
- Modify: `app/admin/medicine/page.tsx:898-995` (replace with component usage)

**Interfaces:**
- Consumes: `Medicine`, `EditForm` types from `../types`.
- Produces: `EditMedicineDialog` component. State (`editingMed`, `editForm`, `savingEdit`, `editImageRef`) and `handleSaveEdit` stay in the parent (per the global rule) because `openEdit` — triggered from the catalog grid, a different section — must be able to populate `editingMed`/`editForm` from outside this component.

- [ ] **Step 1: Create the component**

```tsx
import { useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Pill } from "lucide-react";
import type { Medicine, EditForm } from "../types";

const inputClass =
  "w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500/30 bg-white";

interface EditMedicineDialogProps {
  medicine: Medicine | null;
  form: EditForm;
  setForm: React.Dispatch<React.SetStateAction<EditForm>>;
  saving: boolean;
  imageInputRef: React.RefObject<HTMLInputElement | null>;
  onClose: () => void;
  onSave: () => void;
}

export function EditMedicineDialog(props: EditMedicineDialogProps) {
  const { medicine, form, setForm, saving, imageInputRef, onClose, onSave } = props;

  return (
    <Dialog open={!!medicine} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-md p-6">
        <DialogHeader>
          <DialogTitle>Edit Medicine</DialogTitle>
        </DialogHeader>
        {/* paste page.tsx:903-978 verbatim here (the <div className="space-y-3"> through its closing tag), replacing: */}
        {/* editForm -> form, setEditForm -> setForm (every occurrence, e.g. setEditForm((f) => ({...})) -> setForm((f) => ({...})) — mechanical rename only, no logic change */}
        {/* editImageRef -> imageInputRef */}
        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-gray-900"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-command-black rounded-xl hover:bg-gray-800 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-gray-900"
          >
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Saving…</> : "Save Changes"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

Note the closing action buttons (`Cancel`/`Save Changes`, original lines 979–993) are written out above already with the `onClose`/`onSave`/`saving` props wired — you don't need to paste those two, just the fields block above them (lines 903–978).

- [ ] **Step 2: Update `page.tsx`**

Replace lines 898–995 with:

```tsx
<EditMedicineDialog
  medicine={editingMed}
  form={editForm}
  setForm={setEditForm}
  saving={savingEdit}
  imageInputRef={editImageRef}
  onClose={() => setEditingMed(null)}
  onSave={handleSaveEdit}
/>
```

Add the import: `import { EditMedicineDialog } from "./components/EditMedicineDialog";`

- [ ] **Step 3: Verify**

`npx tsc --noEmit`, `npm run lint` — clean. Manual check: Catalog tab, click "Edit" on any medicine — dialog opens pre-filled. Change name/caption/stock/photo/active toggle, "Save Changes" — catalog grid AND inventory table (if you switch tabs) both reflect the update. "Cancel" — closes without saving.

- [ ] **Step 4: Commit**

```bash
git add "app/admin/medicine/components/EditMedicineDialog.tsx" "app/admin/medicine/page.tsx"
git commit -m "refactor: extract EditMedicineDialog from admin medicine page"
```

---

### Task 11: Extract `MedicineCatalogGrid`

**Files:**
- Create: `app/admin/medicine/components/MedicineCatalogGrid.tsx`
- Modify: `app/admin/medicine/page.tsx:411-492` (replace with component usage)

**Interfaces:**
- Consumes: `Medicine` type from `../types`.
- Produces: `MedicineCatalogGrid` component.

- [ ] **Step 1: Create the component**

```tsx
import { Loader2, Pencil, Pill, Trash2 } from "lucide-react";
import type { Medicine } from "../types";

interface MedicineCatalogGridProps {
  medicines: Medicine[];
  loading: boolean;
  failedImages: Set<string>;
  setFailedImages: React.Dispatch<React.SetStateAction<Set<string>>>;
  deleteConfirmId: string | null;
  setDeleteConfirmId: React.Dispatch<React.SetStateAction<string | null>>;
  onConfirmDelete: (medicine: Medicine) => void;
  onEdit: (medicine: Medicine) => void;
}

export function MedicineCatalogGrid(props: MedicineCatalogGridProps) {
  const { medicines, loading, failedImages, setFailedImages, deleteConfirmId, setDeleteConfirmId, onConfirmDelete, onEdit } = props;

  /* paste page.tsx:411-491 verbatim here as the returned JSX (the loading ternary / empty-state / grid), replacing: */
  /* loadingMeds -> loading */
  /* onError={() => setFailedImages((prev) => new Set(prev).add(med.id))} -> unchanged, setFailedImages is now the prop */
  /* deleteConfirmId, setDeleteConfirmId(null/med.id) -> unchanged, now props */
  /* confirmDelete(med) -> onConfirmDelete(med) */
  /* openEdit(med) -> onEdit(med) */
}
```

Do the paste-and-replace, wrapping it as a proper `return (...)` inside the function body.

- [ ] **Step 2: Update `page.tsx`**

Replace lines 411–492 with:

```tsx
<MedicineCatalogGrid
  medicines={medicines}
  loading={loadingMeds}
  failedImages={failedImages}
  setFailedImages={setFailedImages}
  deleteConfirmId={deleteConfirmId}
  setDeleteConfirmId={setDeleteConfirmId}
  onConfirmDelete={confirmDelete}
  onEdit={openEdit}
/>
```

Add the import: `import { MedicineCatalogGrid } from "./components/MedicineCatalogGrid";`

- [ ] **Step 3: Verify**

`npx tsc --noEmit`, `npm run lint` — clean. Manual check: Catalog tab shows the grid, broken images fall back to the pill placeholder, "Delete" shows the inline Yes/No confirm and removes the card on Yes.

- [ ] **Step 4: Commit**

```bash
git add "app/admin/medicine/components/MedicineCatalogGrid.tsx" "app/admin/medicine/page.tsx"
git commit -m "refactor: extract MedicineCatalogGrid from admin medicine page"
```

---

### Task 12: Extract `MedicineInventoryTable`

**Files:**
- Create: `app/admin/medicine/components/MedicineInventoryTable.tsx`
- Modify: `app/admin/medicine/page.tsx:495-655` (replace with component usage)

**Interfaces:**
- Consumes: `Medicine` type from `../types`, `Pagination` from `@/components/ui/pagination`, `LOW_STOCK_THRESHOLD` from `@/lib/constants/stock`.
- Produces: `MedicineInventoryTable` component.

- [ ] **Step 1: Create the component**

```tsx
import { Loader2, Pill } from "lucide-react";
import { Pagination } from "@/components/ui/pagination";
import { LOW_STOCK_THRESHOLD } from "@/lib/constants/stock";
import type { Medicine } from "../types";

interface MedicineInventoryTableProps {
  medicines: Medicine[];
  loading: boolean;
  failedImages: Set<string>;
  setFailedImages: React.Dispatch<React.SetStateAction<Set<string>>>;
  inventoryEdits: Record<string, string>;
  setInventoryEdits: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  savingStock: string | null;
  onSaveStock: (medicine: Medicine) => void;
  page: number;
  pages: number;
  onPageChange: (page: number) => void;
}

export function MedicineInventoryTable(props: MedicineInventoryTableProps) {
  const {
    medicines, loading, failedImages, setFailedImages, inventoryEdits, setInventoryEdits,
    savingStock, onSaveStock, page, pages, onPageChange,
  } = props;

  /* paste page.tsx:496-654 verbatim here as the returned JSX (the loading/empty ternary through the closing </> and Pagination), replacing: */
  /* loadingMeds -> loading */
  /* setFailedImages, setInventoryEdits -> unchanged, now props */
  /* handleStockSave(med) -> onSaveStock(med) */
  /* invPage, invPages, setInvPage -> page, pages, onPageChange */
}
```

Do the paste-and-replace, wrapping it as `return (loading ? (...) : medicines.length === 0 ? (...) : (<>...</>));` matching the original's ternary structure.

- [ ] **Step 2: Update `page.tsx`**

Replace lines 495–655 (the entire `{activeTab === "inventory" && (...)}` block) with:

```tsx
{activeTab === "inventory" && (
  <MedicineInventoryTable
    medicines={medicines}
    loading={loadingMeds}
    failedImages={failedImages}
    setFailedImages={setFailedImages}
    inventoryEdits={inventoryEdits}
    setInventoryEdits={setInventoryEdits}
    savingStock={savingStock}
    onSaveStock={handleStockSave}
    page={invPage}
    pages={invPages}
    onPageChange={setInvPage}
  />
)}
```

Add the import: `import { MedicineInventoryTable } from "./components/MedicineInventoryTable";`

- [ ] **Step 3: Verify**

`npx tsc --noEmit`, `npm run lint` — clean. Manual check: Inventory tab shows desktop table (resize browser narrow to see mobile cards), edit a stock number, "Save" enables only when dirty, saves and shows updated low/out-of-stock coloring, pagination works if more than one page exists.

- [ ] **Step 4: Commit**

```bash
git add "app/admin/medicine/components/MedicineInventoryTable.tsx" "app/admin/medicine/page.tsx"
git commit -m "refactor: extract MedicineInventoryTable from admin medicine page"
```

---

### Task 13: Extract `MedicineRequestsPanel`

**Files:**
- Create: `app/admin/medicine/components/MedicineRequestsPanel.tsx`
- Modify: `app/admin/medicine/page.tsx:657-896` (replace with component usage)

**Interfaces:**
- Consumes: `MedicineRequest` type from `../types`, `MEDICINE_REQUEST_STATUS_BADGE` from `@/lib/constants/medicineRequestStatus`, `Pagination` from `@/components/ui/pagination`.
- Produces: `MedicineRequestsPanel` component.

**Note:** the cross-domain stock-decrement-on-approve side effect (`handleAction`, original lines 244–274) stays in `page.tsx` exactly as-is — this component only calls `onAction(requestId, action)`, it never touches `medicines`.

- [ ] **Step 1: Create the component**

```tsx
import { Loader2, Pill, X } from "lucide-react";
import { Pagination } from "@/components/ui/pagination";
import { MEDICINE_REQUEST_STATUS_BADGE } from "@/lib/constants/medicineRequestStatus";
import type { MedicineRequest } from "../types";

const statusChip = MEDICINE_REQUEST_STATUS_BADGE;

interface MedicineRequestsPanelProps {
  loading: boolean;
  pending: MedicineRequest[];
  filteredHistory: MedicineRequest[];
  actioningId: string | null;
  onAction: (requestId: string, action: "approve" | "reject") => void;
  reqFilter: string;
  setReqFilter: React.Dispatch<React.SetStateAction<string>>;
  dateFrom: string;
  setDateFrom: React.Dispatch<React.SetStateAction<string>>;
  dateTo: string;
  setDateTo: React.Dispatch<React.SetStateAction<string>>;
  statusFilter: string;
  setStatusFilter: React.Dispatch<React.SetStateAction<string>>;
  onClearFilters: () => void;
  page: number;
  pages: number;
  onPageChange: (page: number) => void;
}

export function MedicineRequestsPanel(props: MedicineRequestsPanelProps) {
  const {
    loading, pending, filteredHistory, actioningId, onAction,
    reqFilter, setReqFilter, dateFrom, setDateFrom, dateTo, setDateTo, statusFilter, setStatusFilter,
    onClearFilters, page, pages, onPageChange,
  } = props;

  /* paste page.tsx:658-895 verbatim here as the returned JSX (the space-y-6 wrapper div's contents), replacing: */
  /* loadingReqs -> loading */
  /* requests.filter(...) results (`pending`, already computed in the parent as a derived value) -> pending prop, unchanged reference */
  /* filteredHistory -> unchanged, now a prop instead of a parent-scope derived const */
  /* handleAction(r.id, "approve"/"reject") -> onAction(r.id, "approve"/"reject") */
  /* reqFilter, dateFrom, dateTo, statusFilter -> unchanged reads; their setters (setReqFilter etc.) -> unchanged, now props */
  /* clearFilters -> onClearFilters */
  /* reqPage, reqPages, setReqPage -> page, pages, onPageChange */
}
```

Do the paste-and-replace, wrapping the whole thing in `<div className="space-y-6">...</div>` matching the original's outer wrapper (original line 658).

- [ ] **Step 2: Update `page.tsx`**

Replace lines 657–896 (the entire `{activeTab === "requests" && (...)}` block) with:

```tsx
{activeTab === "requests" && (
  <MedicineRequestsPanel
    loading={loadingReqs}
    pending={pending}
    filteredHistory={filteredHistory}
    actioningId={actioningId}
    onAction={handleAction}
    reqFilter={reqFilter}
    setReqFilter={setReqFilter}
    dateFrom={dateFrom}
    setDateFrom={setDateFrom}
    dateTo={dateTo}
    setDateTo={setDateTo}
    statusFilter={statusFilter}
    setStatusFilter={setStatusFilter}
    onClearFilters={clearFilters}
    page={reqPage}
    pages={reqPages}
    onPageChange={setReqPage}
  />
)}
```

Add the import: `import { MedicineRequestsPanel } from "./components/MedicineRequestsPanel";`

- [ ] **Step 3: Verify**

`npx tsc --noEmit`, `npm run lint` — clean. Manual check: Requests tab — pending queue shows approve/reject with correct loading spinner per-row, approving decrements the medicine's stock (verify by switching to Inventory tab after approving), history filters (date range, status, search) narrow the table/cards, "Clear filters" resets them and the page number, pagination works.

- [ ] **Step 4: Commit**

```bash
git add "app/admin/medicine/components/MedicineRequestsPanel.tsx" "app/admin/medicine/page.tsx"
git commit -m "refactor: extract MedicineRequestsPanel from admin medicine page"
```

---

### Task 14: Final admin/medicine page cleanup + full verification

**Files:**
- Modify: `app/admin/medicine/page.tsx` (import cleanup only)

- [ ] **Step 1: Remove now-unused imports**

`useRef` is likely still needed only if any remaining ref stays in `page.tsx` (`editImageRef` still lives in the parent per Task 10 — keep `useRef`). `Pencil`, `Trash2`, `X`, `Pill` were used by JSX that moved out — check each with `npm run lint`'s unused-vars output and delete what's flagged. `uploadToCloudinary` is still needed by `handleSaveEdit` (unchanged, stays in `page.tsx`) — keep it.

- [ ] **Step 2: Confirm final line count**

Run `wc -l "app/admin/medicine/page.tsx"` — expect roughly 220–280 lines (down from 998), holding: imports, all remaining state, both fetch effects, the render-body filter-reset block, `clearFilters`/`handleTabChange`/`openEdit`/`handleSaveEdit`/`handleStockSave`/`confirmDelete`/`handleAction`, the `pending`/`history`/`filteredHistory` derivations, the header, tab bar, the three tab bodies each now rendering one extracted component, and the `EditMedicineDialog` usage.

- [ ] **Step 3: Full verification pass**

```bash
npx tsc --noEmit
npm run lint
npm run build
```

All three must succeed, lint warning count unchanged from before Task 8. Then `npm run dev` and re-run the full manual click-through across all three tabs one more time end-to-end (add medicine → edit it → adjust its stock in Inventory → approve/reject a request and confirm the stock decrement shows up → filter/search history) to catch any cross-task integration issue.

- [ ] **Step 4: Commit**

```bash
git add "app/admin/medicine/page.tsx"
git commit -m "refactor: clean up unused imports after admin medicine page split"
```

---

## Self-Review

**Spec coverage:** AGSON-31's remediation note calls for splitting `food/page.tsx` and `admin/medicine/page.tsx` (the 2 largest, agreed minimum scope) into components mapping to their independent concerns. Food: listing browse (Tasks 3–4), own-order form (Tasks 5–6), admin-adjacent seller order management (Task 3) — covered. Admin/medicine: inventory CRUD (Tasks 9–12) and request queue (Task 13) — covered. Both files verified via full read; every state variable, handler, and JSX section accounted for in a task.

**Placeholder scan:** every "paste verbatim" instruction cites exact original line numbers and lists every substitution needed — this is the plan's sanctioned adaptation (see Global Constraints) for a move-refactor with no test suite, not a vague "similar to Task N." Every new file's imports, prop interface, and non-moved wrapper code is written out in full.

**Type consistency:** `Listing`/`AddOn`/`MyOrder`/`OrderRow`/`Tab` (food) and `Medicine`/`MedicineRequest`/`AddForm`/`EditForm` (medicine) are defined once each in Task 1/Task 8 and referenced by identical names throughout every later task — checked for drift across all 14 tasks.
