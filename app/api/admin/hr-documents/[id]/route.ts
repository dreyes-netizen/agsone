import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, requireRole } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";
import { z } from "zod";
import { scheduleBroadcast } from "@/lib/realtime/broadcast";
import { realtimeTopics } from "@/lib/realtime/topics";
import { ALL_DOCUMENT_CATEGORIES } from "@/lib/constants/documentCategories";

const updateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  category: z.enum(ALL_DOCUMENT_CATEGORIES as [string, ...string[]]).optional(),
  version: z.string().max(50).nullable().optional(),
  isActive: z.boolean().optional(),
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

  const document = await prisma.hrDocument.update({
    where: { id },
    data: parsed.data,
  });

  scheduleBroadcast([{ topic: realtimeTopics.hrDocuments }]);

  return NextResponse.json({ data: document });
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
  await prisma.hrDocument.delete({ where: { id } });

  scheduleBroadcast([{ topic: realtimeTopics.hrDocuments }]);

  return NextResponse.json({ data: { id } });
}
