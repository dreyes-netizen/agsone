import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, requireRole } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";
import * as XLSX from "xlsx";

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

  // Collect emails of resigned employees (those with a Separation Date value that is a real date)
  const resignedEmails: string[] = [];
  const activeEmails: string[] = [];

  for (const row of rows) {
    const email = (row["Email"] as string | null)?.trim().toLowerCase();
    if (!email) continue;

    const sep = row["Separation Date"];
    const isResigned = sep && sep !== "Not yet set" && sep !== "";

    if (isResigned) {
      resignedEmails.push(email);
    } else {
      activeEmails.push(email);
    }
  }

  // Deactivate resigned employees found in the DB
  const deactivateResult = await prisma.user.updateMany({
    where: {
      email: { in: resignedEmails, mode: "insensitive" },
      isActive: true,
    },
    data: { isActive: false },
  });

  // Re-activate employees marked as still active in the file (in case they were previously deactivated by mistake)
  const reactivateResult = await prisma.user.updateMany({
    where: {
      email: { in: activeEmails, mode: "insensitive" },
      isActive: false,
    },
    data: { isActive: true },
  });

  return NextResponse.json({
    data: {
      resignedInFile: resignedEmails.length,
      activeInFile: activeEmails.length,
      deactivated: deactivateResult.count,
      reactivated: reactivateResult.count,
    },
  });
}
