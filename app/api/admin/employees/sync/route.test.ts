import { beforeEach, describe, expect, it, vi } from "vitest";
import ExcelJS from "exceljs";

/**
 * Covers the one behavior this route's own doc comment promises but the
 * implementation didn't actually do until now: an existing employee's
 * displayName is reset from the roster's First/Last Name on every sync that
 * has name data for that row (deliberately overriding a name the employee
 * edited during onboarding), while a row with no name data leaves the
 * existing displayName untouched instead of falling back to the row's
 * email-derived placeholder.
 *
 * The route talks to Prisma through a raw `$executeRaw` tagged template for
 * the existing-employee update, built from `Prisma.sql`/`Prisma.join`
 * fragments. Rather than re-implementing COALESCE semantics in a hand-rolled
 * mock (which would just test the mock), this captures the real flattened
 * parameter list Prisma builds for that call and asserts on it directly --
 * the row tuple order is
 * (userId, departmentId, birthday, hireDate, employeeId, rosterName).
 */

const doubles = vi.hoisted(() => ({
  verifyAuth: vi.fn(),
  transaction: vi.fn(),
  executeRaw: vi.fn(),
  departmentCreateMany: vi.fn(),
  departmentFindMany: vi.fn(),
  userFindMany: vi.fn(),
  userCreateMany: vi.fn(),
  userUpdateMany: vi.fn(),
  writeAuditLog: vi.fn(),
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
    $transaction: doubles.transaction,
  },
}));

vi.mock("@/lib/helpers/writeAuditLog", () => ({
  writeAuditLog: doubles.writeAuditLog,
}));

vi.mock("@/lib/realtime/broadcast", () => ({
  scheduleBroadcast: doubles.scheduleBroadcast,
}));

import { POST } from "./route";

const HR_ADMIN = {
  id: "hr-1",
  firebaseUid: "fb-hr-1",
  email: "hr@ags.test",
  displayName: "HR Admin",
  role: "HR_ADMIN" as const,
  departmentId: null,
};

async function buildRosterFile(
  rows: { Email: string; "Employee ID": string; "First Name"?: string; "Last Name"?: string }[]
) {
  const headers = ["Email", "Employee ID", "First Name", "Last Name"];
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Roster");
  sheet.addRow(headers);
  for (const row of rows) {
    sheet.addRow(headers.map((h) => (row as Record<string, unknown>)[h] ?? null));
  }
  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  return new File([buffer], "roster.xlsx", {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

function request(file: File) {
  const formData = new FormData();
  formData.set("file", file);
  return new Request("http://localhost/api/admin/employees/sync", {
    method: "POST",
    body: formData,
  }) as never; // route only reads formData()/headers off it, same cast style as sibling route tests
}

// Captures the flattened, ordered parameter list Prisma builds for the
// existing-employee $executeRaw call, chunked into one array per row in
// (userId, departmentId, birthday, hireDate, employeeId, rosterName) order.
function capturedUpdateRows(): unknown[][] {
  expect(doubles.executeRaw).toHaveBeenCalledTimes(1);
  const [, joinedFragment] = doubles.executeRaw.mock.calls[0] as [unknown, { values: unknown[] }];
  const flat = joinedFragment.values;
  const rows: unknown[][] = [];
  for (let i = 0; i < flat.length; i += 6) rows.push(flat.slice(i, i + 6));
  return rows;
}

beforeEach(() => {
  vi.clearAllMocks();

  doubles.verifyAuth.mockResolvedValue(HR_ADMIN);

  doubles.departmentCreateMany.mockResolvedValue({ count: 0 });
  doubles.departmentFindMany.mockResolvedValue([]);
  doubles.userCreateMany.mockResolvedValue({ count: 0 });
  doubles.userUpdateMany.mockResolvedValue({ count: 0 });
  doubles.executeRaw.mockResolvedValue(undefined);

  // Both test rows below are matched by Employee ID, so the route never
  // falls back to the email-based lookup or the "not in file" deactivation
  // sweep needs anything beyond an empty result.
  doubles.userFindMany.mockImplementation(async (args: { where?: { employeeId?: { in: string[] } } }) => {
    if (args?.where?.employeeId?.in) {
      return [
        { id: "user-alice", employeeId: "1001" },
        { id: "user-bob", employeeId: "1002" },
      ];
    }
    return [];
  });

  doubles.transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
    fn({
      department: { createMany: doubles.departmentCreateMany, findMany: doubles.departmentFindMany },
      user: { findMany: doubles.userFindMany, createMany: doubles.userCreateMany, updateMany: doubles.userUpdateMany },
      $executeRaw: doubles.executeRaw,
    })
  );

  doubles.writeAuditLog.mockResolvedValue(undefined);
});

describe("POST /api/admin/employees/sync", () => {
  it("overwrites an existing employee's displayName when the row has First/Last Name data", async () => {
    const file = await buildRosterFile([
      { Email: "alice@ags.test", "Employee ID": "1001", "First Name": "Alice", "Last Name": "Wonder" },
      { Email: "bob@ags.test", "Employee ID": "1002" },
    ]);

    const res = await POST(request(file));
    expect(res.status).toBe(200);

    const rows = capturedUpdateRows();
    expect(rows).toHaveLength(2);

    const aliceRow = rows.find((r) => r[0] === "user-alice")!;
    expect(aliceRow[5]).toBe("Alice Wonder"); // rosterName -- overwrite expected
  });

  it("leaves an existing employee's displayName alone when the row has no First/Last Name data", async () => {
    const file = await buildRosterFile([
      { Email: "alice@ags.test", "Employee ID": "1001", "First Name": "Alice", "Last Name": "Wonder" },
      { Email: "bob@ags.test", "Employee ID": "1002" }, // no name columns filled in for Bob
    ]);

    await POST(request(file));

    const rows = capturedUpdateRows();
    const bobRow = rows.find((r) => r[0] === "user-bob")!;
    expect(bobRow[5]).toBeNull(); // rosterName -- COALESCE keeps the existing name in the DB
  });
});
