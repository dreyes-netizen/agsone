import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, requireRole } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
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
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  if (parsed.data.name) {
    const conflict = await prisma.department.findFirst({
      where: { name: parsed.data.name, NOT: { id } },
    });
    if (conflict) {
      return NextResponse.json(
        { error: "Department name already exists" },
        { status: 400 }
      );
    }
  }

  const department = await prisma.department.update({
    where: { id },
    data: {
      ...(parsed.data.name !== undefined && { name: parsed.data.name }),
      ...(parsed.data.description !== undefined && {
        description: parsed.data.description,
      }),
    },
    select: {
      id: true,
      name: true,
      description: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ data: department });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth(req);
  if (!requireRole(user, ["HR_ADMIN", "SUPER_ADMIN"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const employeeCount = await prisma.user.count({
    where: { departmentId: id },
  });

  if (employeeCount > 0) {
    return NextResponse.json(
      { error: "Cannot delete department with assigned employees" },
      { status: 400 }
    );
  }

  await prisma.department.delete({ where: { id } });

  return NextResponse.json({ data: { id } });
}
