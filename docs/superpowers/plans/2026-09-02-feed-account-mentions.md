# Feed Account Mentions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let employees tag a client account (e.g. `#Flyland`, `#EMB`) in a Feed post, comment, or
reply — a purely visual pill, styled and behaved distinctly from the existing `@employee` mention,
backed by a small HR-admin-managed `Account` list.

**Architecture:** A new, thin `Account` Prisma model (name only) with standard HR-admin CRUD
routes and an admin page mirroring the existing `Department` admin screen exactly. A new
`useAccountTagInput` hook mirrors the shape of the existing `useMentionInput` hook file-for-file
(own `#` trigger regex, own `#[Name|id]` token format) and a new `AccountTagDropdown` component
mirrors `MentionDropdown`. Both are wired in *alongside* — never replacing — the existing
`@`-mention code in all three composer locations (Feed post composer, comment composer, reply
composer). Rendering both token formats is unified in the one shared component both post and
comment display already render through, `PostMentionText.tsx`.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript strict, Prisma 7 / PostgreSQL,
Tailwind v4, `lucide-react`, Vitest (`node` environment, `.test.ts` only — no component/hook
rendering tests exist in this repo; see Global Constraints).

Full design rationale: `docs/superpowers/specs/2026-09-02-feed-account-mentions-design.md`.

## Global Constraints

- Design tokens: only Command Black + Brand Navy (`navy-*`) are the app's "real" colors, plus
  `emerald-*`/`amber-*`/`rose-*` as semantic accents (icon/label only, never decorative). Account
  pills use **neutral gray** (`bg-gray-100`/`text-gray-700`-family, matching `Pagination`'s
  existing `bg-muted`/`text-muted-foreground` semantic tokens where reasonable) — deliberately not
  navy, so it reads as "an entity, not a person."
- API response shape: success is `{ data: ... }`, errors are `{ error: ... }` (see
  `app/api/admin/departments/route.ts` for the exact pattern to mirror).
- Every admin write route: `verifyAuth(req)` then `requireRole(user, ["HR_ADMIN", "SUPER_ADMIN"])`
  before touching the database, returning `403` with `{ error: "Forbidden" }` on failure.
  `requireRole` is a TypeScript type predicate (`user is AuthUser`) — after a passing
  `requireRole` check, `user` is narrowed to non-null `AuthUser`, no `!` assertion needed.
- No React Testing Library / jsdom in this repo — `vitest.config.mts` runs `environment: "node"`
  and only collects `**/*.test.ts` (not `.tsx`). Hooks and components are **not** unit-rendered in
  tests anywhere in this codebase (`useMentionInput.ts`, the hook this plan's new hook mirrors,
  has zero test file). Do not attempt to add React-rendering tests for `useAccountTagInput` or
  `AccountTagDropdown` — that would be inconsistent with the rest of the codebase and would
  require dependencies not installed. Test only: (a) pure exported functions (e.g.
  `hasAccountTagTrigger`, mirroring the existing tested-by-precedent-but-untested
  `hasMentionTrigger` — see Task 5, we add a test `useMentionInput` itself lacks, which is an
  improvement, not a gap), and (b) API route handlers (mirroring
  `app/api/admin/employees/sync/route.test.ts`'s mocking pattern).
- Migrations: use `npx prisma migrate dev --name <description>`, never hand-author a migration
  SQL file — this repo's Prisma client output is `lib/generated/prisma`, not the default location
  (`prisma generate` runs automatically via the `postinstall` script and on every `npm run build`).
- Commit prefix `feat:`/`fix:`/`test:`/`docs:` matching this repo's existing convention (see
  `git log --oneline`).
- Verification bar per task (no test runner covers UI wiring): `npm run lint` and `npm run build`
  must both pass; for any UI change, also manually verify via `npm run dev` (port 3010) — describe
  exactly what was clicked/typed and what should be observed, not just "should work."

---

### Task 1: `Account` Prisma model + migration

**Files:**
- Modify: `prisma/schema.prisma`
- Create (via CLI, not hand-authored): `prisma/migrations/<timestamp>_add_account_model/migration.sql`

**Interfaces:**
- Produces: `Account { id: string, name: string, createdAt: Date }` — a new Prisma model and
  generated client type (`lib/generated/prisma/client`), consumed by Tasks 2 and 3.

- [ ] **Step 1: Add the `Account` model to the schema**

Open `prisma/schema.prisma`, find the `model Department { ... }` block (around line 135), and add
a new model immediately after it:

```prisma
model Account {
  id        String   @id @default(uuid())
  name      String   @unique
  createdAt DateTime @default(now())
}
```

- [ ] **Step 2: Generate and apply the migration**

Run: `npx prisma migrate dev --name add_account_model`
Expected: prints `Applying migration '<timestamp>_add_account_model'`, then
`Your database is now in sync with your schema.`, then regenerates the Prisma client
(`✔ Generated Prisma Client`).

- [ ] **Step 3: Verify the generated client has the new model**

Run: `grep -n "class AccountDelegate\|accountDelegate\|model Account" lib/generated/prisma/client/index.d.ts | head -5`
Expected: at least one match confirming `Account` was generated into the client types. (Exact
symbol names vary by Prisma's generator internals — the point of this check is confirming
generation ran, not matching an exact string.)

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat: add Account model for Feed #account mentions"
```

---

### Task 2: Admin API routes (`/api/admin/accounts`)

**Files:**
- Create: `app/api/admin/accounts/route.ts`
- Create: `app/api/admin/accounts/[id]/route.ts`
- Create: `app/api/admin/accounts/route.test.ts`
- Modify: `lib/realtime/topics.ts`

**Interfaces:**
- Consumes: `Account` model from Task 1; `verifyAuth`/`requireRole` from `@/lib/auth/verifyAuth`;
  `prisma` from `@/lib/prisma/client`; `parsePaginationParams`/`paginatedResponse` from
  `@/lib/api/pagination`; `scheduleBroadcast` from `@/lib/realtime/broadcast`.
- Produces: `GET /api/admin/accounts` → `{ data: {id,name,createdAt}[], page, pages, total }`
  (exact shape from `paginatedResponse`, mirrored from the departments route);
  `POST /api/admin/accounts` body `{ name: string }` → `{ data: {id,name,createdAt} }`, 201;
  `PATCH /api/admin/accounts/[id]` body `{ name: string }` → `{ data: {id,name,createdAt} }`;
  `DELETE /api/admin/accounts/[id]` → `{ data: { id } }`. Consumed by Task 4 (admin page).

- [ ] **Step 1: Add the `accounts` realtime topic**

Open `lib/realtime/topics.ts`, find the line `departments: "departments",` (around line 14), add
immediately after it:

```ts
  accounts: "accounts",
```

- [ ] **Step 2: Write `app/api/admin/accounts/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, requireRole } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";
import { parsePaginationParams, paginatedResponse } from "@/lib/api/pagination";
import { z } from "zod";
import { scheduleBroadcast } from "@/lib/realtime/broadcast";
import { realtimeTopics } from "@/lib/realtime/topics";

const createSchema = z.object({
  name: z.string().min(1),
});

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!requireRole(user, ["HR_ADMIN", "SUPER_ADMIN"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const { page, limit, skip } = parsePaginationParams(searchParams);

  const [accounts, total] = await Promise.all([
    prisma.account.findMany({
      orderBy: { name: "asc" },
      skip,
      take: limit,
      select: { id: true, name: true, createdAt: true },
    }),
    prisma.account.count(),
  ]);

  return NextResponse.json(paginatedResponse(accounts, total, page, limit));
}

export async function POST(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!requireRole(user, ["HR_ADMIN", "SUPER_ADMIN"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const existing = await prisma.account.findUnique({
    where: { name: parsed.data.name },
  });
  if (existing) {
    return NextResponse.json(
      { error: "Account name already exists" },
      { status: 400 }
    );
  }

  const account = await prisma.account.create({
    data: { name: parsed.data.name },
    select: { id: true, name: true, createdAt: true },
  });

  scheduleBroadcast([{ topic: realtimeTopics.accounts }]);

  return NextResponse.json({ data: account }, { status: 201 });
}
```

- [ ] **Step 3: Write `app/api/admin/accounts/[id]/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, requireRole } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";
import { z } from "zod";
import { scheduleBroadcast } from "@/lib/realtime/broadcast";
import { realtimeTopics } from "@/lib/realtime/topics";

const updateSchema = z.object({
  name: z.string().min(1),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth(req);
  if (!requireRole(user, ["HR_ADMIN", "SUPER_ADMIN"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const conflict = await prisma.account.findFirst({
    where: { name: parsed.data.name, NOT: { id } },
  });
  if (conflict) {
    return NextResponse.json(
      { error: "Account name already exists" },
      { status: 400 }
    );
  }

  const account = await prisma.account.update({
    where: { id },
    data: { name: parsed.data.name },
    select: { id: true, name: true, createdAt: true },
  });

  scheduleBroadcast([{ topic: realtimeTopics.accounts }]);

  return NextResponse.json({ data: account });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth(req);
  if (!requireRole(user, ["HR_ADMIN", "SUPER_ADMIN"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  await prisma.account.delete({ where: { id } });

  scheduleBroadcast([{ topic: realtimeTopics.accounts }]);

  return NextResponse.json({ data: { id } });
}
```

Note: unlike `Department`, `Account` has no relation to `User`, so `DELETE` doesn't need the
employee-count guard the department route has — deleting an account can never orphan a foreign
key, since account mentions are just text tokens (`#[Name|id]`) baked into post/comment content,
not a live relation. A deleted account's existing mention pills keep rendering their last-known
name (the name was captured into the token at mention time) but their `id` no longer resolves to
a real row — this is the same accepted behavior as an `@`-mentioned employee who later leaves.

- [ ] **Step 4: Write `app/api/admin/accounts/route.test.ts`**

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const doubles = vi.hoisted(() => ({
  verifyAuth: vi.fn(),
  accountFindMany: vi.fn(),
  accountCount: vi.fn(),
  accountFindUnique: vi.fn(),
  accountCreate: vi.fn(),
  scheduleBroadcast: vi.fn(),
}));

vi.mock("@/lib/auth/verifyAuth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth/requireRole")>(
    "@/lib/auth/requireRole"
  );
  return { verifyAuth: doubles.verifyAuth, requireRole: actual.requireRole };
});

vi.mock("@/lib/prisma/client", () => ({
  prisma: {
    account: {
      findMany: doubles.accountFindMany,
      count: doubles.accountCount,
      findUnique: doubles.accountFindUnique,
      create: doubles.accountCreate,
    },
  },
}));

vi.mock("@/lib/realtime/broadcast", () => ({
  scheduleBroadcast: doubles.scheduleBroadcast,
}));

import { GET, POST } from "./route";

const HR_ADMIN = {
  id: "hr-1",
  firebaseUid: "fb-hr-1",
  email: "hr@ags.test",
  displayName: "HR Admin",
  role: "HR_ADMIN" as const,
  departmentId: null,
};

const EMPLOYEE = { ...HR_ADMIN, id: "emp-1", role: "EMPLOYEE" as const };

function req(url: string, init?: RequestInit) {
  return new Request(url, init) as unknown as Parameters<typeof GET>[0];
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/admin/accounts", () => {
  it("returns 403 for a non-admin caller", async () => {
    doubles.verifyAuth.mockResolvedValue(EMPLOYEE);
    const res = await GET(req("http://test/api/admin/accounts"));
    expect(res.status).toBe(403);
  });

  it("returns the account list for an HR_ADMIN caller", async () => {
    doubles.verifyAuth.mockResolvedValue(HR_ADMIN);
    doubles.accountFindMany.mockResolvedValue([
      { id: "a1", name: "EMB", createdAt: new Date("2026-01-01") },
      { id: "a2", name: "Flyland", createdAt: new Date("2026-01-02") },
    ]);
    doubles.accountCount.mockResolvedValue(2);
    const res = await GET(req("http://test/api/admin/accounts"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(2);
    expect(body.data[0].name).toBe("EMB");
  });
});

describe("POST /api/admin/accounts", () => {
  it("returns 403 for a non-admin caller", async () => {
    doubles.verifyAuth.mockResolvedValue(EMPLOYEE);
    const res = await POST(req("http://test/api/admin/accounts", {
      method: "POST",
      body: JSON.stringify({ name: "Flyland" }),
    }));
    expect(res.status).toBe(403);
  });

  it("rejects a duplicate name", async () => {
    doubles.verifyAuth.mockResolvedValue(HR_ADMIN);
    doubles.accountFindUnique.mockResolvedValue({ id: "existing", name: "Flyland" });
    const res = await POST(req("http://test/api/admin/accounts", {
      method: "POST",
      body: JSON.stringify({ name: "Flyland" }),
    }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/already exists/);
  });

  it("creates an account and broadcasts", async () => {
    doubles.verifyAuth.mockResolvedValue(HR_ADMIN);
    doubles.accountFindUnique.mockResolvedValue(null);
    doubles.accountCreate.mockResolvedValue({
      id: "a3",
      name: "Flyland",
      createdAt: new Date("2026-01-03"),
    });
    const res = await POST(req("http://test/api/admin/accounts", {
      method: "POST",
      body: JSON.stringify({ name: "Flyland" }),
    }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.name).toBe("Flyland");
    expect(doubles.scheduleBroadcast).toHaveBeenCalledWith([{ topic: "accounts" }]);
  });
});
```

- [ ] **Step 5: Run the test**

Run: `npx vitest run app/api/admin/accounts/route.test.ts`
Expected: all 5 tests pass.

- [ ] **Step 6: Verify lint and build**

Run: `npm run lint && npm run build`
Expected: both succeed with no new errors.

- [ ] **Step 7: Commit**

```bash
git add app/api/admin/accounts lib/realtime/topics.ts
git commit -m "feat: add admin CRUD API routes for Account"
```

---

### Task 3: Public read API route (`/api/accounts`)

**Files:**
- Create: `app/api/accounts/route.ts`
- Create: `app/api/accounts/route.test.ts`

**Interfaces:**
- Consumes: `Account` model from Task 1.
- Produces: `GET /api/accounts` → `{ data: {id: string, name: string}[] }`, any authenticated
  user. Consumed by Task 8 (`ensureAccountsLoaded` in `useFeedActions.ts`).

- [ ] **Step 1: Write `app/api/accounts/route.ts`**

Mirrors `app/api/employees/route.ts`'s shape (any authenticated user, no role check) — but
without that route's pagination-avoidance comment/cap, since the account list is expected to stay
small (a handful of client accounts, not hundreds of employees):

```ts
import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const accounts = await prisma.account.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return NextResponse.json({ data: accounts });
}
```

- [ ] **Step 2: Write `app/api/accounts/route.test.ts`**

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const doubles = vi.hoisted(() => ({
  verifyAuth: vi.fn(),
  accountFindMany: vi.fn(),
}));

vi.mock("@/lib/auth/verifyAuth", () => ({
  verifyAuth: doubles.verifyAuth,
}));

vi.mock("@/lib/prisma/client", () => ({
  prisma: { account: { findMany: doubles.accountFindMany } },
}));

import { GET } from "./route";

function req(url: string) {
  return new Request(url) as unknown as Parameters<typeof GET>[0];
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/accounts", () => {
  it("returns 401 when unauthenticated", async () => {
    doubles.verifyAuth.mockResolvedValue(null);
    const res = await GET(req("http://test/api/accounts"));
    expect(res.status).toBe(401);
  });

  it("returns the account list for any authenticated user", async () => {
    doubles.verifyAuth.mockResolvedValue({ id: "u1", role: "EMPLOYEE" });
    doubles.accountFindMany.mockResolvedValue([
      { id: "a1", name: "EMB" },
      { id: "a2", name: "Flyland" },
    ]);
    const res = await GET(req("http://test/api/accounts"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual([
      { id: "a1", name: "EMB" },
      { id: "a2", name: "Flyland" },
    ]);
  });
});
```

- [ ] **Step 3: Run the test**

Run: `npx vitest run app/api/accounts/route.test.ts`
Expected: both tests pass.

- [ ] **Step 4: Verify lint and build**

Run: `npm run lint && npm run build`
Expected: both succeed with no new errors.

- [ ] **Step 5: Commit**

```bash
git add app/api/accounts
git commit -m "feat: add public read-only /api/accounts route"
```

---

### Task 4: Admin `/admin/accounts` page + nav link

**Files:**
- Create: `app/admin/accounts/page.tsx`
- Modify: `app/admin/layout.tsx:22-24`

**Interfaces:**
- Consumes: `GET/POST /api/admin/accounts`, `PATCH/DELETE /api/admin/accounts/[id]` from Task 2;
  `useApiClient`, `useAuth`, `useRealtimeChannel`, `realtimeTopics.accounts`, `Pagination`
  (all existing, same imports `app/admin/departments/page.tsx` already uses).
- Produces: nothing consumed by a later task — this is the terminal admin-management surface.

- [ ] **Step 1: Write `app/admin/accounts/page.tsx`**

Mirrors `app/admin/departments/page.tsx` exactly, minus the `description` field and the
`employeeCount` column (Account has neither):

```tsx
"use client";

import { useEffect, useState } from "react";
import { useApiClient } from "@/lib/hooks/useApiClient";
import { useAuth } from "@/lib/auth/AuthProvider";
import { Loader2, Building2 } from "lucide-react";
import { toast } from "sonner";
import { Pagination } from "@/components/ui/pagination";
import { useRealtimeChannel } from "@/lib/hooks/useRealtimeChannel";
import { realtimeTopics } from "@/lib/realtime/topics";

type Account = {
  id: string;
  name: string;
  createdAt: string;
};

export default function AccountsPage() {
  const { apiFetch } = useApiClient();
  const { user, loading: authLoading } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createError, setCreateError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editError, setEditError] = useState("");
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  async function loadAccounts() {
    try {
      const r = await apiFetch<{ data: Account[]; pages: number }>(`/api/admin/accounts?page=${page}`);
      setAccounts(r.data);
      setPages(r.pages);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (authLoading || !user) return;
    queueMicrotask(loadAccounts);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user, page]);

  useRealtimeChannel(realtimeTopics.accounts, loadAccounts, { debounceMs: 200 });

  async function handleCreate() {
    if (!createName.trim()) {
      setCreateError("Name is required");
      return;
    }
    setSaving(true);
    setCreateError("");
    try {
      const res = await apiFetch<{ data: Account }>("/api/admin/accounts", {
        method: "POST",
        body: JSON.stringify({ name: createName.trim() }),
      });
      setAccounts((prev) => [...prev, res.data].sort((a, b) => a.name.localeCompare(b.name)));
      setShowCreateForm(false);
      setCreateName("");
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create");
    } finally {
      setSaving(false);
    }
  }

  function startEdit(acct: Account) {
    setEditingId(acct.id);
    setEditName(acct.name);
    setEditError("");
  }

  async function handleEdit(id: string) {
    if (!editName.trim()) {
      setEditError("Name is required");
      return;
    }
    setSaving(true);
    setEditError("");
    try {
      const res = await apiFetch<{ data: Account }>(`/api/admin/accounts/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: editName.trim() }),
      });
      setAccounts((prev) =>
        prev
          .map((a) => (a.id === id ? { ...a, ...res.data } : a))
          .sort((a, b) => a.name.localeCompare(b.name))
      );
      setEditingId(null);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete(acct: Account) {
    try {
      await apiFetch(`/api/admin/accounts/${acct.id}`, { method: "DELETE" });
      setAccounts((prev) => prev.filter((a) => a.id !== acct.id));
      setDeleteConfirmId(null);
      toast.success(`"${acct.name}" deleted.`);
    } catch (err) {
      setDeleteConfirmId(null);
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Accounts</h1>
          <p className="text-gray-500 text-sm mt-1">Manage client accounts employees can tag in Feed posts.</p>
        </div>
        {!showCreateForm && (
          <button
            onClick={() => { setShowCreateForm(true); setCreateError(""); }}
            className="bg-command-black text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900"
          >
            New Account
          </button>
        )}
      </div>

      {showCreateForm && (
        <div className="bg-white rounded-card border border-table-border p-6 space-y-4">
          <h2 className="text-base font-semibold text-gray-800">New Account</h2>
          {createError && <p className="text-sm text-red-500">{createError}</p>}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-400"
              placeholder="e.g. Flyland"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={saving}
              className="bg-command-black text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900"
            >
              {saving ? "Saving..." : "Save"}
            </button>
            <button
              onClick={() => { setShowCreateForm(false); setCreateName(""); setCreateError(""); }}
              className="border border-gray-300 text-gray-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-card border border-table-border overflow-clip">
        {loading ? (
          <div role="status" aria-live="polite" className="flex items-center justify-center gap-2 py-8 text-gray-500 text-sm"><Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />Loading…</div>
        ) : accounts.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 p-8">
            <Building2 className="w-8 h-8 text-gray-300" aria-hidden="true" />
            <p className="text-sm text-gray-500">No accounts yet.</p>
          </div>
        ) : (
          <div className="overflow-auto max-h-[70vh] scroll-hint">
          <table className="w-full border-collapse" aria-label="Accounts">
            <thead className="sticky top-0 z-10 bg-table-head">
              <tr className="border-b border-table-border">
                <th scope="col" className="text-left font-mono text-[10px] tracking-[0.09em] uppercase text-table-muted px-3.5 py-2.5 first:pl-5 last:pr-5">Name</th>
                <th scope="col" className="px-3.5 py-2.5 last:pr-5"></th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((acct, i) => (
                <tr key={acct.id} className={`border-b border-row-border transition-colors hover:bg-row-hover ${i % 2 === 1 && editingId !== acct.id ? "bg-row-alt" : ""}`}>
                  {editingId === acct.id ? (
                    <td colSpan={2} className="px-3.5 py-4 first:pl-5 last:pr-5">
                      <div className="space-y-3">
                        {editError && <p className="text-sm text-red-500">{editError}</p>}
                        <div className="flex flex-wrap gap-3">
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-400 w-full sm:w-48"
                            placeholder="Name"
                          />
                          <button
                            onClick={() => handleEdit(acct.id)}
                            disabled={saving}
                            className="bg-command-black text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900"
                          >
                            {saving ? "Saving..." : "Save"}
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="border border-gray-300 text-gray-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </td>
                  ) : (
                    <>
                      <td className="px-3.5 py-[11px] text-[13px] first:pl-5 last:pr-5 font-medium text-gray-900">{acct.name}</td>
                      <td className="px-3.5 py-[11px] text-[13px] first:pl-5 last:pr-5 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => startEdit(acct)}
                            className="text-navy-600 hover:text-navy-800 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-500 rounded"
                          >
                            Edit
                          </button>
                          {deleteConfirmId === acct.id ? (
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-red-600 font-medium">Delete?</span>
                              <button onClick={() => confirmDelete(acct)} className="text-xs text-red-600 font-semibold hover:text-red-800 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-red-500 rounded">Yes</button>
                              <button onClick={() => setDeleteConfirmId(null)} className="text-xs text-gray-500 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-400 rounded">No</button>
                            </div>
                          ) : (
                            <button onClick={() => setDeleteConfirmId(acct.id)} className="text-red-500 hover:text-red-700 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 rounded">Delete</button>
                          )}
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>
      <Pagination page={page} pages={pages} onPageChange={setPage} />
    </div>
  );
}
```

- [ ] **Step 2: Add the nav link**

Open `app/admin/layout.tsx`, find:

```tsx
    label: "People",
    items: [
      { href: "/admin/employees",   label: "Employees",    icon: Users },
      { href: "/admin/departments", label: "Departments",  icon: Building2 },
    ],
  },
```

Replace with:

```tsx
    label: "People",
    items: [
      { href: "/admin/employees",   label: "Employees",    icon: Users },
      { href: "/admin/departments", label: "Departments",  icon: Building2 },
      { href: "/admin/accounts",    label: "Accounts",     icon: Building2 },
    ],
  },
```

(`Building2` is already imported in this file for the Departments entry — no new import needed.)

- [ ] **Step 3: Manual verification**

Run `npm run dev`, sign in as an `HR_ADMIN` user, navigate to `/admin/accounts`. Expected: an
empty state ("No accounts yet.") with a Building2 icon. Click "New Account", type "Flyland",
Save — expected: it appears in the table, sorted alphabetically. Click Edit, rename to "Flyland
Recovery", Save — expected: the table updates. Click Delete, confirm — expected: it's removed.
Also confirm the new "Accounts" nav item appears in the admin sidebar's "People" group, between
Employees and Departments.

- [ ] **Step 4: Verify lint and build**

Run: `npm run lint && npm run build`
Expected: both succeed with no new errors.

- [ ] **Step 5: Commit**

```bash
git add app/admin/accounts app/admin/layout.tsx
git commit -m "feat: add /admin/accounts management page and nav link"
```

---

### Task 5: `useAccountTagInput` hook

**Files:**
- Create: `lib/hooks/useAccountTagInput.ts`
- Create: `lib/hooks/useAccountTagInput.test.ts`

**Interfaces:**
- Produces: `AccountEntity = { id: string; name: string }`; `hasAccountTagTrigger(value, cursor):
  boolean`; `useAccountTagInput(accounts: AccountEntity[])` returning `{ open, results,
  activeIndex, setActiveIndex, detect, select, prime, encode, reset, close }` (identical surface
  to `useMentionInput`'s return shape, so `AccountTagDropdown` in Task 6 can consume it the same
  way `MentionDropdown` consumes `MentionInput`); `AccountTagInput = ReturnType<typeof
  useAccountTagInput>`. Consumed by Task 6 (dropdown), Task 7 (rendering token format
  cross-reference only), Tasks 8-9 (wiring).

- [ ] **Step 1: Write the failing test for `hasAccountTagTrigger`**

Create `lib/hooks/useAccountTagInput.test.ts`:

All cursor positions below use `value.length`/`value.indexOf` rather than hand-counted numbers,
to make the test self-verifying against whatever string is actually written (avoids an
off-by-one between the string literal and a magic cursor number):

```ts
import { describe, expect, it } from "vitest";
import { hasAccountTagTrigger } from "./useAccountTagInput";

describe("hasAccountTagTrigger", () => {
  it("is true right after a bare #", () => {
    const value = "Great work on #";
    expect(hasAccountTagTrigger(value, value.length)).toBe(true);
  });

  it("is true while typing a partial account name, spaces included", () => {
    // Account names can contain spaces (e.g. "Flyland Recovery"), so a space
    // must not break the query -- mirrors useMentionInput's own @ behavior
    // ("Allow spaces in names; stop only at another @ or an already-resolved
    // mention").
    const value = "Great work on #Flyland Rec";
    expect(hasAccountTagTrigger(value, value.length)).toBe(true);
  });

  it("is false with no # typed", () => {
    const value = "Great work today";
    expect(hasAccountTagTrigger(value, value.length)).toBe(false);
  });

  it("is false once the tag is already resolved to a token with nothing further typed", () => {
    const value = "Great work on #[Flyland|abc123]";
    expect(hasAccountTagTrigger(value, value.length)).toBe(false);
  });

  it("restarts the query at a second #, not the first", () => {
    const value = "#EMB or #Fly";
    expect(hasAccountTagTrigger(value, value.length)).toBe(true);
  });

  it("is false once the run since the last # exceeds the 40-character cap", () => {
    // Mirrors useMentionInput's own guard against an unmatched "#" early in a
    // long post leaving the dropdown open over everything typed afterwards.
    const value = "#" + "x".repeat(41);
    expect(hasAccountTagTrigger(value, value.length)).toBe(false);
  });

  it("is false when the cursor sits before the #", () => {
    const value = "Great work on #Flyland";
    expect(hasAccountTagTrigger(value, value.indexOf("#"))).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/hooks/useAccountTagInput.test.ts`
Expected: FAIL — `useAccountTagInput.ts` does not exist yet.

- [ ] **Step 3: Write `lib/hooks/useAccountTagInput.ts`**

Mirrors `lib/hooks/useMentionInput.ts` file-for-file, `#` in place of `@`, `AccountEntity` in
place of `MentionEmployee`:

```ts
"use client";

import { useMemo, useState } from "react";

export type AccountEntity = { id: string; name: string };

/**
 * #account tagging for a single plain textarea.
 *
 * Mirrors lib/hooks/useMentionInput.ts's shape exactly, for the # trigger
 * instead of @ -- kept as a deliberately separate, parallel hook rather than
 * a shared generic abstraction (see the design spec's Alternatives
 * Considered section). One hook instance per textarea, same as
 * useMentionInput.
 *
 * Storage format matches the composer exactly: the textarea holds a readable
 * `#Account Name`, and encode() rewrites it to the `#[Account Name|uuid]`
 * token PostMentionText renders. This is purely a visual tag (see the design
 * spec) -- unlike @mentions, no notification or navigation is tied to it.
 */

// Stops at a newline and caps the length, mirroring useMentionInput's TRIGGER
// so an unmatched "#" early in a long post/comment doesn't leave the dropdown
// open over everything typed afterwards.
const TRIGGER = /#(?!\[)([^#\n]{0,40})$/;

/**
 * Whether the caret currently sits in an account-tag query.
 *
 * Exposed so a composer can lazily fetch the account list the first time
 * someone types "#", instead of loading it on mount for every user who never
 * tags an account.
 */
export function hasAccountTagTrigger(value: string, cursor: number): boolean {
  return TRIGGER.test(value.slice(0, cursor));
}

export function useAccountTagInput(accounts: AccountEntity[]) {
  const [query, setQuery] = useState<string | null>(null);
  const [start, setStart] = useState(0);
  // name -> id, captured at pick time. Only these are encoded, so typing a
  // literal "#something" that was never selected stays plain text.
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [activeIndex, setActiveIndex] = useState(0);

  const results = useMemo(() => {
    if (query === null) return [];
    return accounts
      .filter((a) => query === "" || a.name.toLowerCase().includes(query))
      .slice(0, 6);
  }, [accounts, query]);

  const open = query !== null && results.length > 0;

  /** Call on every change with the new value and the caret position. */
  function detect(value: string, cursor: number) {
    const match = value.slice(0, cursor).match(TRIGGER);
    if (match) {
      setQuery(match[1].toLowerCase().trim());
      setStart(cursor - match[0].length);
      setActiveIndex(0);
    } else {
      setQuery(null);
    }
  }

  /** Returns the text with the partial #query replaced by the chosen name. */
  function select(value: string, cursor: number, acct: AccountEntity): string {
    const before = value.slice(0, start);
    const after = value.slice(cursor);
    setPicked((prev) => ({ ...prev, [acct.name]: acct.id }));
    setQuery(null);
    return `${before}#${acct.name} ${after.trimStart()}`;
  }

  /** Register an account tag seeded programmatically rather than chosen from the dropdown. */
  function prime(acct: AccountEntity) {
    setPicked((prev) => ({ ...prev, [acct.name]: acct.id }));
  }

  /**
   * Rewrite picked names into `#[Name|id]` tokens. Longest name first so
   * "Flyland Recovery" is not partially consumed by a shorter "Flyland".
   */
  function encode(text: string): string {
    const entries = Object.entries(picked).sort((a, b) => b[0].length - a[0].length);
    let out = text;
    for (const [name, id] of entries) {
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      out = out.replace(new RegExp(`#${escaped}`, "g"), `#[${name}|${id}]`);
    }
    return out;
  }

  function reset() {
    setQuery(null);
    setPicked({});
    setActiveIndex(0);
  }

  function close() {
    setQuery(null);
  }

  return { open, results, activeIndex, setActiveIndex, detect, select, prime, encode, reset, close };
}

export type AccountTagInput = ReturnType<typeof useAccountTagInput>;
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run lib/hooks/useAccountTagInput.test.ts`
Expected: all 7 tests pass.

- [ ] **Step 5: Verify lint and build**

Run: `npm run lint && npm run build`
Expected: both succeed with no new errors.

- [ ] **Step 6: Commit**

```bash
git add lib/hooks/useAccountTagInput.ts lib/hooks/useAccountTagInput.test.ts
git commit -m "feat: add useAccountTagInput hook for # account tagging"
```

---

### Task 6: `AccountTagDropdown` component

**Files:**
- Create: `components/feed/AccountTagDropdown.tsx`

**Interfaces:**
- Consumes: `AccountEntity`, `AccountTagInput` from Task 5.
- Produces: `<AccountTagDropdown accountTag={AccountTagInput} onSelect={(acct: AccountEntity) =>
  void} className?: string />`. Consumed by Tasks 8-9 (wiring into all three composers).

- [ ] **Step 1: Write `components/feed/AccountTagDropdown.tsx`**

Mirrors `components/feed/MentionDropdown.tsx` exactly, swapping the `Avatar` row for a
`Building2` icon (`lucide-react`) and the prop/type names for the account equivalents:

```tsx
"use client";

import { Building2 } from "lucide-react";
import type { AccountEntity, AccountTagInput } from "@/lib/hooks/useAccountTagInput";

/**
 * The #account autocomplete list, positioned above the composer it belongs
 * to. Mirrors MentionDropdown.tsx exactly -- see that file's doc comment for
 * why onMouseDown (not onClick) and why a listbox role with keyboard nav.
 */
export function AccountTagDropdown({
  accountTag,
  onSelect,
  className,
}: {
  accountTag: AccountTagInput;
  onSelect: (acct: AccountEntity) => void;
  className?: string;
}) {
  if (!accountTag.open) return null;

  return (
    <ul
      role="listbox"
      aria-label="Tag an account"
      className={
        className ??
        "absolute bottom-full left-0 mb-1 z-30 w-64 max-h-56 overflow-y-auto bg-white border border-gray-200 rounded-xl shadow-lg py-1"
      }
    >
      {accountTag.results.map((acct, i) => (
        <li key={acct.id}>
          <button
            type="button"
            role="option"
            aria-selected={i === accountTag.activeIndex}
            onMouseDown={(e) => {
              e.preventDefault();
              onSelect(acct);
            }}
            onMouseEnter={() => accountTag.setActiveIndex(i)}
            className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors ${
              i === accountTag.activeIndex ? "bg-gray-100 text-gray-900" : "text-gray-700 hover:bg-gray-50"
            }`}
          >
            <Building2 className="w-5 h-5 text-gray-400 shrink-0" aria-hidden="true" />
            <span className="truncate">{acct.name}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
```

Note the active-row highlight uses `bg-gray-100` here, not `bg-navy-50` (which
`MentionDropdown` uses) — matching the Global Constraints' "account pills are neutral gray, not
navy" rule consistently into the dropdown itself, not just the rendered pill.

- [ ] **Step 2: Verify lint and build**

Run: `npm run lint && npm run build`
Expected: both succeed with no new errors. (No test — this is a React component; see Global
Constraints on why hook/component-rendering tests aren't added in this repo.)

- [ ] **Step 3: Commit**

```bash
git add components/feed/AccountTagDropdown.tsx
git commit -m "feat: add AccountTagDropdown component"
```

---

### Task 7: Rendering — `PostMentionText.tsx` (both token formats + blue→navy fix)

**Files:**
- Modify: `components/feed/PostMentionText.tsx`

**Interfaces:**
- Consumes: nothing new (pure string-parsing component).
- Produces: `<PostMentionText content={string} onMentionClick={(userId: string) => void} />` — same
  external signature as before (no new prop; accounts render with no click handler, since account
  mentions are non-interactive per the design). Every existing caller
  (`components/feed/PostBody.tsx`, `components/feed/CommentThread.tsx`) needs no changes.

- [ ] **Step 1: Rewrite `components/feed/PostMentionText.tsx`**

```tsx
import React from "react";
import { Building2 } from "lucide-react";

/**
 * Renders post/comment content, turning `@[Name|userId]` mention tokens into
 * clickable buttons and `#[Name|accountId]` account-tag tokens into
 * non-interactive labeled pills. Extracted out of feed/page.tsx so the media
 * viewer sidebar and CommentThread can render the same body text without
 * duplicating the parsing regex.
 *
 * Account tags are deliberately NOT clickable -- there is no account detail
 * page, and none is needed; #account is purely a visual/contextual tag (see
 * docs/superpowers/specs/2026-09-02-feed-account-mentions-design.md).
 */
export function PostMentionText({
  content,
  onMentionClick,
}: {
  content: string;
  onMentionClick: (userId: string) => void;
}) {
  const parts = content.split(/(@\[[^|]+\|[^\]]+\]|#\[[^|]+\|[^\]]+\])/g);
  return (
    <>
      {parts.map((part, i) => {
        const mentionMatch = part.match(/^@\[([^|]+)\|([^\]]+)\]$/);
        if (mentionMatch) {
          const [, name, id] = mentionMatch;
          return (
            <button
              key={i}
              type="button"
              onClick={() => onMentionClick(id)}
              className="font-semibold text-navy-600 bg-navy-50 rounded-md px-1 py-0.5 hover:bg-navy-100 transition-colors cursor-pointer"
            >
              @{name}
            </button>
          );
        }
        const accountMatch = part.match(/^#\[([^|]+)\|([^\]]+)\]$/);
        if (accountMatch) {
          const [, name] = accountMatch;
          return (
            <span
              key={i}
              className="inline-flex items-center gap-1 font-semibold text-gray-700 bg-gray-100 rounded-md px-1 py-0.5"
            >
              <Building2 className="w-3.5 h-3.5" aria-hidden="true" />
              {name}
            </span>
          );
        }
        return <React.Fragment key={i}>{part}</React.Fragment>;
      })}
    </>
  );
}
```

Two changes from the original in one pass: the `@`-mention pill color is `text-navy-600
bg-navy-50` (was `text-blue-600 bg-blue-50` — the drift fix from the design spec's Revision Note),
and a new second branch renders `#[...]` tokens as a non-interactive `<span>` with a `Building2`
icon.

- [ ] **Step 2: Manual verification**

This component has no test (pure JSX, would need component rendering — see Global Constraints).
Verify via `npm run dev` after Task 8 wires up the composer (this task alone has nothing to type
`#` into yet) — fold this check into Task 8's manual verification step instead of doing it here
in isolation.

- [ ] **Step 3: Verify lint and build**

Run: `npm run lint && npm run build`
Expected: both succeed with no new errors.

- [ ] **Step 4: Commit**

```bash
git add components/feed/PostMentionText.tsx
git commit -m "fix: render #account tags and correct @mention pill color to navy"
```

---

### Task 8: Wire `#`-accounts into the Feed post composer

**Files:**
- Modify: `lib/hooks/useFeedActions.ts`
- Modify: `app/(dashboard)/feed/page.tsx`

**Interfaces:**
- Consumes: `useAccountTagInput`, `hasAccountTagTrigger`, `AccountEntity` from Task 5;
  `AccountTagDropdown` from Task 6.
- Produces: `useFeedActions()` return value gains `accounts: AccountEntity[]`,
  `accountTag: AccountTagInput`, `ensureAccountsLoaded: () => void`, and `insertAccount:
  (acct: AccountEntity) => void` — consumed by Task 9 (`CommentThread` needs `accounts` threaded
  down the same way `employees` already is).

- [ ] **Step 1: Add the import**

Open `lib/hooks/useFeedActions.ts`, find the imports block (top of file, ending around line 20
with `import { realtimeTopics } from "@/lib/realtime/topics";`), add:

```ts
import { useAccountTagInput, type AccountEntity } from "@/lib/hooks/useAccountTagInput";
```

- [ ] **Step 2: Add `accounts` state and the `useAccountTagInput` instance**

Find `const [employees, setEmployees] = useState<{ id: string; displayName: string; avatarUrl:
string | null }[]>([]);` (around line 107). Add immediately after it:

```ts
  const [accounts, setAccounts] = useState<AccountEntity[]>([]);
```

Find `export function useFeedActions() {` and, after the other hook calls near the top of the
function body (right after `const { apiFetch } = useApiClient();`, around line 50), the
`accountTag` instance needs to be declared once state exists — add it right after the `accounts`
state declaration above:

```ts
  const accountTag = useAccountTagInput(accounts);
```

- [ ] **Step 3: Add `ensureAccountsLoaded`, mirroring `ensureEmployeesLoaded`**

Find the `ensureEmployeesLoaded` block (around lines 176-198):

```ts
  const employeesLoading = useRef(false);
  const ensureEmployeesLoaded = useCallback(() => {
    if (authLoading || !user || employees.length > 0 || employeesLoading.current) return;
    employeesLoading.current = true;
    apiFetch<{ data: { id: string; displayName: string; avatarUrl: string | null }[] }>("/api/employees")
      .then((res) => setEmployees(res.data))
      .catch((err) => {
        employeesLoading.current = false;
        console.error("employees fetch failed", err);
      });
    // apiFetch is a stable module-level import; listed only to satisfy the
    // exhaustive-deps rule without an eslint-disable.
  }, [authLoading, user, employees.length, apiFetch]);

  useEffect(() => {
    if (!composeExpanded) return;
    ensureEmployeesLoaded();
  }, [composeExpanded, ensureEmployeesLoaded]);
```

Add immediately after this block:

```ts
  const accountsLoading = useRef(false);
  const ensureAccountsLoaded = useCallback(() => {
    if (authLoading || !user || accounts.length > 0 || accountsLoading.current) return;
    accountsLoading.current = true;
    apiFetch<{ data: AccountEntity[] }>("/api/accounts")
      .then((res) => setAccounts(res.data))
      .catch((err) => {
        accountsLoading.current = false;
        console.error("accounts fetch failed", err);
      });
  }, [authLoading, user, accounts.length, apiFetch]);

  useEffect(() => {
    if (!composeExpanded) return;
    ensureAccountsLoaded();
  }, [composeExpanded, ensureAccountsLoaded]);
```

- [ ] **Step 4: Detect `#` in `handleComposerChange`**

Find `handleComposerChange` (around line 737):

```ts
  function handleComposerChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const value = e.target.value;
    setNewPost(value);
    autoResize(e.target);
    const cursor = e.target.selectionStart ?? value.length;
    const textUpToCursor = value.slice(0, cursor);
    // Allow spaces in names; stop only at another @ or an already-resolved mention (@[)
    const match = textUpToCursor.match(/@(?!\[)([^@]*)$/);
    if (match) {
      setMentionQuery(match[1].toLowerCase().trim());
      setMentionStart(cursor - match[0].length);
    } else {
      setMentionQuery(null);
    }
  }
```

Replace with (adds `#` detection via the new hook's `detect`, alongside the unchanged `@` logic):

```ts
  function handleComposerChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const value = e.target.value;
    setNewPost(value);
    autoResize(e.target);
    const cursor = e.target.selectionStart ?? value.length;
    const textUpToCursor = value.slice(0, cursor);
    // Allow spaces in names; stop only at another @ or an already-resolved mention (@[)
    const match = textUpToCursor.match(/@(?!\[)([^@]*)$/);
    if (match) {
      setMentionQuery(match[1].toLowerCase().trim());
      setMentionStart(cursor - match[0].length);
    } else {
      setMentionQuery(null);
    }
    accountTag.detect(value, cursor);
  }
```

- [ ] **Step 5: Add `insertAccount`, mirroring `insertMention`**

Find `insertMention` (around line 753):

```ts
  function insertMention(emp: { id: string; displayName: string }) {
    const cursor = composerRef.current?.selectionStart ?? newPost.length;
    const before = newPost.slice(0, mentionStart);
    const after = newPost.slice(cursor);
    // Store human-readable @Name in textarea; track id separately
    setNewPost(`${before}@${emp.displayName} ${after.trimStart()}`);
    setMentionMap((prev) => ({ ...prev, [emp.displayName]: emp.id }));
    setMentionQuery(null);
    setTimeout(() => composerRef.current?.focus(), 0);
  }
```

Add immediately after it:

```ts
  function insertAccount(acct: AccountEntity) {
    const cursor = composerRef.current?.selectionStart ?? newPost.length;
    setNewPost(accountTag.select(newPost, cursor, acct));
    setTimeout(() => composerRef.current?.focus(), 0);
  }
```

(`accountTag.select` already does the same slice/splice/set-picked work `insertMention` does
manually — the hook owns that logic, so `insertAccount` is a thin wrapper.)

- [ ] **Step 6: Apply `accountTag.encode()` at submit time**

Find `buildContent` (around line 764):

```ts
  function buildContent(text: string): string {
    // Replace @Name → @[Name|id] sorted longest-first to avoid partial matches
    const entries = Object.entries(mentionMap).sort((a, b) => b[0].length - a[0].length);
    let result = text;
    for (const [name, id] of entries) {
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      result = result.replace(new RegExp(`@${escaped}`, "g"), `@[${name}|${id}]`);
    }
    return result;
  }
```

Replace with:

```ts
  function buildContent(text: string): string {
    // Replace @Name → @[Name|id] sorted longest-first to avoid partial matches
    const entries = Object.entries(mentionMap).sort((a, b) => b[0].length - a[0].length);
    let result = text;
    for (const [name, id] of entries) {
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      result = result.replace(new RegExp(`@${escaped}`, "g"), `@[${name}|${id}]`);
    }
    return accountTag.encode(result);
  }
```

(The two token formats don't overlap character-wise, so chaining `accountTag.encode` after the
`@` replacement is safe regardless of order.)

- [ ] **Step 7: Reset `accountTag` alongside the existing mention reset on submit**

Find the block that clears composer state after a successful post (around line 276, referenced
earlier as `setPostTitle(""); setSelectedFlair(null); setDeptOnly(false); setMentionMap({});
setShowAllFlairs(false); setComposeExpanded(false);`). Add `accountTag.reset();` to that same
line:

```ts
        setPostTitle(""); setSelectedFlair(null); setDeptOnly(false); setMentionMap({}); setShowAllFlairs(false); setComposeExpanded(false); accountTag.reset();
```

- [ ] **Step 8: Export the new values from `useFeedActions`**

Find the hook's return object. Locate `mentionQuery,` (around line 896) and `insertMention,`
(around line 943) in that returned object. Add `accounts,`, `accountTag,`, `ensureAccountsLoaded,`,
and `insertAccount,` to the return object (anywhere in the object is fine — grouped near the
existing mention-related exports for readability):

```ts
    mentionQuery,
    accounts,
    accountTag,
    ensureAccountsLoaded,
```

and

```ts
    insertMention,
    insertAccount,
```

- [ ] **Step 9: Wire the dropdown into `app/(dashboard)/feed/page.tsx`**

Open `app/(dashboard)/feed/page.tsx`. Find the destructuring of `useFeedActions()`'s return value
(around line 100-142, where `employees,`, `mentionQuery,`, `mentionResults,`,
`mentionDropdownRef,`, `insertMention,`, `ensureEmployeesLoaded,` are already destructured). Add:

```ts
    accounts,
    accountTag,
    ensureAccountsLoaded,
    insertAccount,
```

Import `AccountTagDropdown` at the top of the file alongside the other `components/feed/*`
imports:

```ts
import { AccountTagDropdown } from "@/components/feed/AccountTagDropdown";
```

Find the existing mention dropdown JSX block (around line 439-460):

```tsx
              {mentionQuery !== null && mentionResults.length > 0 && (
                <div
                  ref={mentionDropdownRef}
                  role="listbox"
                  aria-label="Mention an employee"
                  className="absolute z-30 top-full left-0 mt-1 w-full max-w-64 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden"
                >
                  {mentionResults.map((emp) => (
                    <button
                      key={emp.id}
                      type="button"
                      role="option"
                      aria-selected={false}
                      onMouseDown={(e) => { e.preventDefault(); insertMention(emp); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-blue-50 transition-colors text-left"
                    >
                      <Avatar name={emp.displayName} url={emp.avatarUrl} size="sm" />
                      <span className="text-sm font-medium text-gray-900">{emp.displayName}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
```

Replace with (adds the `#` dropdown as a sibling right after the `@` one, inside the same
`relative`-positioned wrapping `<div>` both belong to; also fixes this dropdown's row hover from
`hover:bg-blue-50` to `hover:bg-navy-50`, the same blue→navy drift already being fixed in
`PostMentionText.tsx` in Task 7, found here in a sibling spot while wiring this exact block):

```tsx
              {mentionQuery !== null && mentionResults.length > 0 && (
                <div
                  ref={mentionDropdownRef}
                  role="listbox"
                  aria-label="Mention an employee"
                  className="absolute z-30 top-full left-0 mt-1 w-full max-w-64 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden"
                >
                  {mentionResults.map((emp) => (
                    <button
                      key={emp.id}
                      type="button"
                      role="option"
                      aria-selected={false}
                      onMouseDown={(e) => { e.preventDefault(); insertMention(emp); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-navy-50 transition-colors text-left"
                    >
                      <Avatar name={emp.displayName} url={emp.avatarUrl} size="sm" />
                      <span className="text-sm font-medium text-gray-900">{emp.displayName}</span>
                    </button>
                  ))}
                </div>
              )}
              <AccountTagDropdown accountTag={accountTag} onSelect={insertAccount} />
            </div>
          </div>
```

No edit is needed anywhere else in this file to trigger the account-list load: `ensureAccountsLoaded`
is wired (in Task 8 Step 3) to the same `composeExpanded` state transition `ensureEmployeesLoaded`
already reacts to via a `useEffect` inside `useFeedActions.ts` — that effect fires whenever
`composeExpanded` becomes `true`, regardless of which UI interaction caused it, so no new call
site is needed here.

- [ ] **Step 10: Manual verification**

Run `npm run dev`, sign in, go to `/feed`, expand the composer. Type `Great work on #`. Expected:
the account dropdown opens showing "Flyland" (created in Task 4's manual check) with a Building2
icon. Click it. Expected: the textarea now reads `Great work on #Flyland `. Also type `@` and
confirm the existing employee mention dropdown still works unaffected. Submit the post. Expected:
the post renders with `@EmployeeName` as a clickable navy pill and `#Flyland` as a non-interactive
gray pill with a building icon, side by side if both were used in the same post.

- [ ] **Step 11: Verify lint and build**

Run: `npm run lint && npm run build`
Expected: both succeed with no new errors.

- [ ] **Step 12: Commit**

```bash
git add lib/hooks/useFeedActions.ts "app/(dashboard)/feed/page.tsx"
git commit -m "$(cat <<'EOF'
feat: wire #account tagging into the Feed post composer

Also fixes the existing @mention dropdown's row hover from
hover:bg-blue-50 to hover:bg-navy-50 -- the same blue/navy drift
already being corrected in PostMentionText.tsx, found here in a
sibling spot while wiring the # dropdown into the same block.
EOF
)"
```

---

### Task 9: Wire `#`-accounts into comments and replies

**Files:**
- Modify: `components/feed/CommentThread.tsx`

**Interfaces:**
- Consumes: `accounts`, `ensureAccountsLoaded` threaded as props from `feed/page.tsx` (produced by
  Task 8); `useAccountTagInput`, `AccountEntity` from Task 5; `AccountTagDropdown` from Task 6.
- Produces: nothing consumed by a later task — this is the last wiring point.

- [ ] **Step 1: Add the import**

Open `components/feed/CommentThread.tsx`, find:

```ts
import { useMentionInput, hasMentionTrigger, type MentionEmployee, type MentionInput } from "@/lib/hooks/useMentionInput";
```

Add immediately after:

```ts
import { useAccountTagInput, hasAccountTagTrigger, type AccountEntity, type AccountTagInput } from "@/lib/hooks/useAccountTagInput";
import { AccountTagDropdown } from "@/components/feed/AccountTagDropdown";
```

- [ ] **Step 2: Thread `accounts` and `onNeedAccounts` props through the three component
      boundaries that currently accept `employees`/`onNeedEmployees`**

**Boundary A — `ListProps` type** (around line 40-51):

```ts
  hasMoreComments: boolean;
  /** Whether that older page is currently being fetched. */
  loadingMoreComments: boolean;
  onLoadMoreComments: (postId: string) => void;
  /** Mention candidates. Omit to disable @mentions in replies. */
  employees?: MentionEmployee[];
  /** Called the first time an @ is typed, so the roster can load on demand. */
  onNeedEmployees?: () => void;
  onToggleExpandedReplies: (commentId: string) => void;
  onDeleteComment: (postId: string, commentId: string, parentId?: string) => void;
  autoResize: (el: HTMLTextAreaElement) => void;
  className?: string;
};
```

Replace with:

```ts
  hasMoreComments: boolean;
  /** Whether that older page is currently being fetched. */
  loadingMoreComments: boolean;
  onLoadMoreComments: (postId: string) => void;
  /** Mention candidates. Omit to disable @mentions in replies. */
  employees?: MentionEmployee[];
  /** Called the first time an @ is typed, so the roster can load on demand. */
  onNeedEmployees?: () => void;
  /** Account tag candidates. Omit to disable #account tagging in replies. */
  accounts?: AccountEntity[];
  /** Called the first time a # is typed, so the account list can load on demand. */
  onNeedAccounts?: () => void;
  onToggleExpandedReplies: (commentId: string) => void;
  onDeleteComment: (postId: string, commentId: string, parentId?: string) => void;
  autoResize: (el: HTMLTextAreaElement) => void;
  className?: string;
};
```

**Boundary B — `CommentComposer` function** (around line 472-497):

```ts
export function CommentComposer({
  postId,
  commentDraft,
  commentSending,
  currentUserName,
  currentUserAvatar,
  employees = [],
  onNeedEmployees,
  onCommentDraftChange,
  onSubmitComment,
  autoResize,
  className,
}: {
  postId: string;
  commentDraft: Record<string, string>;
  commentSending: Record<string, boolean>;
  currentUserName: string;
  currentUserAvatar: string | null;
  /** Mention candidates. Omit to disable @mentions for this composer. */
  employees?: MentionEmployee[];
  /** Called the first time an @ is typed, so the roster can load on demand. */
  onNeedEmployees?: () => void;
  onCommentDraftChange: (postId: string, value: string) => void;
  onSubmitComment: (postId: string, gif?: GifResult, encodedContent?: string) => void;
  autoResize: (el: HTMLTextAreaElement) => void;
  className?: string;
}) {
```

Replace with:

```ts
export function CommentComposer({
  postId,
  commentDraft,
  commentSending,
  currentUserName,
  currentUserAvatar,
  employees = [],
  onNeedEmployees,
  accounts = [],
  onNeedAccounts,
  onCommentDraftChange,
  onSubmitComment,
  autoResize,
  className,
}: {
  postId: string;
  commentDraft: Record<string, string>;
  commentSending: Record<string, boolean>;
  currentUserName: string;
  currentUserAvatar: string | null;
  /** Mention candidates. Omit to disable @mentions for this composer. */
  employees?: MentionEmployee[];
  /** Called the first time an @ is typed, so the roster can load on demand. */
  onNeedEmployees?: () => void;
  /** Account tag candidates. Omit to disable #account tagging for this composer. */
  accounts?: AccountEntity[];
  /** Called the first time a # is typed, so the account list can load on demand. */
  onNeedAccounts?: () => void;
  onCommentDraftChange: (postId: string, value: string) => void;
  onSubmitComment: (postId: string, gif?: GifResult, encodedContent?: string) => void;
  autoResize: (el: HTMLTextAreaElement) => void;
  className?: string;
}) {
```

**Boundary C — outer wrapper component** (around line 588-642, the component that renders both
`CommentList` and `CommentComposer`):

```ts
  onLoadMoreComments,
  onToggleExpandedReplies,
  onDeleteComment,
  onCommentDraftChange,
  onSubmitComment,
  autoResize,
  wrapperClassName,
  employees = [],
  onNeedEmployees,
}: ListProps & {
  commentDraft: Record<string, string>;
  commentSending: Record<string, boolean>;
  onCommentDraftChange: (postId: string, value: string) => void;
  onSubmitComment: (postId: string, gif?: GifResult, encodedContent?: string) => void;
  wrapperClassName: string;
}) {
  return (
    <div className={wrapperClassName}>
      <CommentList
        postId={postId}
        comments={comments}
        loading={loading}
        replyingTo={replyingTo}
        replyDraft={replyDraft}
        replySending={replySending}
        expandedReplies={expandedReplies}
        currentUserName={currentUserName}
        currentUserAvatar={currentUserAvatar}
        dbUserId={dbUserId}
        isModerator={isModerator}
        onSetReplyingTo={onSetReplyingTo}
        onReplyDraftChange={onReplyDraftChange}
        onSubmitReply={onSubmitReply}
        onReactToComment={onReactToComment}
        onOpenCommentReactions={onOpenCommentReactions}
        hasMoreComments={hasMoreComments}
        loadingMoreComments={loadingMoreComments}
        onLoadMoreComments={onLoadMoreComments}
        onToggleExpandedReplies={onToggleExpandedReplies}
        onDeleteComment={onDeleteComment}
        autoResize={autoResize}
        employees={employees}
        onNeedEmployees={onNeedEmployees}
      />
      <CommentComposer
        postId={postId}
        commentDraft={commentDraft}
        commentSending={commentSending}
        currentUserName={currentUserName}
        currentUserAvatar={currentUserAvatar}
        onCommentDraftChange={onCommentDraftChange}
        onSubmitComment={onSubmitComment}
        autoResize={autoResize}
        employees={employees}
        onNeedEmployees={onNeedEmployees}
```

Replace with:

```ts
  onLoadMoreComments,
  onToggleExpandedReplies,
  onDeleteComment,
  onCommentDraftChange,
  onSubmitComment,
  autoResize,
  wrapperClassName,
  employees = [],
  onNeedEmployees,
  accounts = [],
  onNeedAccounts,
}: ListProps & {
  commentDraft: Record<string, string>;
  commentSending: Record<string, boolean>;
  onCommentDraftChange: (postId: string, value: string) => void;
  onSubmitComment: (postId: string, gif?: GifResult, encodedContent?: string) => void;
  wrapperClassName: string;
}) {
  return (
    <div className={wrapperClassName}>
      <CommentList
        postId={postId}
        comments={comments}
        loading={loading}
        replyingTo={replyingTo}
        replyDraft={replyDraft}
        replySending={replySending}
        expandedReplies={expandedReplies}
        currentUserName={currentUserName}
        currentUserAvatar={currentUserAvatar}
        dbUserId={dbUserId}
        isModerator={isModerator}
        onSetReplyingTo={onSetReplyingTo}
        onReplyDraftChange={onReplyDraftChange}
        onSubmitReply={onSubmitReply}
        onReactToComment={onReactToComment}
        onOpenCommentReactions={onOpenCommentReactions}
        hasMoreComments={hasMoreComments}
        loadingMoreComments={loadingMoreComments}
        onLoadMoreComments={onLoadMoreComments}
        onToggleExpandedReplies={onToggleExpandedReplies}
        onDeleteComment={onDeleteComment}
        autoResize={autoResize}
        employees={employees}
        onNeedEmployees={onNeedEmployees}
        accounts={accounts}
        onNeedAccounts={onNeedAccounts}
      />
      <CommentComposer
        postId={postId}
        commentDraft={commentDraft}
        commentSending={commentSending}
        currentUserName={currentUserName}
        currentUserAvatar={currentUserAvatar}
        onCommentDraftChange={onCommentDraftChange}
        onSubmitComment={onSubmitComment}
        autoResize={autoResize}
        employees={employees}
        onNeedEmployees={onNeedEmployees}
        accounts={accounts}
        onNeedAccounts={onNeedAccounts}
```

(the line after this block, `className="pt-1"` or similar closing the `CommentComposer` tag,
stays unchanged.)

- [ ] **Step 3: Add the `accountTag` hook instance to the reply composer**

Find (around line 184):

```ts
  const replyMention = useMentionInput(employees);
```

Add immediately after:

```ts
  const replyAccountTag = useAccountTagInput(accounts);
```

- [ ] **Step 4: Add the `accountTag` hook instance to the main comment composer**

Find (around line 502):

```ts
  const mention = useMentionInput(employees);
```

Add immediately after:

```ts
  const accountTag = useAccountTagInput(accounts);
```

- [ ] **Step 4b: Add `handleAccountTagKeyDown`, mirroring `handleMentionKeyDown`**

There is a shared `handleMentionKeyDown` function (around line 61-87) that gives the `@` dropdown
its Arrow/Enter/Escape keyboard navigation, used by both the comment and reply composers. Without
an equivalent for `#`, the account dropdown would render its `activeIndex` highlight but arrow
keys and Enter would do nothing — a real functional gap, not a cosmetic one. Find:

```ts
function handleMentionKeyDown(
  e: React.KeyboardEvent<HTMLTextAreaElement>,
  mention: MentionInput,
  onPick: (emp: MentionEmployee) => void,
) {
  if (!mention.open) return;

  if (e.key === "ArrowDown") {
    e.preventDefault();
    mention.setActiveIndex((mention.activeIndex + 1) % mention.results.length);
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    mention.setActiveIndex((mention.activeIndex - 1 + mention.results.length) % mention.results.length);
  } else if (e.key === "Enter" || e.key === "Tab") {
    const chosen = mention.results[mention.activeIndex];
    if (chosen) {
      e.preventDefault();
      onPick(chosen);
    }
  } else if (e.key === "Escape") {
    // Swallow it so the reply composer's own Escape-to-cancel doesn't also
    // fire and throw away a draft the user was only dismissing a list from.
    e.preventDefault();
    e.stopPropagation();
    mention.close();
  }
}
```

Add immediately after it:

```ts
/**
 * Same as handleMentionKeyDown, for the # account-tag dropdown. Kept as a
 * separate function rather than a shared generic, mirroring how
 * useAccountTagInput mirrors useMentionInput rather than generalizing (see
 * the design spec's Alternatives Considered section).
 *
 * Safe to call unconditionally alongside handleMentionKeyDown on the same
 * keydown event: detect()'s trigger regexes for @ and # are mutually
 * exclusive on the text immediately before the caret, so mention.open and
 * accountTag.open can never both be true at once -- at most one of the two
 * handlers actually acts on any given keystroke.
 */
function handleAccountTagKeyDown(
  e: React.KeyboardEvent<HTMLTextAreaElement>,
  accountTag: AccountTagInput,
  onPick: (acct: AccountEntity) => void,
) {
  if (!accountTag.open) return;

  if (e.key === "ArrowDown") {
    e.preventDefault();
    accountTag.setActiveIndex((accountTag.activeIndex + 1) % accountTag.results.length);
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    accountTag.setActiveIndex((accountTag.activeIndex - 1 + accountTag.results.length) % accountTag.results.length);
  } else if (e.key === "Enter" || e.key === "Tab") {
    const chosen = accountTag.results[accountTag.activeIndex];
    if (chosen) {
      e.preventDefault();
      onPick(chosen);
    }
  } else if (e.key === "Escape") {
    e.preventDefault();
    e.stopPropagation();
    accountTag.close();
  }
}
```

(`AccountTagInput` used as this function's parameter type was already imported in Step 1.)

- [ ] **Step 5: Add `pickReplyAccount` and wire `submitReply`'s encode chain**

Find `pickReplyMention` (around line 208):

```ts
  function pickReplyMention(commentId: string, emp: MentionEmployee) {
    const el = replyRef.current;
    const draft = replyDraft[commentId] ?? "";
    const cursor = el?.selectionStart ?? draft.length;
    onReplyDraftChange(commentId, replyMention.select(draft, cursor, emp));
    setTimeout(() => el?.focus(), 0);
  }
```

Add immediately after:

```ts
  function pickReplyAccount(commentId: string, acct: AccountEntity) {
    const el = replyRef.current;
    const draft = replyDraft[commentId] ?? "";
    const cursor = el?.selectionStart ?? draft.length;
    onReplyDraftChange(commentId, replyAccountTag.select(draft, cursor, acct));
    setTimeout(() => el?.focus(), 0);
  }
```

Find `submitReply` (around line 216):

```ts
  function submitReply(commentId: string) {
    onSubmitReply(postId, commentId, replyGif ?? undefined, replyMention.encode(replyDraft[commentId] ?? ""));
    replyMention.reset();
    setReplyGif(null);
  }
```

Replace with:

```ts
  function submitReply(commentId: string) {
    const encoded = replyAccountTag.encode(replyMention.encode(replyDraft[commentId] ?? ""));
    onSubmitReply(postId, commentId, replyGif ?? undefined, encoded);
    replyMention.reset();
    replyAccountTag.reset();
    setReplyGif(null);
  }
```

- [ ] **Step 6: Wire the reply textarea's `onChange` and dropdown**

Find the reply composer's textarea `onChange` (around line 423-429):

```tsx
                          onChange={(e) => {
                            onReplyDraftChange(c.id, e.target.value);
                            const cur = e.target.selectionStart ?? e.target.value.length;
                            if (hasMentionTrigger(e.target.value, cur)) onNeedEmployees?.();
                            replyMention.detect(e.target.value, cur);
                            autoResize(e.target);
                          }}
```

Replace with:

```tsx
                          onChange={(e) => {
                            onReplyDraftChange(c.id, e.target.value);
                            const cur = e.target.selectionStart ?? e.target.value.length;
                            if (hasMentionTrigger(e.target.value, cur)) onNeedEmployees?.();
                            if (hasAccountTagTrigger(e.target.value, cur)) onNeedAccounts?.();
                            replyMention.detect(e.target.value, cur);
                            replyAccountTag.detect(e.target.value, cur);
                            autoResize(e.target);
                          }}
```

Find the reply composer's `<MentionDropdown>` (around line 413):

```tsx
                        <MentionDropdown
                          mention={replyMention}
                          onSelect={(emp) => pickReplyMention(c.id, emp)}
                        />
```

Add immediately after:

```tsx
                        <AccountTagDropdown
                          accountTag={replyAccountTag}
                          onSelect={(acct) => pickReplyAccount(c.id, acct)}
                        />
```

Find the reply composer's `onKeyDown` and `onBlur` (around line 430-437, right after the
`onChange` you just replaced above):

```tsx
                          onKeyDown={(e) => {
                            // The mention handler swallows Escape while its list
                            // is open, so dismissing the list doesn't also
                            // discard the reply draft.
                            handleMentionKeyDown(e, replyMention, (emp) => pickReplyMention(c.id, emp));
                            if (!e.defaultPrevented && e.key === "Escape") startReply(null);
                          }}
                          onBlur={replyMention.close}
```

Replace with:

```tsx
                          onKeyDown={(e) => {
                            // The mention/account-tag handlers swallow Escape
                            // while their list is open, so dismissing a list
                            // doesn't also discard the reply draft. At most one
                            // of the two can be open at once (see
                            // handleAccountTagKeyDown's doc comment), so calling
                            // both unconditionally is safe.
                            handleMentionKeyDown(e, replyMention, (emp) => pickReplyMention(c.id, emp));
                            handleAccountTagKeyDown(e, replyAccountTag, (acct) => pickReplyAccount(c.id, acct));
                            if (!e.defaultPrevented && e.key === "Escape") startReply(null);
                          }}
                          onBlur={() => { replyMention.close(); replyAccountTag.close(); }}
```

- [ ] **Step 7: Add `pickAccount` and wire the main comment composer's `submit`, `onChange`, and dropdown**

Find `pick` (around line 506):

```ts
  function pick(emp: MentionEmployee) {
    const el = textareaRef.current;
    const cursor = el?.selectionStart ?? draft.length;
    onCommentDraftChange(postId, mention.select(draft, cursor, emp));
    setTimeout(() => el?.focus(), 0);
  }
```

Add immediately after:

```ts
  function pickAccount(acct: AccountEntity) {
    const el = textareaRef.current;
    const cursor = el?.selectionStart ?? draft.length;
    onCommentDraftChange(postId, accountTag.select(draft, cursor, acct));
    setTimeout(() => el?.focus(), 0);
  }
```

Find `submit` (around line 513):

```ts
  function submit() {
    // Encode picked names into @[Name|id] tokens at send time. The parent owns
    // the draft string, so the encoded text is handed over rather than written
    // back into state first — a setState round trip would race the submit.
    onSubmitComment(postId, gif ?? undefined, mention.encode(draft));
    mention.reset();
    setGif(null);
  }
```

Replace with:

```ts
  function submit() {
    // Encode picked names into @[Name|id] and #[Name|id] tokens at send time.
    // The parent owns the draft string, so the encoded text is handed over
    // rather than written back into state first — a setState round trip
    // would race the submit.
    onSubmitComment(postId, gif ?? undefined, accountTag.encode(mention.encode(draft)));
    mention.reset();
    accountTag.reset();
    setGif(null);
  }
```

Find the comment composer's textarea `onChange` (around line 535-539):

```tsx
              onChange={(e) => {
                onCommentDraftChange(postId, e.target.value);
                const cur = e.target.selectionStart ?? e.target.value.length;
                if (hasMentionTrigger(e.target.value, cur)) onNeedEmployees?.();
                mention.detect(e.target.value, cur);
```

Replace with:

```tsx
              onChange={(e) => {
                onCommentDraftChange(postId, e.target.value);
                const cur = e.target.selectionStart ?? e.target.value.length;
                if (hasMentionTrigger(e.target.value, cur)) onNeedEmployees?.();
                if (hasAccountTagTrigger(e.target.value, cur)) onNeedAccounts?.();
                mention.detect(e.target.value, cur);
                accountTag.detect(e.target.value, cur);
```

(the remainder of that `onChange` body, e.g. `autoResize(e.target);`, stays unchanged below this
point — this replacement only covers the lines shown.)

Find the comment composer's `<MentionDropdown>` (around line 529):

```tsx
            <MentionDropdown mention={mention} onSelect={pick} />
```

Add immediately after:

```tsx
            <AccountTagDropdown accountTag={accountTag} onSelect={pickAccount} />
```

Find the comment composer's `onKeyDown` and `onBlur` (around line 542-543, right after the
`onChange` you just replaced above):

```tsx
              onKeyDown={(e) => handleMentionKeyDown(e, mention, pick)}
              onBlur={mention.close}
```

Replace with:

```tsx
              onKeyDown={(e) => {
                handleMentionKeyDown(e, mention, pick);
                handleAccountTagKeyDown(e, accountTag, pickAccount);
              }}
              onBlur={() => { mention.close(); accountTag.close(); }}
```

- [ ] **Step 8: Wire `onNeedAccounts` from `app/(dashboard)/feed/page.tsx` down into `CommentThread`**

Open `app/(dashboard)/feed/page.tsx`. Find the two `<CommentThread ... onNeedEmployees=
{ensureEmployeesLoaded} ...>` call sites (around lines 827/828 and 906/907, already located in
Task 8 Step 9's exploration). Add `onNeedAccounts={ensureAccountsLoaded}` next to each
`onNeedEmployees={ensureEmployeesLoaded}` occurrence, and `accounts={accounts}` next to each
`employees={employees}` occurrence at those same two call sites.

- [ ] **Step 9: Manual verification**

Run `npm run dev`, open a post with comments, type a comment containing `#Flyland`. Expected: the
account dropdown opens (confirming `onNeedAccounts`/`ensureAccountsLoaded` fired and populated the
list), selecting it inserts `#Flyland ` into the draft. Submit. Expected: the comment renders with
a non-interactive gray `#Flyland` pill. Repeat inside a reply (click Reply on a comment, type
`#Flyland` in the reply box). Expected: same behavior. Also confirm `@`-mentioning an employee
still works correctly in both comments and replies (unaffected regression check).

- [ ] **Step 10: Verify lint and build**

Run: `npm run lint && npm run build`
Expected: both succeed with no new errors.

- [ ] **Step 11: Commit**

```bash
git add components/feed/CommentThread.tsx "app/(dashboard)/feed/page.tsx"
git commit -m "feat: wire #account tagging into comments and replies"
```

---

### Task 10: Full regression pass and test suite run

**Files:** none (verification-only task).

**Interfaces:** none.

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: every test passes, including all pre-existing tests (this task's job is confirming
nothing in Tasks 1-9 broke unrelated coverage) and the new tests from Tasks 2, 3, and 5.

- [ ] **Step 2: Run lint and build one more time from a clean state**

Run: `npm run lint && npm run build`
Expected: both succeed with no new errors or warnings introduced by this feature (pre-existing
lint findings unrelated to these files are expected and out of scope).

- [ ] **Step 3: Full manual walkthrough**

Run `npm run dev`. As an `HR_ADMIN`: visit `/admin/accounts`, confirm the CRUD flow. As a regular
employee: post to Feed using both `@employee` and `#account` in the same post; comment using both;
reply using both; confirm all three composers' dropdowns are keyboard-navigable (Building2 rows
respond to hover the same as the employee rows do — full keyboard-arrow navigation was already
covered by `MentionDropdown`'s existing pattern being mirrored, not something new to verify
per-keystroke, but confirm the dropdown at least opens/closes correctly on Escape/blur the same
way the employee one does). Confirm a post/comment containing an `#`-tag for an account that was
since deleted from `/admin/accounts` still renders its pill correctly (using the name captured at
mention time) — mirrors the accepted behavior noted in Task 2.

- [ ] **Step 4: Final commit (only if the walkthrough surfaced fixes)**

If Step 3 found nothing to fix, there is nothing to commit for this task — it's a verification
checkpoint, not a code task. If it did surface a fix, make the minimal correction, re-run Steps 1-2,
then commit with a `fix:` prefix describing exactly what regression check caught.
