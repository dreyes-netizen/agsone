# Medicine Section Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a medicine dispensary section where employees request medicines from a catalog, HR approves requests (decrementing stock), and the admin panel shows the full dispense history.

**Architecture:** Two new Prisma models (`MedicineItem`, `MedicineRequest`) migrated via raw SQL. Seven API routes handle catalog CRUD and the request/approve flow. The employee page shows the catalog with one-tap request buttons; the admin page has a Catalog tab and a Requests tab.

**Tech Stack:** Next.js 16 App Router, Prisma 7 (PostgreSQL/Supabase), Zod validation, Cloudinary image upload (`@/lib/cloudinary/upload`), Tailwind CSS, lucide-react, `useApiClient` hook, `verifyAuth` / `requireRole` auth helpers.

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `prisma/schema.prisma` | Modify | Add `MedicineRequestStatus` enum, `MedicineItem` model, `MedicineRequest` model, User relations |
| `app/api/medicine/route.ts` | Create | GET — employee catalog + own requests |
| `app/api/medicine/[id]/request/route.ts` | Create | POST — employee submits a request |
| `app/api/admin/medicine/route.ts` | Create | GET + POST — HR lists / adds medicines |
| `app/api/admin/medicine/[id]/route.ts` | Create | PATCH + DELETE — HR edits / deletes a medicine |
| `app/api/admin/medicine/requests/route.ts` | Create | GET — HR fetches all requests |
| `app/api/admin/medicine/requests/[id]/route.ts` | Create | PATCH — HR approves or rejects a request |
| `app/(dashboard)/medicine/page.tsx` | Create | Employee: catalog grid + My Requests table |
| `app/admin/medicine/page.tsx` | Create | HR: Catalog tab + Requests tab |
| `app/(dashboard)/layout.tsx` | Modify | Add Medicine nav item to sidebar |
| `app/admin/layout.tsx` | Modify | Add Medicine link to admin sidebar |

---

## Task 1: Prisma Schema + DB Migration

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add enum and models to schema**

Open `prisma/schema.prisma`. Add the following **after the last existing enum** (around line 60, after `enum MissionType`):

```prisma
enum MedicineRequestStatus {
  PENDING
  APPROVED
  REJECTED
}
```

Add the following **after the last existing model** (at the end of the file):

```prisma
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

- [ ] **Step 2: Add relations to the User model**

In the `User` model (search for `model User`), add these three lines to the relations block (anywhere among the other relation fields):

```prisma
  medicineItems    MedicineItem[]    @relation("MedicineItemsCreated")
  medicineRequests MedicineRequest[] @relation("MedicineRequestsMade")
  medicineApprovals MedicineRequest[] @relation("MedicineRequestsApproved")
```

- [ ] **Step 3: Run the raw SQL migration**

Run this command (do NOT use `prisma migrate dev` — it will break due to `document_chunks` drift):

```bash
npx prisma db execute --stdin <<'SQL'
DO $$ BEGIN
  CREATE TYPE "MedicineRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "MedicineItem" (
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

CREATE TABLE IF NOT EXISTS "MedicineRequest" (
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
SQL
```

Expected output: no errors. If you see "already exists" errors, that's fine — the `IF NOT EXISTS` and `DO $$ ... $$` guards handle re-runs.

- [ ] **Step 4: Regenerate Prisma client**

```bash
npx prisma generate
```

Expected: `✔ Generated Prisma Client`

- [ ] **Step 5: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no output (zero errors).

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: add MedicineItem and MedicineRequest schema models"
```

---

## Task 2: GET /api/medicine

**Files:**
- Create: `app/api/medicine/route.ts`

Returns the active catalog + the current user's own request history (last 50). The `pendingMedicineIds` array tells the client which Request buttons to disable.

- [ ] **Step 1: Create the file**

```typescript
// app/api/medicine/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [medicines, myRequests] = await Promise.all([
    prisma.medicineItem.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        imageUrl: true,
        caption: true,
        stockQuantity: true,
      },
    }),
    prisma.medicineRequest.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        medicineId: true,
        status: true,
        createdAt: true,
        medicine: { select: { name: true } },
      },
    }),
  ]);

  const pendingMedicineIds = myRequests
    .filter((r) => r.status === "PENDING")
    .map((r) => r.medicineId);

  return NextResponse.json({ data: { medicines, pendingMedicineIds, myRequests } });
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add app/api/medicine/route.ts
git commit -m "feat: add GET /api/medicine for employee catalog"
```

---

## Task 3: POST /api/medicine/[id]/request

**Files:**
- Create: `app/api/medicine/[id]/request/route.ts`

Guards: medicine must exist + be active, stock > 0, no existing PENDING request for same medicine by same user.

- [ ] **Step 1: Create the file**

```typescript
// app/api/medicine/[id]/request/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const medicine = await prisma.medicineItem.findUnique({
    where: { id },
    select: { id: true, isActive: true, stockQuantity: true },
  });
  if (!medicine || !medicine.isActive) {
    return NextResponse.json({ error: "Medicine not found" }, { status: 404 });
  }
  if (medicine.stockQuantity <= 0) {
    return NextResponse.json({ error: "Out of stock" }, { status: 409 });
  }

  const existing = await prisma.medicineRequest.findFirst({
    where: { medicineId: id, userId: user.id, status: "PENDING" },
  });
  if (existing) {
    return NextResponse.json(
      { error: "You already have a pending request for this medicine" },
      { status: 409 }
    );
  }

  const request = await prisma.medicineRequest.create({
    data: { medicineId: id, userId: user.id },
    select: { id: true, medicineId: true, status: true, createdAt: true },
  });

  return NextResponse.json({ data: request }, { status: 201 });
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add app/api/medicine/[id]/request/route.ts
git commit -m "feat: add POST /api/medicine/[id]/request for employee requests"
```

---

## Task 4: GET + POST /api/admin/medicine

**Files:**
- Create: `app/api/admin/medicine/route.ts`

GET returns all medicines (including inactive) for the admin catalog tab. POST creates a new medicine entry.

- [ ] **Step 1: Create the file**

```typescript
// app/api/admin/medicine/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, requireRole } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1).max(200),
  caption: z.string().min(1).max(500),
  imageUrl: z.string().url(),
  stockQuantity: z.number().int().min(0),
});

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!requireRole(user, ["HR_ADMIN"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const medicines = await prisma.medicineItem.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      imageUrl: true,
      caption: true,
      stockQuantity: true,
      isActive: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ data: medicines });
}

export async function POST(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!requireRole(user, ["HR_ADMIN"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const medicine = await prisma.medicineItem.create({
    data: { ...parsed.data, createdById: user!.id },
    select: {
      id: true,
      name: true,
      imageUrl: true,
      caption: true,
      stockQuantity: true,
      isActive: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ data: medicine }, { status: 201 });
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add app/api/admin/medicine/route.ts
git commit -m "feat: add GET+POST /api/admin/medicine for HR catalog management"
```

---

## Task 5: PATCH + DELETE /api/admin/medicine/[id]

**Files:**
- Create: `app/api/admin/medicine/[id]/route.ts`

PATCH accepts any subset of editable fields. DELETE is blocked if any PENDING requests exist for the medicine.

- [ ] **Step 1: Create the file**

```typescript
// app/api/admin/medicine/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, requireRole } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  caption: z.string().min(1).max(500).optional(),
  imageUrl: z.string().url().optional(),
  stockQuantity: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth(req);
  if (!requireRole(user, ["HR_ADMIN"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { name, caption, imageUrl, stockQuantity, isActive } = parsed.data;

  const updated = await prisma.medicineItem.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(caption !== undefined && { caption }),
      ...(imageUrl !== undefined && { imageUrl }),
      ...(stockQuantity !== undefined && { stockQuantity }),
      ...(isActive !== undefined && { isActive }),
    },
    select: {
      id: true,
      name: true,
      imageUrl: true,
      caption: true,
      stockQuantity: true,
      isActive: true,
    },
  });

  return NextResponse.json({ data: updated });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth(req);
  if (!requireRole(user, ["HR_ADMIN"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const pendingCount = await prisma.medicineRequest.count({
    where: { medicineId: id, status: "PENDING" },
  });
  if (pendingCount > 0) {
    return NextResponse.json(
      { error: "Cannot delete: there are pending requests for this medicine" },
      { status: 409 }
    );
  }

  await prisma.medicineItem.delete({ where: { id } });
  return NextResponse.json({ data: null });
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add app/api/admin/medicine/[id]/route.ts
git commit -m "feat: add PATCH+DELETE /api/admin/medicine/[id] for HR catalog edits"
```

---

## Task 6: GET /api/admin/medicine/requests

**Files:**
- Create: `app/api/admin/medicine/requests/route.ts`

Returns all requests (all statuses) ordered newest first, with medicine and user details included.

- [ ] **Step 1: Create the file**

```typescript
// app/api/admin/medicine/requests/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, requireRole } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!requireRole(user, ["HR_ADMIN"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const requests = await prisma.medicineRequest.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      medicine: { select: { id: true, name: true, imageUrl: true } },
      user: { select: { id: true, displayName: true, avatarUrl: true } },
      approvedBy: { select: { id: true, displayName: true } },
    },
  });

  return NextResponse.json({ data: requests });
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add app/api/admin/medicine/requests/route.ts
git commit -m "feat: add GET /api/admin/medicine/requests for HR dispense history"
```

---

## Task 7: PATCH /api/admin/medicine/requests/[id]

**Files:**
- Create: `app/api/admin/medicine/requests/[id]/route.ts`

Approve → status = APPROVED + stock decrements atomically in a transaction. Reject → status = REJECTED, stock unchanged. Both stamp `approvedById` and `approvedAt`. Returns 409 if request is not PENDING or if stock = 0 on approve.

- [ ] **Step 1: Create the file**

```typescript
// app/api/admin/medicine/requests/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, requireRole } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";
import { z } from "zod";

const schema = z.object({
  action: z.enum(["approve", "reject"]),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth(req);
  if (!requireRole(user, ["HR_ADMIN"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const request = await prisma.medicineRequest.findUnique({
    where: { id },
    select: { id: true, status: true, medicineId: true },
  });
  if (!request) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (request.status !== "PENDING") {
    return NextResponse.json({ error: "Request is no longer pending" }, { status: 409 });
  }

  if (parsed.data.action === "approve") {
    const medicine = await prisma.medicineItem.findUnique({
      where: { id: request.medicineId },
      select: { stockQuantity: true },
    });
    if (!medicine || medicine.stockQuantity <= 0) {
      return NextResponse.json({ error: "Out of stock" }, { status: 409 });
    }

    const [updatedRequest] = await prisma.$transaction([
      prisma.medicineRequest.update({
        where: { id },
        data: { status: "APPROVED", approvedById: user!.id, approvedAt: new Date() },
        select: { id: true, status: true, approvedAt: true, approvedById: true },
      }),
      prisma.medicineItem.update({
        where: { id: request.medicineId },
        data: { stockQuantity: { decrement: 1 } },
      }),
    ]);

    return NextResponse.json({ data: updatedRequest });
  }

  const updatedRequest = await prisma.medicineRequest.update({
    where: { id },
    data: { status: "REJECTED", approvedById: user!.id, approvedAt: new Date() },
    select: { id: true, status: true, approvedAt: true, approvedById: true },
  });

  return NextResponse.json({ data: updatedRequest });
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add app/api/admin/medicine/requests/[id]/route.ts
git commit -m "feat: add PATCH /api/admin/medicine/requests/[id] for HR approve/reject"
```

---

## Task 8: Employee Medicine Page

**Files:**
- Create: `app/(dashboard)/medicine/page.tsx`

Catalog grid of active medicines + My Requests history table. One-tap Request button per card. Pending state is tracked client-side after submit.

- [ ] **Step 1: Create the file**

```typescript
// app/(dashboard)/medicine/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useApiClient } from "@/lib/hooks/useApiClient";
import { useAuth } from "@/lib/auth/AuthProvider";

type Medicine = {
  id: string;
  name: string;
  imageUrl: string;
  caption: string;
  stockQuantity: number;
};

type MyRequest = {
  id: string;
  medicineId: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: string;
  medicine: { name: string };
};

const statusChip: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-700",
  APPROVED: "bg-emerald-100 text-emerald-700",
  REJECTED: "bg-red-100 text-red-600",
};

export default function MedicinePage() {
  const { apiFetch } = useApiClient();
  const { user, loading: authLoading } = useAuth();
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [myRequests, setMyRequests] = useState<MyRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading || !user) return;
    apiFetch<{ data: { medicines: Medicine[]; pendingMedicineIds: string[]; myRequests: MyRequest[] } }>(
      "/api/medicine"
    )
      .then((res) => {
        setMedicines(res.data.medicines);
        setPendingIds(new Set(res.data.pendingMedicineIds));
        setMyRequests(res.data.myRequests);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user]);

  async function handleRequest(medicineId: string) {
    setRequesting(medicineId);
    try {
      const res = await apiFetch<{ data: MyRequest }>(
        `/api/medicine/${medicineId}/request`,
        { method: "POST" }
      );
      const medicineName = medicines.find((m) => m.id === medicineId)?.name ?? "";
      setPendingIds((prev) => new Set([...prev, medicineId]));
      setMyRequests((prev) => [
        { ...res.data, medicine: { name: medicineName } },
        ...prev,
      ]);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to submit request");
    } finally {
      setRequesting(null);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Medicine</h1>
        <p className="text-gray-500 text-sm mt-1">
          Request a medicine from the company cabinet.
        </p>
      </div>

      {loading ? (
        <div className="text-center text-gray-400 py-16">Loading…</div>
      ) : medicines.length === 0 ? (
        <div className="text-center text-gray-400 py-16">No medicines available.</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {medicines.map((med) => {
            const isPending = pendingIds.has(med.id);
            const outOfStock = med.stockQuantity <= 0;
            const isRequesting = requesting === med.id;
            const disabled = isPending || outOfStock || isRequesting;
            return (
              <div
                key={med.id}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col"
              >
                <div className="aspect-square bg-gray-50 overflow-hidden">
                  <img
                    src={med.imageUrl}
                    alt={med.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="p-3 flex flex-col gap-2 flex-1">
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{med.name}</p>
                    <p className="text-gray-500 text-xs mt-0.5 line-clamp-2">{med.caption}</p>
                  </div>
                  <p className={`text-xs font-medium ${outOfStock ? "text-gray-400" : "text-emerald-600"}`}>
                    {outOfStock ? "Out of stock" : `${med.stockQuantity} in stock`}
                  </p>
                  <button
                    onClick={() => handleRequest(med.id)}
                    disabled={disabled}
                    className={`w-full py-1.5 rounded-lg text-xs font-semibold transition-colors mt-auto ${
                      isPending
                        ? "bg-amber-50 text-amber-600 cursor-default"
                        : outOfStock
                        ? "bg-gray-100 text-gray-400 cursor-default"
                        : "bg-[#111827] text-white hover:bg-gray-800"
                    }`}
                  >
                    {isRequesting ? "Submitting…" : isPending ? "Pending…" : "Request"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {myRequests.length > 0 && (
        <div>
          <h2 className="text-lg font-bold text-gray-900 mb-3">My Requests</h2>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Medicine
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Requested
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {myRequests.map((r) => (
                  <tr
                    key={r.id}
                    className="border-t border-gray-50 hover:bg-gray-50/60 transition-colors"
                  >
                    <td className="px-5 py-3 font-medium text-gray-900">{r.medicine.name}</td>
                    <td className="px-5 py-3 text-gray-500 text-sm">
                      {new Date(r.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusChip[r.status]}`}>
                        {r.status.charAt(0) + r.status.slice(1).toLowerCase()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add app/"(dashboard)"/medicine/page.tsx
git commit -m "feat: add employee medicine catalog page"
```

---

## Task 9: Admin Medicine Page

**Files:**
- Create: `app/admin/medicine/page.tsx`

Two tabs: Catalog (add/edit/delete medicines with Cloudinary image upload) and Requests (pending approval queue + full history). Approve is atomic via the API transaction.

- [ ] **Step 1: Create the file**

```typescript
// app/admin/medicine/page.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useApiClient } from "@/lib/hooks/useApiClient";
import { useAuth } from "@/lib/auth/AuthProvider";
import { uploadToCloudinary } from "@/lib/cloudinary/upload";
import { Pencil, Plus, Trash2, X } from "lucide-react";

type Medicine = {
  id: string;
  name: string;
  imageUrl: string;
  caption: string;
  stockQuantity: number;
  isActive: boolean;
};

type MedicineRequest = {
  id: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: string;
  approvedAt: string | null;
  medicine: { id: string; name: string; imageUrl: string };
  user: { id: string; displayName: string; avatarUrl: string | null };
  approvedBy: { id: string; displayName: string } | null;
};

type AddForm = {
  name: string;
  caption: string;
  stockQuantity: string;
  imageFile: File | null;
  imagePreview: string;
};

type EditForm = {
  name: string;
  caption: string;
  stockQuantity: string;
  imageUrl: string;
  imageFile: File | null;
  imagePreview: string;
  isActive: boolean;
};

const statusChip: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-700",
  APPROVED: "bg-emerald-100 text-emerald-700",
  REJECTED: "bg-red-100 text-red-600",
};

const inputClass =
  "w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500/30 bg-white";

export default function AdminMedicinePage() {
  const { apiFetch } = useApiClient();
  const { user, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<"catalog" | "requests">("catalog");

  // Catalog
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [loadingMeds, setLoadingMeds] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState<AddForm>({
    name: "", caption: "", stockQuantity: "", imageFile: null, imagePreview: "",
  });
  const [addingMed, setAddingMed] = useState(false);
  const [editingMed, setEditingMed] = useState<Medicine | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({
    name: "", caption: "", stockQuantity: "", imageUrl: "", imageFile: null, imagePreview: "", isActive: true,
  });
  const [savingEdit, setSavingEdit] = useState(false);
  const addImageRef = useRef<HTMLInputElement>(null);
  const editImageRef = useRef<HTMLInputElement>(null);

  // Requests
  const [requests, setRequests] = useState<MedicineRequest[]>([]);
  const [loadingReqs, setLoadingReqs] = useState(true);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [reqFilter, setReqFilter] = useState("");

  useEffect(() => {
    if (authLoading || !user) return;
    Promise.all([
      apiFetch<{ data: Medicine[] }>("/api/admin/medicine").then((r) => setMedicines(r.data)),
      apiFetch<{ data: MedicineRequest[] }>("/api/admin/medicine/requests").then((r) => setRequests(r.data)),
    ])
      .catch(console.error)
      .finally(() => { setLoadingMeds(false); setLoadingReqs(false); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user]);

  async function handleAdd() {
    if (!addForm.name.trim() || !addForm.caption.trim() || !addForm.imageFile || !addForm.stockQuantity) {
      alert("Please fill in all fields and upload an image.");
      return;
    }
    setAddingMed(true);
    try {
      const imageUrl = await uploadToCloudinary(addForm.imageFile);
      const res = await apiFetch<{ data: Medicine }>("/api/admin/medicine", {
        method: "POST",
        body: JSON.stringify({
          name: addForm.name.trim(),
          caption: addForm.caption.trim(),
          stockQuantity: parseInt(addForm.stockQuantity, 10),
          imageUrl,
        }),
      });
      setMedicines((prev) => [...prev, res.data].sort((a, b) => a.name.localeCompare(b.name)));
      setAddForm({ name: "", caption: "", stockQuantity: "", imageFile: null, imagePreview: "" });
      setShowAddForm(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to add medicine");
    } finally {
      setAddingMed(false);
    }
  }

  function openEdit(med: Medicine) {
    setEditingMed(med);
    setEditForm({
      name: med.name,
      caption: med.caption,
      stockQuantity: String(med.stockQuantity),
      imageUrl: med.imageUrl,
      imageFile: null,
      imagePreview: "",
      isActive: med.isActive,
    });
  }

  async function handleSaveEdit() {
    if (!editingMed) return;
    setSavingEdit(true);
    try {
      let imageUrl = editForm.imageUrl;
      if (editForm.imageFile) {
        imageUrl = await uploadToCloudinary(editForm.imageFile);
      }
      const res = await apiFetch<{ data: Medicine }>(`/api/admin/medicine/${editingMed.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: editForm.name.trim(),
          caption: editForm.caption.trim(),
          stockQuantity: parseInt(editForm.stockQuantity, 10),
          imageUrl,
          isActive: editForm.isActive,
        }),
      });
      setMedicines((prev) => prev.map((m) => (m.id === editingMed.id ? res.data : m)));
      setEditingMed(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleDelete(med: Medicine) {
    if (!confirm(`Delete "${med.name}"? This cannot be undone.`)) return;
    try {
      await apiFetch(`/api/admin/medicine/${med.id}`, { method: "DELETE" });
      setMedicines((prev) => prev.filter((m) => m.id !== med.id));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete");
    }
  }

  async function handleAction(requestId: string, action: "approve" | "reject") {
    setActioningId(requestId);
    try {
      const res = await apiFetch<{ data: { id: string; status: string; approvedAt: string } }>(
        `/api/admin/medicine/requests/${requestId}`,
        { method: "PATCH", body: JSON.stringify({ action }) }
      );
      const updated = res.data;
      setRequests((prev) =>
        prev.map((r) =>
          r.id === requestId
            ? { ...r, status: updated.status as MedicineRequest["status"], approvedAt: updated.approvedAt }
            : r
        )
      );
      if (action === "approve") {
        const req = requests.find((r) => r.id === requestId);
        if (req) {
          setMedicines((prev) =>
            prev.map((m) =>
              m.id === req.medicine.id ? { ...m, stockQuantity: Math.max(0, m.stockQuantity - 1) } : m
            )
          );
        }
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed");
    } finally {
      setActioningId(null);
    }
  }

  const pending = requests.filter((r) => r.status === "PENDING");
  const history = requests.filter((r) => r.status !== "PENDING");
  const filteredHistory = reqFilter
    ? history.filter(
        (r) =>
          r.medicine.name.toLowerCase().includes(reqFilter.toLowerCase()) ||
          r.user.displayName.toLowerCase().includes(reqFilter.toLowerCase())
      )
    : history;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Medicine</h1>
        <p className="text-gray-500 text-sm mt-1">Manage the medicine cabinet and dispense requests.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {(["catalog", "requests"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-1.5 text-sm font-semibold rounded-lg transition-colors capitalize ${
              activeTab === tab ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab}
            {tab === "requests" && pending.length > 0 && (
              <span className="ml-1.5 bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {pending.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Catalog Tab ── */}
      {activeTab === "catalog" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-[#111827] text-white rounded-xl hover:bg-gray-800 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Medicine
            </button>
          </div>

          {showAddForm && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
              <h3 className="font-semibold text-gray-900">New Medicine</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Name</label>
                  <input
                    value={addForm.name}
                    onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
                    className={inputClass}
                    placeholder="e.g. Biogesic"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Starting Stock</label>
                  <input
                    type="number"
                    min="0"
                    value={addForm.stockQuantity}
                    onChange={(e) => setAddForm((f) => ({ ...f, stockQuantity: e.target.value }))}
                    className={inputClass}
                    placeholder="0"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Caption</label>
                <input
                  value={addForm.caption}
                  onChange={(e) => setAddForm((f) => ({ ...f, caption: e.target.value }))}
                  className={inputClass}
                  placeholder="Short description of the medicine"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Photo</label>
                <input
                  ref={addImageRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) setAddForm((f) => ({ ...f, imageFile: file, imagePreview: URL.createObjectURL(file) }));
                  }}
                />
                {addForm.imagePreview ? (
                  <div className="relative w-24 h-24">
                    <img src={addForm.imagePreview} className="w-24 h-24 rounded-lg object-cover border border-gray-200" alt="" />
                    <button
                      onClick={() => setAddForm((f) => ({ ...f, imageFile: null, imagePreview: "" }))}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-gray-800 text-white rounded-full flex items-center justify-center"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => addImageRef.current?.click()}
                    className="px-4 py-2 text-sm border border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-gray-400 transition-colors"
                  >
                    Choose photo
                  </button>
                )}
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAdd}
                  disabled={addingMed}
                  className="px-4 py-2 text-sm font-semibold text-white bg-[#111827] rounded-xl hover:bg-gray-800 disabled:opacity-50"
                >
                  {addingMed ? "Uploading…" : "Add Medicine"}
                </button>
              </div>
            </div>
          )}

          {loadingMeds ? (
            <div className="text-center text-gray-400 py-12">Loading…</div>
          ) : medicines.length === 0 ? (
            <div className="text-center text-gray-400 py-12">No medicines yet. Add one above.</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {medicines.map((med) => (
                <div
                  key={med.id}
                  className={`bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col ${!med.isActive ? "opacity-50" : ""}`}
                >
                  <div className="aspect-square bg-gray-50 overflow-hidden relative">
                    <img src={med.imageUrl} alt={med.name} className="w-full h-full object-cover" />
                    {!med.isActive && (
                      <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                        <span className="text-white text-xs font-semibold bg-gray-800/80 px-2 py-0.5 rounded-full">
                          Inactive
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="p-3 flex flex-col gap-1 flex-1">
                    <p className="font-semibold text-gray-900 text-sm">{med.name}</p>
                    <p className="text-gray-500 text-xs line-clamp-2">{med.caption}</p>
                    <p className={`text-xs font-medium mt-1 ${med.stockQuantity === 0 ? "text-red-500" : "text-emerald-600"}`}>
                      {med.stockQuantity} in stock
                    </p>
                    <div className="flex gap-1 mt-2">
                      <button
                        onClick={() => openEdit(med)}
                        className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs font-medium border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
                      >
                        <Pencil className="w-3 h-3" /> Edit
                      </button>
                      <button
                        onClick={() => handleDelete(med)}
                        className="p-1.5 border border-gray-200 rounded-lg text-red-400 hover:bg-red-50 hover:border-red-200 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Requests Tab ── */}
      {activeTab === "requests" && (
        <div className="space-y-6">
          {loadingReqs ? (
            <div className="text-center text-gray-400 py-12">Loading…</div>
          ) : (
            <>
              {pending.length > 0 && (
                <div>
                  <h2 className="text-base font-semibold text-gray-900 mb-3">
                    Pending ({pending.length})
                  </h2>
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Employee</th>
                          <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Medicine</th>
                          <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Requested</th>
                          <th className="px-5 py-3" />
                        </tr>
                      </thead>
                      <tbody>
                        {pending.map((r) => (
                          <tr key={r.id} className="border-t border-gray-50">
                            <td className="px-5 py-3 font-medium text-gray-900">{r.user.displayName}</td>
                            <td className="px-5 py-3 text-gray-700">{r.medicine.name}</td>
                            <td className="px-5 py-3 text-gray-500 text-xs">
                              {new Date(r.createdAt).toLocaleDateString("en-US", {
                                month: "short", day: "numeric", year: "numeric",
                              })}
                            </td>
                            <td className="px-5 py-3">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => handleAction(r.id, "approve")}
                                  disabled={actioningId === r.id}
                                  className="px-3 py-1.5 text-xs font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                                >
                                  Approve
                                </button>
                                <button
                                  onClick={() => handleAction(r.id, "reject")}
                                  disabled={actioningId === r.id}
                                  className="px-3 py-1.5 text-xs font-semibold border border-red-200 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors"
                                >
                                  Reject
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-base font-semibold text-gray-900">History</h2>
                  <input
                    placeholder="Filter by employee or medicine…"
                    value={reqFilter}
                    onChange={(e) => setReqFilter(e.target.value)}
                    className="w-60 px-3 py-1.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-navy-500/30"
                  />
                </div>
                {filteredHistory.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-8">No history yet.</p>
                ) : (
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Employee</th>
                          <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Medicine</th>
                          <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Requested</th>
                          <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                          <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Actioned by</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredHistory.map((r) => (
                          <tr
                            key={r.id}
                            className="border-t border-gray-50 hover:bg-gray-50/60 transition-colors"
                          >
                            <td className="px-5 py-3 font-medium text-gray-900">{r.user.displayName}</td>
                            <td className="px-5 py-3 text-gray-700">{r.medicine.name}</td>
                            <td className="px-5 py-3 text-gray-500 text-sm">
                              {new Date(r.createdAt).toLocaleDateString("en-US", {
                                month: "short", day: "numeric", year: "numeric",
                              })}
                            </td>
                            <td className="px-5 py-3">
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusChip[r.status]}`}>
                                {r.status.charAt(0) + r.status.slice(1).toLowerCase()}
                              </span>
                            </td>
                            <td className="px-5 py-3 text-gray-500 text-sm">
                              {r.approvedBy?.displayName ?? "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Edit Modal ── */}
      {editingMed && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Edit Medicine</h2>
              <button onClick={() => setEditingMed(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Name</label>
                <input
                  value={editForm.name}
                  onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Caption</label>
                <input
                  value={editForm.caption}
                  onChange={(e) => setEditForm((f) => ({ ...f, caption: e.target.value }))}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Stock Quantity</label>
                <input
                  type="number"
                  min="0"
                  value={editForm.stockQuantity}
                  onChange={(e) => setEditForm((f) => ({ ...f, stockQuantity: e.target.value }))}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Photo</label>
                <input
                  ref={editImageRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) setEditForm((f) => ({ ...f, imageFile: file, imagePreview: URL.createObjectURL(file) }));
                  }}
                />
                <div className="flex items-center gap-3">
                  <img
                    src={editForm.imagePreview || editForm.imageUrl}
                    alt=""
                    className="w-16 h-16 rounded-lg object-cover border border-gray-200"
                  />
                  <button
                    onClick={() => editImageRef.current?.click()}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    Change photo
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Active</label>
                <button
                  type="button"
                  onClick={() => setEditForm((f) => ({ ...f, isActive: !f.isActive }))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${editForm.isActive ? "bg-emerald-500" : "bg-gray-200"}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${editForm.isActive ? "translate-x-6" : "translate-x-1"}`} />
                </button>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setEditingMed(null)}
                className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={savingEdit}
                className="px-4 py-2 text-sm font-semibold text-white bg-[#111827] rounded-xl hover:bg-gray-800 disabled:opacity-50"
              >
                {savingEdit ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add app/admin/medicine/page.tsx
git commit -m "feat: add admin medicine page with catalog and requests tabs"
```

---

## Task 10: Navigation Updates

**Files:**
- Modify: `app/(dashboard)/layout.tsx`
- Modify: `app/admin/layout.tsx`

- [ ] **Step 1: Add Medicine to dashboard sidebar**

In `app/(dashboard)/layout.tsx`, find the import line:

```typescript
import {
  Home, ShoppingBag, Trophy, User, ShieldCheck, LogOut,
  Rss, Gamepad2, Menu, Target, UtensilsCrossed, MessageSquare, Sparkles, Swords, Search,
} from "lucide-react";
```

Replace with (adds `Pill`):

```typescript
import {
  Home, ShoppingBag, Trophy, User, ShieldCheck, LogOut,
  Rss, Gamepad2, Menu, Target, UtensilsCrossed, MessageSquare, Sparkles, Swords, Search, Pill,
} from "lucide-react";
```

Find the `mainNav` array and add the Medicine entry after the Food entry:

```typescript
const mainNav = [
  { href: "/dashboard",   label: "Home",        icon: Home },
  { href: "/feed",        label: "Feed",        icon: Rss },
  { href: "/missions",    label: "Missions",    icon: Target },
  { href: "/marketplace", label: "Marketplace", icon: ShoppingBag },
  { href: "/food",        label: "Food",        icon: UtensilsCrossed },
  { href: "/medicine",    label: "Medicine",    icon: Pill },
  { href: "/games",       label: "Games",       icon: Gamepad2 },
  { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
  { href: "/shoutouts",   label: "Shoutouts",   icon: Sparkles },
  { href: "/challenges",  label: "Challenges",  icon: Swords },
  { href: "/profile",     label: "Profile",     icon: User },
  { href: "/feedback",    label: "Feedback",    icon: MessageSquare },
];
```

- [ ] **Step 2: Add Medicine to admin sidebar**

In `app/admin/layout.tsx`, find the import line:

```typescript
import { Users, Award, LayoutDashboard, LogOut, ShoppingBag, ClipboardList, Gamepad2, Building2, Target, MessageSquare, Gift, Swords, FileText } from "lucide-react";
```

Replace with (adds `Pill`):

```typescript
import { Users, Award, LayoutDashboard, LogOut, ShoppingBag, ClipboardList, Gamepad2, Building2, Target, MessageSquare, Gift, Swords, FileText, Pill } from "lucide-react";
```

Find the `navItems` array and add the Medicine entry (after Documents is a natural fit):

```typescript
const navItems = [
  { href: "/admin",             label: "Overview",     icon: LayoutDashboard },
  { href: "/admin/employees",   label: "Employees",    icon: Users },
  { href: "/admin/departments", label: "Departments",  icon: Building2 },
  { href: "/admin/missions",    label: "Missions",     icon: Target },
  { href: "/admin/milestones",  label: "Milestones",   icon: Gift },
  { href: "/admin/challenges",  label: "Challenges",   icon: Swords },
  { href: "/admin/points",      label: "Award Points", icon: Award },
  { href: "/admin/rewards",     label: "Rewards",      icon: ShoppingBag },
  { href: "/admin/redemptions", label: "Redemptions",  icon: ClipboardList },
  { href: "/admin/games",       label: "Games",        icon: Gamepad2 },
  { href: "/admin/feedback",    label: "Feedback",     icon: MessageSquare },
  { href: "/admin/documents",   label: "Documents",    icon: FileText },
  { href: "/admin/medicine",    label: "Medicine",     icon: Pill },
];
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no output.

- [ ] **Step 4: Verify in browser**

With the dev server running on port 3001:
1. Open http://localhost:3001 — confirm "Medicine" appears in the left sidebar between Food and Games
2. Click Medicine — confirm the catalog page loads (empty state: "No medicines available.")
3. Open http://localhost:3001/admin/medicine — confirm the admin page loads with Catalog and Requests tabs
4. Add a medicine via the admin Catalog tab — confirm it appears in the employee catalog page

- [ ] **Step 5: Commit**

```bash
git add app/"(dashboard)"/layout.tsx app/admin/layout.tsx
git commit -m "feat: add Medicine nav item to dashboard and admin sidebars"
```
