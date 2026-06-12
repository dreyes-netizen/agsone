import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, requireRole } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";
import { z } from "zod";

const schema = z.object({
  displayName: z.string().min(1).max(200).optional(),
  email: z.string().email().optional(),
  departmentId: z.string().uuid().nullable().optional(),
  role: z.enum(["EMPLOYEE", "MANAGER", "HR_ADMIN"]).optional(),
  isActive: z.boolean().optional(),
  hireDate: z.string().optional().nullable(),
  birthday: z.string().optional().nullable(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth(req);
  if (!requireRole(user, ["HR_ADMIN", "SUPER_ADMIN"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { displayName, email, departmentId, role, isActive, hireDate, birthday } = parsed.data;

  const updated = await prisma.user.update({
    where: { id },
    data: {
      ...(displayName !== undefined ? { displayName } : {}),
      ...(email !== undefined ? { email } : {}),
      ...(departmentId !== undefined ? { departmentId } : {}),
      ...(role !== undefined ? { role } : {}),
      ...(isActive !== undefined ? { isActive } : {}),
      ...(hireDate !== undefined ? { hireDate: hireDate ? new Date(hireDate) : null } : {}),
      ...(birthday !== undefined ? { birthday: birthday ? new Date(birthday) : null } : {}),
    },
    select: {
      id: true,
      displayName: true,
      email: true,
      role: true,
      isActive: true,
      hireDate: true,
      birthday: true,
      department: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({ data: updated });
}
