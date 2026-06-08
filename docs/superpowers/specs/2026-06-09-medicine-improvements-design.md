# Medicine Section Improvements — Design Spec
Date: 2026-06-09

## Overview

Five targeted improvements to the existing medicine feature (Approach B):
1. Hide scrollbar in the employee detail modal
2. Make photo optional on both add and edit forms (admin)
3. Rename "Name" label to "Generic Name" across admin forms
4. Low-stock highlight in the admin Inventory tab
5. Client-side search bar in the employee catalog

No schema migrations required. All changes are pure UI and client-side logic.

---

## Section 1 — Modal Scrollbar (employee page)

**File:** `app/(dashboard)/medicine/page.tsx`

The detail modal inner container has `overflow-y-auto`. Add scrollbar-hide utilities so the scroll track is invisible while scroll behavior is preserved:

```
[&::-webkit-scrollbar]:hidden [scrollbar-width:none] [-ms-overflow-style:none]
```

Apply to the `max-h-[85vh] overflow-y-auto` div (currently line ~204).

---

## Section 2 — Optional Photo

### Pill placeholder helper

Every place that renders `med.imageUrl` gets wrapped in a conditional. When `imageUrl` is falsy (empty string or null), render a gray placeholder div instead:

```tsx
{med.imageUrl ? (
  <img src={med.imageUrl} alt={med.name} className="w-full h-full object-cover" />
) : (
  <div className="w-full h-full flex items-center justify-center bg-gray-100">
    <Pill className="w-10 h-10 text-gray-300" />
  </div>
)}
```

Apply this pattern in all five locations:
- Admin catalog cards (`app/admin/medicine/page.tsx`)
- Admin inventory table thumbnail (`app/admin/medicine/page.tsx`)
- Admin edit modal image preview (currently renders `<img src={editForm.imagePreview || editForm.imageUrl}>` — broken when both are empty)
- Employee catalog cards (`app/(dashboard)/medicine/page.tsx`)
- Employee detail modal hero image (`app/(dashboard)/medicine/page.tsx`)

### Add form validation

**Remove** `!addForm.imageFile` from the validation guard in `handleAdd`. New guard:

```ts
if (!addForm.name.trim() || !addForm.caption.trim() || !addForm.stockQuantity) {
  alert("Please fill in all required fields.");
  return;
}
```

If `addForm.imageFile` is present → upload to Cloudinary as before.
If absent → send `imageUrl: ""` to the API.

### Edit form

No change needed — the edit flow already conditionally uploads only when `editForm.imageFile` is set. The existing `imageUrl` (including `""`) is preserved as-is if no new file is chosen.

### Admin form label

Change `"Photo"` → `"Photo (optional)"` on both the add form and the edit modal photo section.

---

## Section 3 — Generic Name Label

**File:** `app/admin/medicine/page.tsx`

Two changes only — no schema, no API, no type changes:

| Location | Before | After |
|---|---|---|
| Add form label | `"Name"` | `"Generic Name"` |
| Add form placeholder | `"e.g. Biogesic"` | `"e.g. Paracetamol"` |
| Edit modal label | `"Name"` | `"Generic Name"` |

The DB field `name` and the `Medicine` TypeScript type are unchanged. Existing records are not affected — data cleanup is a separate task.

---

## Section 4 — Low-Stock Highlight (admin Inventory tab)

**File:** `app/admin/medicine/page.tsx`

In the Inventory table, the stock status label in the stock cell currently shows green ("in stock") or red ("Out of stock"). Add an amber state for low stock:

| Condition | Color | Label |
|---|---|---|
| `stockQuantity === 0` | Red | `"Out of stock"` |
| `stockQuantity > 0 && stockQuantity <= 3` | Amber | `"Low stock"` |
| `stockQuantity > 3` | Emerald | `"in stock"` |

Threshold: **≤ 3 units**.

Only the status label text/color changes. The stock input field and Save button are unaffected.

---

## Section 5 — Catalog Search (employee page)

**File:** `app/(dashboard)/medicine/page.tsx`

Add a `searchQuery` state (`useState<string>("")`). Render a search input above the catalog grid, visible only when `activeTab === "catalog"` and `medicines.length > 0`.

Filter the rendered list:
```ts
const visibleMedicines = searchQuery.trim()
  ? medicines.filter((m) => m.name.toLowerCase().includes(searchQuery.toLowerCase()))
  : medicines;
```

Behavior:
- Query clears when switching away from the catalog tab (reset in the tab `onClick`)
- Empty state when no matches: `"No medicines match your search."`
- Input is a plain controlled `<input>` styled to match the rest of the page (border, rounded-xl, focus ring)

---

## Files Changed

| File | Changes |
|---|---|
| `app/(dashboard)/medicine/page.tsx` | Scrollbar hide on modal, pill placeholder (cards + modal), search bar |
| `app/admin/medicine/page.tsx` | Pill placeholder (cards + inventory thumbnail), photo optional (add + edit), Generic Name label, low-stock highlight |
