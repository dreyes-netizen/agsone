# Medicine Section — Design Spec
Date: 2026-06-02

## Overview

A medicine dispensary feature for AGS One. HR Admin manages a catalog of medicines with photos, captions, and stock quantities. Employees browse the catalog and submit one-tap requests. HR approves or rejects each request; approval decrements stock. The admin panel keeps a full dispense history.

No purchasing, no payment, no quantities on the employee request — just pick and submit.

---

## Data Model

### `MedicineItem`

| Field | Type | Notes |
|---|---|---|
| id | String (uuid) | PK |
| name | String | e.g. "Biogesic" |
| imageUrl | String | Cloudinary URL |
| caption | String | Short description |
| stockQuantity | Int | Current units in stock |
| isActive | Boolean | HR can deactivate without deleting |
| createdById | String | FK → User |
| createdAt | DateTime | |
| updatedAt | DateTime | |

### `MedicineRequest`

| Field | Type | Notes |
|---|---|---|
| id | String (uuid) | PK |
| medicineId | String | FK → MedicineItem |
| userId | String | FK → User (requester) |
| status | Enum | `PENDING`, `APPROVED`, `REJECTED` |
| approvedById | String? | FK → User (HR who approved/rejected) |
| approvedAt | DateTime? | Timestamp of approval/rejection |
| createdAt | DateTime | |

### Enum

```
MedicineRequestStatus: PENDING | APPROVED | REJECTED
```

### Business Rules

- Employee cannot submit a second request for the same medicine while one is `PENDING`
- Approval decrements `MedicineItem.stockQuantity` by 1 atomically (transaction)
- Delete of a `MedicineItem` is blocked if any `PENDING` requests exist for it
- Stock quantity cannot go below 0 on approval (guard in API)

---

## Employee View (`/medicine`)

### Catalog Grid

- Card per active medicine: full photo, name, caption, stock badge
- Stock badge: "X in stock" (green) when > 0, "Out of stock" (gray) when 0
- **Request button**: one tap, no form
  - Disabled + shows "Pending…" if employee already has a PENDING request for that medicine
  - Disabled + grayed if stock = 0

### My Requests Panel

Below the catalog grid, a table of the current employee's own requests:

| Column | Notes |
|---|---|
| Medicine | Name |
| Requested | Date |
| Status | Chip: Pending (amber) / Approved (green) / Rejected (red) |

---

## Admin Panel (`/admin/medicine`)

Two tabs on the same page.

### Tab 1 — Catalog

- Grid of all medicines (active and inactive)
- **Add Medicine** button → inline/modal form:
  - Name (required)
  - Caption (required)
  - Starting stock quantity (required, min 0)
  - Photo upload via Cloudinary
- **Edit** button per card → modal pre-filled with current values
- **Delete** button per card → blocked with error message if PENDING requests exist
- Inactive medicines shown with dimmed style; Edit still available

### Tab 2 — Requests

- **Pending queue** at top: Employee name, Medicine, Date requested, Approve + Reject buttons
- Approve → APPROVED, stock -1, approvedById + approvedAt stamped (atomic transaction)
- Reject → REJECTED, stock unchanged
- **Full history** below pending: all APPROVED + REJECTED requests, newest first
- Filterable by medicine name or employee name (client-side filter)

---

## API Routes

| Method | Route | Auth | Purpose |
|---|---|---|---|
| GET | `/api/medicine` | Any authenticated | List active medicines + caller's pending requests |
| POST | `/api/admin/medicine` | HR_ADMIN | Add medicine |
| PATCH | `/api/admin/medicine/[id]` | HR_ADMIN | Edit medicine (name, caption, imageUrl, stockQuantity, isActive) |
| DELETE | `/api/admin/medicine/[id]` | HR_ADMIN | Delete medicine (blocked if PENDING requests exist) |
| POST | `/api/medicine/[id]/request` | Any authenticated | Submit a request |
| GET | `/api/admin/medicine/requests` | HR_ADMIN | Fetch all requests (full history) |
| PATCH | `/api/admin/medicine/requests/[id]` | HR_ADMIN | Approve or reject a request |

---

## Navigation

- Add `{ href: "/medicine", label: "Medicine", icon: Pill }` to `mainNav` in `app/(dashboard)/layout.tsx`
- `Pill` icon from lucide-react

---

## Database Migration

Raw SQL via `npx prisma db execute --stdin` (avoids migrate dev drift from document_chunks table):

```sql
CREATE TYPE "MedicineRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE "MedicineItem" (
  "id"            TEXT NOT NULL DEFAULT gen_random_uuid(),
  "name"          TEXT NOT NULL,
  "imageUrl"      TEXT NOT NULL,
  "caption"       TEXT NOT NULL,
  "stockQuantity" INTEGER NOT NULL DEFAULT 0,
  "isActive"      BOOLEAN NOT NULL DEFAULT true,
  "createdById"   TEXT NOT NULL,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MedicineItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MedicineItem_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "MedicineRequest" (
  "id"           TEXT NOT NULL DEFAULT gen_random_uuid(),
  "medicineId"   TEXT NOT NULL,
  "userId"       TEXT NOT NULL,
  "status"       "MedicineRequestStatus" NOT NULL DEFAULT 'PENDING',
  "approvedById" TEXT,
  "approvedAt"   TIMESTAMP(3),
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MedicineRequest_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MedicineRequest_medicineId_fkey" FOREIGN KEY ("medicineId") REFERENCES "MedicineItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "MedicineRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "MedicineRequest_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
```

---

## Prisma Schema Additions

```prisma
enum MedicineRequestStatus {
  PENDING
  APPROVED
  REJECTED
}

model MedicineItem {
  id            String   @id @default(uuid())
  name          String
  imageUrl      String
  caption       String
  stockQuantity Int      @default(0)
  isActive      Boolean  @default(true)
  createdById   String
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  createdBy User              @relation("MedicineItemsCreated", fields: [createdById], references: [id])
  requests  MedicineRequest[]
}

model MedicineRequest {
  id           String                @id @default(uuid())
  medicineId   String
  userId       String
  status       MedicineRequestStatus @default(PENDING)
  approvedById String?
  approvedAt   DateTime?
  createdAt    DateTime              @default(now())

  medicine   MedicineItem @relation(fields: [medicineId], references: [id])
  user       User         @relation("MedicineRequestsMade", fields: [userId], references: [id])
  approvedBy User?        @relation("MedicineRequestsApproved", fields: [approvedById], references: [id])
}
```

---

## File Checklist

| File | Action |
|---|---|
| `prisma/schema.prisma` | Add enum + 2 models + User relations |
| `app/(dashboard)/layout.tsx` | Add Medicine nav item |
| `app/(dashboard)/medicine/page.tsx` | New — employee catalog + request UI |
| `app/api/medicine/route.ts` | New — GET catalog |
| `app/api/medicine/[id]/request/route.ts` | New — POST request |
| `app/api/admin/medicine/route.ts` | New — POST add medicine |
| `app/api/admin/medicine/[id]/route.ts` | New — PATCH/DELETE medicine |
| `app/api/admin/medicine/requests/route.ts` | New — GET all requests |
| `app/api/admin/medicine/requests/[id]/route.ts` | New — PATCH approve/reject (returns 409 if stock = 0 on approve) |
| `app/admin/medicine/page.tsx` | New — HR catalog mgmt + requests |
| `app/admin/layout.tsx` | Add Medicine link to admin sidebar |
