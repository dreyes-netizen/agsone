import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, requireRole } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";
import { z } from "zod";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rewards = await prisma.reward.findMany({
    where: { isActive: true },
    orderBy: { pointCost: "asc" },
  });

  return NextResponse.json({ data: rewards });
}

const createSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  pointCost: z.number().int().min(1),
  stockQuantity: z.number().int().min(-1).default(-1),
  category: z.enum(["PHYSICAL", "VOUCHER", "PRIVILEGE", "DIGITAL"]),
});

export async function POST(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!requireRole(user, ["HR_ADMIN"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const reward = await prisma.reward.create({
    data: { ...parsed.data, createdById: user!.id },
  });

  return NextResponse.json({ data: reward }, { status: 201 });
}
