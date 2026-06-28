import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, requireRole } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";

/*
 * EMPLOYEE SYNC — EXCEL FILE REQUIREMENTS
 * ========================================
 * Upload an .xlsx file exported from Sprout HR with the following columns.
 * Column names must match exactly (including capitalization).
 *
 * REQUIRED COLUMNS:
 *   Email             — Used to create the employee's login account
 *   Employee ID       — Used to match and update existing employees (e.g. 1001)
 *
 * OPTIONAL COLUMNS (updated on every upload if present):
 *   First Name        — Combined with Last Name to set the display name
 *   Last Name         — Combined with First Name to set the display name
 *   Middle Name       — Accepted but not stored (can be left in the file)
 *   Birthday          — Date of birth (used for birthday milestone rewards)
 *   Hire Date         — Start date (used for work anniversary rewards)
 *   Department        — Department name; auto-created if it doesn't exist yet
 *   Immediate Supervisor — Accepted but not stored (can be left in the file)
 *
 * SEPARATION / RESIGNATION:
 *   Separation Date   — If this cell contains an actual date, the employee is
 *                       marked inactive. Text values like "N/A" or "Not yet set"
 *                       are ignored and the employee stays active.
 *
 * WHAT THIS UPLOAD DOES NOT CHANGE:
 *   - Points balance and level
 *   - App role (Employee / Manager / HR Admin)
 *   - Profile photo, banner, bio, and skills
 *
 * HOW MATCHING WORKS:
 *   1. Matches existing employees by Employee ID (primary)
 *   2. Falls back to Email if no Employee ID match is found
 *   Employees not found in the file at all are automatically deactivated.
 */

type ActiveRow = {
  email: string;
  displayName: string;
  hireDate: Date | null;
  birthday: Date | null;
  departmentName: string | null;
  employeeId: string | null;
};

export async function POST(req: NextRequest) {
  try {
    const user = await verifyAuth(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!requireRole(user, ["HR_ADMIN", "SUPER_ADMIN"])) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let formData: FormData;
    try {
      formData = await req.formData();
    } catch (e) {
      console.error("formData error:", e);
      return NextResponse.json({ error: "Could not read uploaded file" }, { status: 400 });
    }

    const file = formData.get("file");
    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    // Cap upload size before buffering/parsing to avoid a memory-pressure DoS
    // from an oversized workbook (matches the documents/attendance routes).
    const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB
    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: "File too large (max 10 MB)" }, { status: 413 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Dynamic import avoids ESM/CJS bundling issues with xlsx
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const XLSX = require("xlsx") as typeof import("xlsx");

    let workbook: import("xlsx").WorkBook;
    try {
      workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
    } catch (e) {
      console.error("XLSX parse error:", e);
      return NextResponse.json({ error: "Could not parse Excel file — make sure it is a valid .xlsx file" }, { status: 400 });
    }

    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null });

    const resignedEmails: string[] = [];
    const activeRows: ActiveRow[] = [];

    for (const row of rows) {
      const email = (row["Email"] as string | null)?.trim().toLowerCase();
      if (!email) continue;

      const sep = row["Separation Date"];
      // Only treat as resigned when the cell contains an actual date (Date object).
      // Text placeholders like "Not yet set", "N/A", "-", etc. are treated as active.
      const isResigned = sep instanceof Date;

      if (isResigned) {
        resignedEmails.push(email);
      } else {
        const firstName = (row["First Name"] as string | null)?.trim() ?? "";
        const lastName = (row["Last Name"] as string | null)?.trim() ?? "";
        const displayName = `${firstName} ${lastName}`.trim() || email;
        const hireDateRaw = row["Hire Date"];
        const hireDate = hireDateRaw instanceof Date ? hireDateRaw : null;
        const birthdayRaw = row["Birthday"];
        const birthday = birthdayRaw instanceof Date ? birthdayRaw : null;
        const departmentName = (row["Department"] as string | null)?.trim() ?? null;
        const employeeId = ((row["Employee #"] ?? row["Employee ID"]) as string | null)?.trim() || null;
        activeRows.push({ email, displayName, hireDate, birthday, departmentName, employeeId });
      }
    }

    // Upsert departments from the file so new department names are created automatically
    const uniqueDeptNames = [...new Set(
      activeRows.map((r) => r.departmentName).filter((n): n is string => !!n)
    )];
    for (const name of uniqueDeptNames) {
      await prisma.department.upsert({
        where: { name },
        update: {},
        create: { name },
      });
    }

    // Load all departments for name matching
    const departments = await prisma.department.findMany({ select: { id: true, name: true } });
    const deptByName = new Map(departments.map((d) => [d.name.toLowerCase(), d.id]));

    // --- Match existing employees: Employee ID first, email fallback ---

    // Step 1: match by employeeId
    const fileEmployeeIds = activeRows.map((r) => r.employeeId).filter((id): id is string => !!id);
    const usersById = fileEmployeeIds.length > 0
      ? await prisma.user.findMany({
          where: { employeeId: { in: fileEmployeeIds } },
          select: { id: true, employeeId: true },
        })
      : [];
    const matchedByIdMap = new Map(usersById.map((u) => [u.employeeId!, u.id]));

    // Step 2: for rows not matched by employeeId, fall back to email
    const unmatchedRows = activeRows.filter((r) => !r.employeeId || !matchedByIdMap.has(r.employeeId));
    const usersByEmail = unmatchedRows.length > 0
      ? await prisma.user.findMany({
          where: { email: { in: unmatchedRows.map((r) => r.email), mode: "insensitive" } },
          select: { id: true, email: true },
        })
      : [];
    const matchedByEmailMap = new Map(usersByEmail.map((u) => [u.email.toLowerCase().trim(), u.id]));

    function getUserId(row: ActiveRow): string | undefined {
      if (row.employeeId && matchedByIdMap.has(row.employeeId)) return matchedByIdMap.get(row.employeeId);
      return matchedByEmailMap.get(row.email);
    }

    // All user IDs considered "in the file" (used for deactivation logic)
    const inFileUserIds = new Set([...usersById.map((u) => u.id), ...usersByEmail.map((u) => u.id)]);

    // Create accounts for employees not found by either method
    const newRows = activeRows.filter((r) => !getUserId(r));
    let imported = 0;
    const failedEmails: string[] = [];
    for (const row of newRows) {
      const departmentId = row.departmentName
        ? (deptByName.get(row.departmentName.toLowerCase()) ?? null)
        : null;
      try {
        await prisma.user.create({
          data: {
            firebaseUid: null,
            email: row.email,
            displayName: row.displayName,
            hireDate: row.hireDate,
            birthday: row.birthday,
            departmentId,
            employeeId: row.employeeId,
            role: "EMPLOYEE",
            onboardingComplete: false,
            isActive: true,
          },
        });
        imported++;
      } catch (e) {
        console.warn("Failed to create user during sync:", e instanceof Error ? e.message : e);
        failedEmails.push(row.email);
      }
    }

    // Update existing employees
    let birthdaysUpdated = 0;
    for (const row of activeRows) {
      const userId = getUserId(row);
      if (!userId) continue;
      const departmentId = row.departmentName
        ? (deptByName.get(row.departmentName.toLowerCase()) ?? null)
        : null;
      const updateData: Record<string, unknown> = { departmentId };
      if (row.birthday) { updateData.birthday = row.birthday; birthdaysUpdated++; }
      if (row.hireDate) updateData.hireDate = row.hireDate;
      // Always write employeeId — stamps it on email-matched records so future syncs use ID
      if (row.employeeId) updateData.employeeId = row.employeeId;
      await prisma.user.update({ where: { id: userId }, data: updateData });
    }

    // Deactivate resigned employees found in the DB
    const deactivateResult = await prisma.user.updateMany({
      where: {
        email: { in: resignedEmails, mode: "insensitive" },
        isActive: true,
      },
      data: { isActive: false },
    });

    // Re-activate employees the file says are still active but were previously deactivated
    const reactivateResult = await prisma.user.updateMany({
      where: {
        id: { in: [...inFileUserIds] },
        isActive: false,
        role: 'EMPLOYEE',
      },
      data: { isActive: true },
    });

    // Deactivate employees not present in the active list at all
    const notInFile = await prisma.user.findMany({
      where: {
        isActive: true,
        role: "EMPLOYEE",
        NOT: { id: { in: [...inFileUserIds] } },
      },
      select: { id: true },
    });
    const removedResult = await prisma.user.updateMany({
      where: { id: { in: notInFile.map((u) => u.id) } },
      data: { isActive: false },
    });

    return NextResponse.json({
      data: {
        resignedInFile: resignedEmails.length,
        activeInFile: activeRows.length,
        deactivated: deactivateResult.count,
        reactivated: reactivateResult.count,
        removedFromList: removedResult.count,
        imported,
        birthdaysUpdated,
        failedImports: failedEmails.length,
        failedEmails,
      },
    });
  } catch (err) {
    console.error("Sync route error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `Sync failed: ${message}` }, { status: 500 });
  }
}
