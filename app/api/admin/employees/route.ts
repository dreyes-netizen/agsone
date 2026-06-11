import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, requireRole } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";
import { z } from "zod";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!requireRole(user, ["HR_ADMIN", "MANAGER"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const employees = await prisma.user.findMany({
    take: 500,
    orderBy: { displayName: "asc" },
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

  return NextResponse.json({ data: employees });
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
  if (!requireRole(actor, ["HR_ADMIN"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { displayName, email, departmentId, role, employeeId, hireDate, birthday } = parsed.data;

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
