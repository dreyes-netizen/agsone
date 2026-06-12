# Manual Employee Add — Design Spec

**Date:** 2026-06-12
**Feature:** Add a single employee manually from the Admin → Employees page

---

## Goal

Allow HR admins to pre-provision an employee account by entering their details manually, without needing to re-upload the full Excel file. The created record is a ghost profile (`firebaseUid: null`) that auto-activates when the employee first logs in with their company Google account.

---

## UI

### Trigger
An **"Add Employee"** button placed next to the existing "Sync Excel" button in the top-right of `app/admin/employees/page.tsx`.

### Modal
A standard modal (same style as other admin modals in the app) with the following fields:

| Field | Type | Required | Notes |
|---|---|---|---|
| Full name | Text input | ✅ | Maps to `displayName` |
| Work email | Email input | ✅ | Must end in `@allianceglobalsolutions.com` — validated client-side and server-side |
| Department | Dropdown | — | Options loaded from existing departments; "No department" as default |
| Role | Dropdown | ✅ | Employee / Manager / HR Admin; defaults to Employee |
| Employee ID | Text input | — | Optional Sprout EID |
| Hire date | Date input | — | Maps to `hireDate` |
| Birthday | Date input | — | Maps to `birthday` |

**Submit button:** "Add Employee" — disabled while submitting.

**Error states:**
- Email not from company domain → inline error under email field
- Email already exists → inline error after API returns 409
- Generic server error → inline error at bottom of form

---

## API

### `POST /api/admin/employees`

**Auth:** HR_ADMIN only.

**Request body:**
```json
{
  "displayName": "Juan Dela Cruz",
  "email": "j.delacruz@allianceglobalsolutions.com",
  "departmentId": "uuid-or-null",
  "role": "EMPLOYEE",
  "employeeId": "EMP-001",
  "hireDate": "2026-01-15",
  "birthday": "1990-03-22"
}
```

**Validation (Zod):**
- `displayName`: string, min 2, max 100
- `email`: string, email format, must end in `@allianceglobalsolutions.com`
- `departmentId`: UUID or null
- `role`: enum `EMPLOYEE | MANAGER | HR_ADMIN`
- `employeeId`: optional string, max 50
- `hireDate`: optional ISO date string
- `birthday`: optional ISO date string

**DB write:** `prisma.user.create` with `firebaseUid: null`, `onboardingComplete: false`, `isActive: true`, `pointsBalance: 0`.

**Responses:**
- `201` — created successfully, returns the new user record
- `409` — email already exists
- `400` — validation error
- `403` — not HR_ADMIN

---

## Data Flow

1. HR admin clicks "Add Employee"
2. Modal opens with empty form
3. HR fills in fields and submits
4. Client validates email domain; shows error if invalid
5. `POST /api/admin/employees` called
6. Server creates `User` with `firebaseUid: null`
7. Modal closes; new employee appears in the table as **Inactive** (no Firebase account yet)
8. When employee logs in with Google → `/api/auth/sync` matches by email → fills `firebaseUid` → account activates

---

## Notes

- No email is sent to the employee upon manual add — HR handles communication separately
- The employee will appear in the table with no avatar and `isActive: true` but no login history
- Existing `GET /api/admin/employees` already returns these records, so no table changes needed
- Department dropdown reuses the same departments already loaded on the page
