import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, requireRole } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";

type ActiveRow = {
  email: string;
  displayName: string;
  hireDate: Date | null;
  birthday: Date | null;
  departmentName: string | null;
};

export async function POST(req: NextRequest) {
  try {
    const user = await verifyAuth(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!requireRole(user, ["HR_ADMIN"])) {
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
        activeRows.push({ email, displayName, hireDate, birthday, departmentName });
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

    // Find which active emails already exist in DB (trim DB emails to avoid whitespace mismatches)
    const existingUsers = await prisma.user.findMany({
      where: { email: { in: activeRows.map((r) => r.email), mode: "insensitive" } },
      select: { id: true, email: true },
    });
    const existingByEmail = new Map(existingUsers.map((u) => [u.email.toLowerCase().trim(), u.id]));

    // Create pending accounts for new employees not yet in DB
    const newRows = activeRows.filter((r) => !existingByEmail.has(r.email));
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
            role: "EMPLOYEE",
            onboardingComplete: false,
            isActive: true,
          },
        });
        imported++;
      } catch (e) {
        console.warn("Failed to create user for", row.email, e);
        failedEmails.push(row.email);
      }
    }

    // Update birthday, hireDate, and department on existing employees
    let birthdaysUpdated = 0;
    for (const row of activeRows) {
      const userId = existingByEmail.get(row.email);
      if (!userId) continue;
      const departmentId = row.departmentName
        ? (deptByName.get(row.departmentName.toLowerCase()) ?? null)
        : null;
      const updateData: Record<string, unknown> = { departmentId };
      if (row.birthday) { updateData.birthday = row.birthday; birthdaysUpdated++; }
      if (row.hireDate) updateData.hireDate = row.hireDate;
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
        email: { in: activeRows.map((r) => r.email), mode: "insensitive" },
        isActive: false,
      },
      data: { isActive: true },
    });

    // Deactivate employees not present in the active list at all
    // (covers resigned employees whose email was removed from the file)
    const notInFile = await prisma.user.findMany({
      where: {
        isActive: true,
        role: "EMPLOYEE",
        NOT: { email: { in: activeRows.map((r) => r.email), mode: "insensitive" } },
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
