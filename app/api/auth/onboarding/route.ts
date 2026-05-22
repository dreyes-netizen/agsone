import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";
import { z } from "zod";

const schema = z.object({
  displayName: z.string().min(2).max(100),
  departmentId: z.string().uuid().optional(),
  birthday: z.string().optional(),
});

export async function PATCH(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { displayName, departmentId, birthday } = parsed.data;

  if (departmentId) {
    const dept = await prisma.department.findUnique({ where: { id: departmentId } });
    if (!dept) {
      return NextResponse.json({ error: "Department not found" }, { status: 400 });
    }
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      displayName,
      ...(departmentId ? { departmentId } : {}),
      onboardingComplete: true,
      ...(birthday ? { birthday: new Date(birthday) } : {}),
    },
  });

  return NextResponse.json({ data: { onboardingComplete: true } });
}
