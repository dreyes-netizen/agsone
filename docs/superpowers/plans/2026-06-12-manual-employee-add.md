# Manual Employee Add — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an "Add Employee" button to the admin employees page that opens a modal, lets HR fill in employee details, and creates a ghost profile (`firebaseUid: null`) that auto-activates on first Google login.

**Architecture:** One new API POST handler added to the existing `app/api/admin/employees/route.ts`, plus modal state and UI added to `app/admin/employees/page.tsx`. No new files needed.

**Tech Stack:** Next.js 16 App Router, Prisma, Zod, Tailwind CSS, Lucide icons

---

## File Map

| File | Change |
|------|--------|
| `app/api/admin/employees/route.ts` | Add `POST` handler |
| `app/admin/employees/page.tsx` | Add state, handler, button, modal |

---

## Task 1: POST /api/admin/employees

**File:** `app/api/admin/employees/route.ts`

- [ ] **Step 1: Open the file** — it currently only has a `GET` export. Read it to understand imports in use.

- [ ] **Step 2: Add the POST handler** — append this to the end of the file:

```ts
import { z } from "zod";

const COMPANY_DOMAIN = "@allianceglobalsolutions.com";

const createSchema = z.object({
  displayName: z.string().min(2).max(100),
  email: z.string().email().refine((e) => e.endsWith(COMPANY_DOMAIN), {
    message: `Email must end in ${COMPANY_DOMAIN}`,
  }),
  departmentId: z.string().uuid().nullable().optional(),
  role: z.enum(["EMPLOYEE", "MANAGER", "HR_ADMIN"]).default("EMPLOYEE"),
  employeeId: z.string().max(50).optional().nullable(),
  hireDate: z.string().optional().nullable(),
  birthday: z.string().optional().nullable(),
});

export async function POST(req: NextRequest) {
  const actor = await verifyAuth(req);
  if (!requireRole(actor, ["HR_ADMIN"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { displayName, email, departmentId, role, employeeId, hireDate, birthday } = parsed.data;

  // Check for duplicate email
  const existing = await prisma.user.findFirst({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "An employee with this email already exists." }, { status: 409 });
  }

  const employee = await prisma.user.create({
    data: {
      firebaseUid: null,
      email,
      displayName,
      role,
      employeeId: employeeId ?? null,
      departmentId: departmentId ?? null,
      hireDate: hireDate ? new Date(hireDate) : null,
      birthday: birthday ? new Date(birthday) : null,
      onboardingComplete: false,
      isActive: true,
      pointsBalance: 0,
    },
    select: {
      id: true,
      employeeId: true,
      displayName: true,
      email: true,
      role: true,
      pointsBalance: true,
      isActive: true,
      hireDate: true,
      birthday: true,
      createdAt: true,
      department: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({ data: employee }, { status: 201 });
}
```

> Note: `z` is imported at the top of the file. Also add `import { z } from "zod";` to the import block if not already present — check first.

- [ ] **Step 3: Verify the file compiles** — run the dev server and confirm no TypeScript errors in the terminal output.

- [ ] **Step 4: Test the endpoint manually** — using the Supabase MCP or a tool like curl/Postman, confirm:
  - Valid payload → 201 with user object
  - Duplicate email → 409
  - Non-company email → 400
  - Non-HR_ADMIN token → 403

- [ ] **Step 5: Commit**

```
git add app/api/admin/employees/route.ts
git commit -m "feat(admin): add POST /api/admin/employees for manual employee creation"
```

---

## Task 2: Add Employee Modal to the UI

**File:** `app/admin/employees/page.tsx`

### Step 2a — Add state and type

- [ ] **Step 1: Add `AddForm` type** — add after the existing `EditForm` type (around line 32):

```ts
type AddForm = {
  displayName: string;
  email: string;
  departmentId: string;
  role: Employee["role"];
  employeeId: string;
  hireDate: string;
  birthday: string;
};

const EMPTY_ADD_FORM: AddForm = {
  displayName: "",
  email: "",
  departmentId: "",
  role: "EMPLOYEE",
  employeeId: "",
  hireDate: "",
  birthday: "",
};
```

- [ ] **Step 2: Add state variables** — add after the `showUploadGuide` state (around line 63):

```ts
const [addModalOpen, setAddModalOpen] = useState(false);
const [addForm, setAddForm] = useState<AddForm>(EMPTY_ADD_FORM);
const [adding, setAdding] = useState(false);
const [addError, setAddError] = useState("");
```

- [ ] **Step 3: Add `UserPlus` to the lucide import** — update the existing import at line 6:

```ts
import { ChevronDown, ChevronUp, Pencil, Upload, UserPlus, X } from "lucide-react";
```

### Step 2b — Add the submit handler

- [ ] **Step 4: Add `handleAddEmployee` function** — add it after `handleSyncFile` (around line 131):

```ts
async function handleAddEmployee(e: React.FormEvent) {
  e.preventDefault();
  setAddError("");

  if (!addForm.email.endsWith("@allianceglobalsolutions.com")) {
    setAddError("Email must end in @allianceglobalsolutions.com");
    return;
  }

  setAdding(true);
  try {
    const res = await apiFetch<{ data: Employee }>("/api/admin/employees", {
      method: "POST",
      body: JSON.stringify({
        displayName: addForm.displayName.trim(),
        email: addForm.email.trim().toLowerCase(),
        departmentId: addForm.departmentId || null,
        role: addForm.role,
        employeeId: addForm.employeeId.trim() || null,
        hireDate: addForm.hireDate || null,
        birthday: addForm.birthday || null,
      }),
    });
    setEmployees((prev) => [res.data, ...prev]);
    setAddModalOpen(false);
    setAddForm(EMPTY_ADD_FORM);
  } catch (err) {
    setAddError(err instanceof Error ? err.message : "Failed to add employee.");
  } finally {
    setAdding(false);
  }
}
```

### Step 2c — Add the button

- [ ] **Step 5: Add "Add Employee" button** — find the "Upload Employee List" button (around line 307) and add the new button directly before it:

```tsx
<button
  onClick={() => { setAddModalOpen(true); setAddForm(EMPTY_ADD_FORM); setAddError(""); }}
  className="flex items-center gap-2 px-3 py-2 text-sm font-medium border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
>
  <UserPlus className="w-4 h-4" />
  Add Employee
</button>
```

### Step 2d — Add the modal

- [ ] **Step 6: Add the modal JSX** — find the closing `</div>` at the very end of the component's return (just before the final `</div>`) and add the modal before it:

```tsx
{/* Add Employee Modal */}
{addModalOpen && (
  <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
      <div className="flex items-center justify-between mb-5">
        <h2 className="font-semibold text-gray-900">Add Employee</h2>
        <button onClick={() => setAddModalOpen(false)} className="text-gray-400 hover:text-gray-600">
          <X className="w-5 h-5" />
        </button>
      </div>

      <form onSubmit={handleAddEmployee} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Full Name <span className="text-red-500">*</span></label>
          <input
            required
            type="text"
            value={addForm.displayName}
            onChange={(e) => setAddForm((f) => ({ ...f, displayName: e.target.value }))}
            placeholder="e.g. Juan Dela Cruz"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Work Email <span className="text-red-500">*</span></label>
          <input
            required
            type="email"
            value={addForm.email}
            onChange={(e) => setAddForm((f) => ({ ...f, email: e.target.value }))}
            placeholder="j.delacruz@allianceglobalsolutions.com"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
            <select
              value={addForm.departmentId}
              onChange={(e) => setAddForm((f) => ({ ...f, departmentId: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            >
              <option value="">No department</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role <span className="text-red-500">*</span></label>
            <select
              value={addForm.role}
              onChange={(e) => setAddForm((f) => ({ ...f, role: e.target.value as Employee["role"] }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            >
              <option value="EMPLOYEE">Employee</option>
              <option value="MANAGER">Manager</option>
              <option value="HR_ADMIN">HR Admin</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Employee ID</label>
          <input
            type="text"
            value={addForm.employeeId}
            onChange={(e) => setAddForm((f) => ({ ...f, employeeId: e.target.value }))}
            placeholder="e.g. EMP-001"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Hire Date</label>
            <input
              type="date"
              value={addForm.hireDate}
              onChange={(e) => setAddForm((f) => ({ ...f, hireDate: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Birthday</label>
            <input
              type="date"
              value={addForm.birthday}
              onChange={(e) => setAddForm((f) => ({ ...f, birthday: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {addError && <p className="text-red-500 text-sm">{addError}</p>}

        <button
          type="submit"
          disabled={adding || !addForm.displayName.trim() || !addForm.email.trim()}
          className="w-full bg-indigo-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {adding ? "Adding…" : "Add Employee"}
        </button>
      </form>
    </div>
  </div>
)}
```

- [ ] **Step 7: Verify in browser** — open `http://localhost:3000/admin/employees`, confirm:
  - "Add Employee" button appears next to "Upload Employee List"
  - Clicking it opens the modal
  - Submitting with a non-company email shows the inline error
  - Submitting with valid data adds the row to the top of the table and closes the modal
  - Submitting with a duplicate email shows "An employee with this email already exists."

- [ ] **Step 8: Commit**

```
git add app/admin/employees/page.tsx
git commit -m "feat(admin): add manual employee creation modal"
```
