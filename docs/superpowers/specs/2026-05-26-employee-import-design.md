# Employee Import (Sprout + EMAILS) Design

## Goal

Allow HR admins to upload two Excel files — a Sprout HR export and a Google Workspace email directory export — to pre-populate employee profiles. When an employee logs in for the first time, their profile is automatically populated from the import data.

## Architecture

Two files are uploaded together and parsed server-side. The server cross-references them by name to produce a matched preview with quality indicators. After HR confirms, ghost profiles are written to a new `GhostProfile` table. On first Google login, `auth/sync` checks for a ghost profile whose `workEmail` matches the Firebase `email` and copies the fields into the new User record automatically.

The import is additive and idempotent: re-uploading updates existing ghost profiles by Sprout employee ID without resetting already-linked records.

## Tech Stack

- File parsing: `xlsx` npm package (server-side only, add to dependencies)
- Upload: multipart form-data via `FormData` + `formidable` or Next.js built-in `request.formData()`
- Storage: none — files are parsed in memory and discarded
- DB writes: Prisma upsert by `employeeId`

---

## Data Sources

### Sprout Export (`.xlsx`)

Relevant columns (exact header names from the file):

| Column | Field |
|--------|-------|
| `Employee #` | `employeeId` (Sprout EID) |
| `First Name` | `firstName` |
| `Last Name` | `lastName` |
| `Middle Name` | ignored |
| `Department` | department name → match to `Department.name` |
| `Position` | `position` |
| `Employee Status` | filter: only import `Regular` and `Probationary` (skip `Resigned`) |
| `Hire Date` | `hireDate` (Excel serial number → JS Date) |
| `Birthday` | `birthday` (Excel serial number → JS Date) |
| `Branch / Location` | `location` |
| `Email Address` | personal email — store as `sproutEmail`, do NOT use for login matching |

### EMAILS Export (`.xlsx`, 3 sheets)

Sheets: `AGS` (`@allianceglobalsolutions.com`), `Alt` (`@altfunding.com`), `Fundward` (`@fundward.com`)

Columns per sheet:

| Column | Field |
|--------|-------|
| `First Name` | for matching |
| `Last Name` | for matching |
| `Email Address` | `workEmail` — this is the Google login email |
| `Status` | filter: only import `Active` |

---

## Schema Changes

### New model: `GhostProfile`

```prisma
model GhostProfile {
  id           String    @id @default(uuid())
  employeeId   String    @unique
  workEmail    String?   @unique
  displayName  String
  firstName    String
  lastName     String
  sproutEmail  String?
  position     String?
  hireDate     DateTime?
  birthday     DateTime?
  location     String?
  departmentId String?
  linkedUserId String?   @unique
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt

  department Department? @relation(fields: [departmentId], references: [id])
  linkedUser User?       @relation(fields: [linkedUserId], references: [id])
}
```

### Changes to `User` model

Add these nullable fields (filled in when ghost profile is linked at login):

```prisma
employeeId String? @unique
position   String?
hireDate   DateTime?
location   String?
```

`User` also gets a back-relation for ghost profile linking:

```prisma
ghostProfile GhostProfile?
```

`birthday` already exists on User.

---

## Name Matching Algorithm

For each row in the EMAILS sheets, attempt to match to a GhostProfile row by name:

1. **Exact match**: `lower(trim(ghostFirst)) == lower(trim(emailFirst)) && lower(trim(ghostLast)) == lower(trim(emailLast))` → quality `EXACT`
2. **No match**: no candidate found → quality `UNMATCHED`

No fuzzy matching in v1 (avoids wrong assignments). Unmatched records can be resolved manually in the preview table before committing.

Match quality enum (used client-side only, not persisted):
- `EXACT` — auto-applied, shown as ✅
- `UNMATCHED` — shown as ❌, HR can type in the correct email manually

---

## Import Page (`/admin/employees/import`)

Three-phase UI on a single page:

### Phase 1: Upload

Two file inputs (both required before preview):
- "Sprout HR Export" — accepts `.xlsx`
- "Email Directory" — accepts `.xlsx`

"Generate Preview" button (disabled until both files selected).

### Phase 2: Preview Table

Table columns: `EID` | `Name` | `Department` | `Position` | `Hire Date` | `Work Email` | `Status`

Status column shows:
- ✅ Exact match — work email populated
- ❌ No match — editable text input for HR to enter email manually
- `Already linked` badge (gray) — ghost profile already linked to a real User account; these rows are shown but locked

Summary bar above table:
```
214 rows parsed  ·  198 exact matches  ·  16 unmatched  ·  3 new departments will be created
```

"Commit Import" button at bottom. Disabled if any rows have validation errors (invalid email format in manual-entry fields).

### Phase 3: Success

```
Import complete
198 profiles created / updated
16 without work email (will need manual onboarding)
3 new departments created: [Operations, Finance, IT Support]
```

Link back to `/admin/employees`.

---

## API Routes

### `POST /api/admin/import/preview`

- Auth: HR_ADMIN only
- Body: `multipart/form-data` with fields `sprout` (file) and `emails` (file)
- Parses both files server-side using `xlsx`
- Returns:

```typescript
{
  data: {
    rows: PreviewRow[];
    newDepartments: string[];
    counts: { total: number; matched: number; unmatched: number; alreadyLinked: number };
  }
}

type PreviewRow = {
  employeeId: string;
  displayName: string;
  firstName: string;
  lastName: string;
  department: string;       // name string
  position: string | null;
  hireDate: string | null;  // ISO date string
  birthday: string | null;
  location: string | null;
  sproutEmail: string | null;
  workEmail: string | null;
  matchQuality: "EXACT" | "UNMATCHED";
  alreadyLinked: boolean;
};
```

### `POST /api/admin/import/commit`

- Auth: HR_ADMIN only
- Body: `{ rows: CommitRow[] }` where `CommitRow` is `PreviewRow` minus `matchQuality`, plus HR-overridden `workEmail`
- For each row:
  1. Upsert `Department` by name (create if missing)
  2. Upsert `GhostProfile` by `employeeId` — update all fields except `linkedUserId` (never overwrite a link)
  3. If `alreadyLinked === true` and the row has a `linkedUserId`: also update `User.position` and `User.location` with the latest Sprout values
- Returns `{ data: { created: number; updated: number; departmentsCreated: string[] } }`

---

## Auto-Link on First Login

In `app/api/auth/sync/route.ts`, in the `!existing` branch. The current code does `await prisma.user.create(...)` without capturing the result — change it to `const newUser = await prisma.user.create(...)` then add after it:

```typescript
// Check for ghost profile matching this work email
const ghost = await prisma.ghostProfile.findUnique({
  where: { workEmail: email },
  include: { department: true },
});

if (ghost && !ghost.linkedUserId) {
  await prisma.$transaction([
    prisma.user.update({
      where: { id: newUser.id },
      data: {
        employeeId: ghost.employeeId,
        position: ghost.position ?? undefined,
        hireDate: ghost.hireDate ?? undefined,
        birthday: ghost.birthday ?? undefined,
        location: ghost.location ?? undefined,
        departmentId: ghost.departmentId ?? undefined,
        displayName: ghost.displayName, // override Firebase display name with Sprout name
      },
    }),
    prisma.ghostProfile.update({
      where: { id: ghost.id },
      data: { linkedUserId: newUser.id },
    }),
  ]);
}
```

When a ghost profile is linked, `onboardingComplete` remains `false` so the onboarding screen still runs — but it will be pre-filled with the employee's name and department, so they just need to confirm rather than fill in from scratch.

---

## Wrong Profile Recovery

If an employee was linked to the wrong ghost profile (e.g., name collision):

- **Self-service**: Profile page shows "Unlink Sprout profile" button if `employeeId` is set. Clicking it clears `employeeId`, `position`, `hireDate`, `location` from User and unsets `GhostProfile.linkedUserId`. The ghost profile becomes available to link again.
- **Admin override**: HR_ADMIN can unlink any user from the admin employees table. A "Unlink" action clears the same fields.

There is no self-service re-link — after unlinking, the employee completes onboarding manually, and HR can re-link via admin if needed.

---

## Re-Import Behavior

Sprout data changes (new hires, position changes, terminations). The import page can be used again:

- **Upsert by `employeeId`**: existing ghost profiles are updated (name, position, hireDate, etc.)
- **Already-linked records**: position and location are updated on the linked User directly (via `prisma.user.update` in the commit route). `hireDate` and `birthday` are not overwritten after linking (employee may have corrected them in-app).
- **Terminated employees (`Resigned` status)**: skipped during parse — not deleted, not upserted. Their existing records are left as-is.
- **New departments**: created automatically; existing departments matched case-insensitively.

---

## File Structure

| Path | Purpose |
|------|---------|
| `app/admin/employees/import/page.tsx` | Import UI (client component, 3-phase) |
| `app/api/admin/import/preview/route.ts` | Parse both files, return preview JSON |
| `app/api/admin/import/commit/route.ts` | Write ghost profiles to DB |
| `lib/import/parseSprout.ts` | Parse Sprout xlsx → `SproutRow[]` |
| `lib/import/parseEmails.ts` | Parse EMAILS xlsx (3 sheets) → `EmailRow[]` |
| `lib/import/matchNames.ts` | Cross-reference name arrays → `PreviewRow[]` |
| `prisma/migrations/YYYYMMDD_add_ghost_profile/` | Schema migration |

---

## Out of Scope (v1)

- Fuzzy name matching (too risky, manual override is sufficient)
- Bulk email sending to unmatched employees
- Sprout webhook / automatic sync
- Supervisor hierarchy import (managerId mapping)
- Profile photo import
