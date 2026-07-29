import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, requireRole } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";

function escapeCsv(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function formatDate(date: Date | null): string {
  if (!date) return "";
  return date.toISOString().split("T")[0];
}

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!requireRole(user, ["HR_ADMIN", "MANAGER", "SUPER_ADMIN"])) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") ?? undefined;
  const department = searchParams.get("department") ?? undefined;
  const role = searchParams.get("role") ?? undefined;
  const status = searchParams.get("status") ?? undefined;

  const where: Record<string, unknown> = {};
  if (search) {
    where.OR = [
      { displayName: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
    ];
  }
  if (department) {
    where.department = { name: department };
  }
  if (role) {
    where.role = role;
  }
  if (status === "active") {
    where.isActive = true;
  } else if (status === "inactive") {
    where.isActive = false;
  }

  const employees = await prisma.user.findMany({
    where,
    orderBy: { displayName: "asc" },
    select: {
      employeeId: true,
      displayName: true,
      email: true,
      role: true,
      pointsBalance: true,
      isActive: true,
      hireDate: true,
      birthday: true,
      department: { select: { name: true } },
    },
  });

  const roleLabel: Record<string, string> = {
    EMPLOYEE: "Employee",
    MANAGER: "Manager",
    HR_ADMIN: "HR Admin",
    SUPER_ADMIN: "Super Admin",
  };

  const header = "Employee ID,Name,Email,Department,Role,Status,Points,Hire Date,Birthday";
  const rows = employees.map((e) =>
    [
      e.employeeId ?? "",
      escapeCsv(e.displayName),
      escapeCsv(e.email),
      escapeCsv(e.department?.name ?? ""),
      roleLabel[e.role] ?? e.role,
      e.isActive ? "Active" : "Inactive",
      e.pointsBalance.toString(),
      formatDate(e.hireDate),
      formatDate(e.birthday),
    ].join(",")
  );

  const csv = [header, ...rows].join("\n");

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="employees.csv"',
    },
  });
}
