import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, requireRole } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";
import { z } from "zod";
import { scheduleBroadcast } from "@/lib/realtime/broadcast";
import { realtimeTopics } from "@/lib/realtime/topics";

const updateSchema = z.object({
  name: z.string().min(1),
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

  const conflict = await prisma.account.findFirst({
    where: { name: parsed.data.name, NOT: { id } },
  });
  if (conflict) {
    return NextResponse.json(
      { error: "Account name already exists" },
      { status: 400 }
    );
  }

  const account = await prisma.account.update({
    where: { id },
    data: { name: parsed.data.name },
    select: { id: true, name: true, createdAt: true },
  });

  scheduleBroadcast([{ topic: realtimeTopics.accounts }]);

  return NextResponse.json({ data: account });
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

  await prisma.account.delete({ where: { id } });

  scheduleBroadcast([{ topic: realtimeTopics.accounts }]);

  return NextResponse.json({ data: { id } });
}
