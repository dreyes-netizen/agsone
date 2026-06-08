# Medicine Section Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply five targeted improvements to the medicine feature — hide the modal scrollbar, make photos optional with a pill-icon placeholder, rename the name field to "Generic Name", add a low-stock highlight in the admin inventory tab, and add a client-side search bar to the employee catalog.

**Architecture:** All changes are pure UI in two existing page files. No API routes, no schema, no migrations. The two files are modified independently — Task 1–3 cover the employee page, Tasks 4–7 cover the admin page.

**Tech Stack:** Next.js 15 (App Router), React, Tailwind CSS, lucide-react icons, TypeScript

---

## File Map

| File | What changes |
|---|---|
| `app/(dashboard)/medicine/page.tsx` | Scrollbar hide, pill placeholder (catalog cards + modal hero), search bar + filter logic |
| `app/admin/medicine/page.tsx` | Generic Name label, photo optional (validation + upload), pill placeholder (catalog cards + inventory thumbnail + edit modal), low-stock row highlight |

> No other files are touched.

---

## Task 1: Employee page — hide modal scrollbar + add imports

**Files:**
- Modify: `app/(dashboard)/medicine/page.tsx`

- [ ] **Step 1: Update the lucide-react import to add `Pill` and `Search`**

Find this line at the top of the file:
```tsx
import { X } from "lucide-react";
```
Replace with:
```tsx
import { Pill, Search, X } from "lucide-react";
```

- [ ] **Step 2: Hide the scrollbar on the modal inner container**

Find the modal inner `<div>` (the one with `overflow-y-auto`):
```tsx
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
```
Replace with:
```tsx
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[85vh] overflow-y-auto [&::-webkit-scrollbar]:hidden [scrollbar-width:none] [-ms-overflow-style:none]"
            onClick={(e) => e.stopPropagation()}
          >
```

- [ ] **Step 3: Commit**

```bash
git add "app/(dashboard)/medicine/page.tsx"
git commit -m "feat(medicine): hide modal scrollbar, add Pill+Search imports"
```

---

## Task 2: Employee page — pill placeholder in catalog cards and modal

**Files:**
- Modify: `app/(dashboard)/medicine/page.tsx`

- [ ] **Step 1: Replace the catalog card image with a conditional**

Find inside the `medicines.map()` block:
```tsx
                  <div className="aspect-square bg-gray-50 overflow-hidden">
                    <img
                      src={med.imageUrl}
                      alt={med.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
```
Replace with:
```tsx
                  <div className="aspect-square bg-gray-50 overflow-hidden">
                    {med.imageUrl ? (
                      <img src={med.imageUrl} alt={med.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gray-100">
                        <Pill className="w-10 h-10 text-gray-300" />
                      </div>
                    )}
                  </div>
```

- [ ] **Step 2: Replace the modal hero image with a conditional**

Find the `{selectedMed && (` block. Inside the `<div className="relative">`, find:
```tsx
              <img
                src={selectedMed.imageUrl}
                alt={selectedMed.name}
                className="w-full aspect-square object-cover rounded-t-2xl"
              />
```
Replace with:
```tsx
              {selectedMed.imageUrl ? (
                <img
                  src={selectedMed.imageUrl}
                  alt={selectedMed.name}
                  className="w-full aspect-square object-cover rounded-t-2xl"
                />
              ) : (
                <div className="w-full aspect-square flex items-center justify-center bg-gray-100 rounded-t-2xl">
                  <Pill className="w-16 h-16 text-gray-300" />
                </div>
              )}
```

- [ ] **Step 3: Commit**

```bash
git add "app/(dashboard)/medicine/page.tsx"
git commit -m "feat(medicine): pill placeholder when no photo on employee page"
```

---

## Task 3: Employee page — search bar

**Files:**
- Modify: `app/(dashboard)/medicine/page.tsx`

- [ ] **Step 1: Add `searchQuery` state**

Inside `MedicinePage()`, after the existing `useState` declarations (e.g. after `const [selectedMed, setSelectedMed] = useState<Medicine | null>(null);`), add:
```tsx
  const [searchQuery, setSearchQuery] = useState("");
```

- [ ] **Step 2: Reset search when switching away from catalog tab**

Find the tab button `onClick`:
```tsx
            onClick={() => setActiveTab(tab)}
```
Replace with:
```tsx
            onClick={() => { setActiveTab(tab); if (tab !== "catalog") setSearchQuery(""); }}
```

- [ ] **Step 3: Add the filtered medicines variable**

Just before the `return (` statement, add:
```tsx
  const visibleMedicines = searchQuery.trim()
    ? medicines.filter((m) => m.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : medicines;
```

- [ ] **Step 4: Replace the catalog grid section with the search input + filtered grid**

Find the entire catalog tab block:
```tsx
      {/* Catalog tab */}
      {activeTab === "catalog" && (
        loading ? (
          <div className="text-center text-gray-400 py-16">Loading…</div>
        ) : medicines.length === 0 ? (
          <div className="text-center text-gray-400 py-16">No medicines available.</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {medicines.map((med) => {
```
Replace with:
```tsx
      {/* Catalog tab */}
      {activeTab === "catalog" && (
        loading ? (
          <div className="text-center text-gray-400 py-16">Loading…</div>
        ) : medicines.length === 0 ? (
          <div className="text-center text-gray-400 py-16">No medicines available.</div>
        ) : (
          <div className="space-y-4">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search medicines…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-200 bg-white"
              />
            </div>
            {visibleMedicines.length === 0 ? (
              <div className="text-center text-gray-400 py-12">No medicines match your search.</div>
            ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {visibleMedicines.map((med) => {
```

- [ ] **Step 5: Close the new wrapping divs**

Find (includes the My Requests comment to make the match unique):
```tsx
          </div>
        )
      )}

      {/* My Requests tab */}
```
Replace with:
```tsx
          </div>
            )}
          </div>
        )
      )}

      {/* My Requests tab */}
```

- [ ] **Step 6: Commit**

```bash
git add "app/(dashboard)/medicine/page.tsx"
git commit -m "feat(medicine): add client-side search bar to employee catalog"
```

---

## Task 4: Admin page — Generic Name label

**Files:**
- Modify: `app/admin/medicine/page.tsx`

- [ ] **Step 1: Update the add form label and placeholder**

Find in the add form grid:
```tsx
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Name</label>
                  <input
                    value={addForm.name}
                    onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
                    className={inputClass}
                    placeholder="e.g. Biogesic"
                  />
```
Replace with:
```tsx
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Generic Name</label>
                  <input
                    value={addForm.name}
                    onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
                    className={inputClass}
                    placeholder="e.g. Paracetamol"
                  />
```

- [ ] **Step 2: Update the edit modal label**

Find in the edit modal:
```tsx
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Name</label>
```
Replace with:
```tsx
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Generic Name</label>
```

- [ ] **Step 3: Commit**

```bash
git add app/admin/medicine/page.tsx
git commit -m "feat(medicine): rename Name label to Generic Name on admin forms"
```

---

## Task 5: Admin page — photo optional

**Files:**
- Modify: `app/admin/medicine/page.tsx`

- [ ] **Step 1: Update `handleAdd` validation guard**

Find:
```tsx
    if (!addForm.name.trim() || !addForm.caption.trim() || !addForm.imageFile || !addForm.stockQuantity) {
      alert("Please fill in all fields and upload an image.");
      return;
    }
```
Replace with:
```tsx
    if (!addForm.name.trim() || !addForm.caption.trim() || !addForm.stockQuantity) {
      alert("Please fill in all required fields.");
      return;
    }
```

- [ ] **Step 2: Make the Cloudinary upload conditional**

Find:
```tsx
      const imageUrl = await uploadToCloudinary(addForm.imageFile);
```
Replace with:
```tsx
      const imageUrl = addForm.imageFile ? await uploadToCloudinary(addForm.imageFile) : "";
```

- [ ] **Step 3: Update the add form photo label (use `addImageRef` context for uniqueness)**

Find:
```tsx
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Photo</label>
                <input
                  ref={addImageRef}
```
Replace with:
```tsx
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Photo <span className="normal-case font-normal text-gray-400">(optional)</span></label>
                <input
                  ref={addImageRef}
```

- [ ] **Step 4: Update the edit modal photo label (use `editImageRef` context for uniqueness)**

Find:
```tsx
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Photo</label>
                <input
                  ref={editImageRef}
```
Replace with:
```tsx
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Photo <span className="normal-case font-normal text-gray-400">(optional)</span></label>
                <input
                  ref={editImageRef}
```

- [ ] **Step 5: Commit**

```bash
git add app/admin/medicine/page.tsx
git commit -m "feat(medicine): make photo optional on admin add/edit forms"
```

---

## Task 6: Admin page — pill placeholder

**Files:**
- Modify: `app/admin/medicine/page.tsx`

- [ ] **Step 1: Update the lucide-react import to add `Pill`**

Find:
```tsx
import { Pencil, Plus, Trash2, X } from "lucide-react";
```
Replace with:
```tsx
import { Pencil, Pill, Plus, Trash2, X } from "lucide-react";
```

- [ ] **Step 2: Catalog card image — conditional**

Find in the catalog grid inside `medicines.map`:
```tsx
                  <div className="aspect-square bg-gray-50 overflow-hidden relative">
                    <img src={med.imageUrl} alt={med.name} className="w-full h-full object-cover" />
```
Replace with:
```tsx
                  <div className="aspect-square bg-gray-50 overflow-hidden relative">
                    {med.imageUrl ? (
                      <img src={med.imageUrl} alt={med.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gray-100">
                        <Pill className="w-10 h-10 text-gray-300" />
                      </div>
                    )}
```

- [ ] **Step 3: Inventory table thumbnail — conditional**

Find in the inventory table:
```tsx
                          <img
                            src={med.imageUrl}
                            alt={med.name}
                            className="w-9 h-9 rounded-lg object-cover border border-gray-100 shrink-0"
                          />
```
Replace with:
```tsx
                          {med.imageUrl ? (
                            <img src={med.imageUrl} alt={med.name} className="w-9 h-9 rounded-lg object-cover border border-gray-100 shrink-0" />
                          ) : (
                            <div className="w-9 h-9 rounded-lg border border-gray-100 bg-gray-100 flex items-center justify-center shrink-0">
                              <Pill className="w-4 h-4 text-gray-300" />
                            </div>
                          )}
```

- [ ] **Step 4: Edit modal image preview — conditional**

Find in the edit modal photo section:
```tsx
                  <img
                    src={editForm.imagePreview || editForm.imageUrl}
                    alt=""
                    className="w-16 h-16 rounded-lg object-cover border border-gray-200"
                  />
```
Replace with:
```tsx
                  {(editForm.imagePreview || editForm.imageUrl) ? (
                    <img
                      src={editForm.imagePreview || editForm.imageUrl}
                      alt=""
                      className="w-16 h-16 rounded-lg object-cover border border-gray-200"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-lg border border-gray-200 bg-gray-100 flex items-center justify-center">
                      <Pill className="w-6 h-6 text-gray-300" />
                    </div>
                  )}
```

- [ ] **Step 5: Commit**

```bash
git add app/admin/medicine/page.tsx
git commit -m "feat(medicine): pill placeholder when no photo on admin page"
```

---

## Task 7: Admin page — low-stock highlight in inventory tab

**Files:**
- Modify: `app/admin/medicine/page.tsx`

- [ ] **Step 1: Update the stock status label in the inventory table**

Find in the inventory `<tbody>`:
```tsx
                          <span className={`text-xs font-medium ${med.stockQuantity === 0 ? "text-red-500" : "text-emerald-600"}`}>
                            {med.stockQuantity === 0 ? "Out of stock" : "in stock"}
                          </span>
```
Replace with:
```tsx
                          <span className={`text-xs font-medium ${
                            med.stockQuantity === 0
                              ? "text-red-500"
                              : med.stockQuantity <= 3
                              ? "text-amber-500"
                              : "text-emerald-600"
                          }`}>
                            {med.stockQuantity === 0 ? "Out of stock" : med.stockQuantity <= 3 ? "Low stock" : "in stock"}
                          </span>
```

- [ ] **Step 2: Commit**

```bash
git add app/admin/medicine/page.tsx
git commit -m "feat(medicine): amber low-stock highlight when stock <= 3 in inventory tab"
```
