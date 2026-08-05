import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, requireRole } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";
import { parsePaginationParams, paginatedResponse } from "@/lib/api/pagination";
import { z } from "zod";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!requireRole(user, ["HR_ADMIN", "MANAGER", "SUPER_ADMIN"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const { page, limit, skip } = parsePaginationParams(searchParams);
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

  const [employees, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { displayName: "asc" },
      skip,
      take: limit,
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
    }),
    prisma.user.count({ where }),
  ]);

  return NextResponse.json(paginatedResponse(employees, total, page, limit));
}

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
  if (!requireRole(actor, ["HR_ADMIN", "SUPER_ADMIN"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { displayName, email, departmentId, role, employeeId, hireDate, birthday } = parsed.data;

  // Mirror the elevated-role guard in /api/admin/users/[id]/role — only
  // SUPER_ADMIN may create a new HR_ADMIN. Without this, any HR_ADMIN could
  // mint more HR_ADMINs through this generic create route.
  if (role === "HR_ADMIN" && actor!.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Only Super Admin can assign elevated roles" }, { status: 403 });
  }

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
