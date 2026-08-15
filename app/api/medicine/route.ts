import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";
import { parsePaginationParams } from "@/lib/api/pagination";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const { page, limit, skip } = parsePaginationParams(searchParams);

  const [medicines, myRequests, total] = await Promise.all([
    prisma.medicineItem.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        imageUrl: true,
        caption: true,
        stockQuantity: true,
        category: true,
      },
    }),
    prisma.medicineRequest.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      select: {
        id: true,
        medicineId: true,
        quantity: true,
        status: true,
        createdAt: true,
        medicine: { select: { name: true } },
      },
    }),
    prisma.medicineRequest.count({ where: { userId: user.id } }),
  ]);

  const pendingMedicineIds = myRequests
    .filter((r) => r.status === "PENDING")
    .map((r) => r.medicineId);

  return NextResponse.json({
    data: { medicines, pendingMedicineIds, myRequests },
    total,
    page,
    pages: Math.ceil(total / limit),
  });
}
