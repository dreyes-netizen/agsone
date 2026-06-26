import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, requireRole } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";
import { z } from "zod";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Only the admin management view should see hidden (inactive) rewards, and only
  // when it explicitly asks via ?includeInactive=true. The employee-facing
  // Marketplace omits the flag, so it always gets active rewards only — even when
  // an admin is the one browsing it.
  const isAdmin = requireRole(user, ["HR_ADMIN", "SUPER_ADMIN"]);
  const includeInactive = new URL(req.url).searchParams.get("includeInactive") === "true";
  const rewards = await prisma.reward.findMany({
    where: isAdmin && includeInactive ? {} : { isActive: true },
    orderBy: { pointCost: "asc" },
  });

  return NextResponse.json({ data: rewards });
}

const createSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  imageUrls: z.array(z.string().url()).max(3).default([]),
  pointCost: z.number().int().min(1),
  stockQuantity: z.number().int().min(-1).default(-1),
  category: z.enum(["PHYSICAL", "VOUCHER", "PRIVILEGE", "DIGITAL"]),
});

export async function POST(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!requireRole(user, ["HR_ADMIN", "SUPER_ADMIN"])) {
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
