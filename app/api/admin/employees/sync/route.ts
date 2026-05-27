import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, requireRole } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";
import * as XLSX from "xlsx";

type ActiveRow = {
  email: string;
  displayName: string;
  hireDate: Date | null;
  departmentName: string | null;
};

export async function POST(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!requireRole(user, ["HR_ADMIN"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  } catch {
    return NextResponse.json({ error: "Could not parse Excel file" }, { status: 400 });
  }

  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null });

  const resignedEmails: string[] = [];
  const activeRows: ActiveRow[] = [];

  for (const row of rows) {
    const email = (row["Email"] as string | null)?.trim().toLowerCase();
    if (!email) continue;

    const sep = row["Separation Date"];
    const isResigned = sep && sep !== "Not yet set" && sep !== "";

    if (isResigned) {
      resignedEmails.push(email);
    } else {
      const firstName = (row["First Name"] as string | null)?.trim() ?? "";
      const lastName = (row["Last Name"] as string | null)?.trim() ?? "";
      const displayName = `${firstName} ${lastName}`.trim() || email;
      const hireDateRaw = row["Hire Date"];
      const hireDate = hireDateRaw instanceof Date ? hireDateRaw : null;
      const departmentName = (row["Department"] as string | null)?.trim() ?? null;

      activeRows.push({ email, displayName, hireDate, departmentName });
    }
  }

  // Load all departments for name matching
  const departments = await prisma.department.findMany({ select: { id: true, name: true } });
  const deptByName = new Map(departments.map((d) => [d.name.toLowerCase(), d.id]));

  // Find which active emails already exist in DB
  const existingUsers = await prisma.user.findMany({
    where: { email: { in: activeRows.map((r) => r.email), mode: "insensitive" } },
    select: { email: true },
  });
  const existingEmails = new Set(existingUsers.map((u) => u.email.toLowerCase()));

  // Create pending accounts for new employees (not yet in DB)
  const newRows = activeRows.filter((r) => !existingEmails.has(r.email));
  let imported = 0;
  for (const row of newRows) {
    const departmentId = row.departmentName
      ? (deptByName.get(row.departmentName.toLowerCase()) ?? null)
      : null;
    await prisma.user.create({
      data: {
        firebaseUid: null,
        email: row.email,
        displayName: row.displayName,
        hireDate: row.hireDate,
        departmentId,
        role: "EMPLOYEE",
        onboardingComplete: false,
        isActive: true,
      },
    });
    imported++;
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

  return NextResponse.json({
    data: {
      resignedInFile: resignedEmails.length,
      activeInFile: activeRows.length,
      deactivated: deactivateResult.count,
      reactivated: reactivateResult.count,
      imported,
    },
  });
}
