import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [medicines, myRequests] = await Promise.all([
    prisma.medicineItem.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        imageUrl: true,
        caption: true,
        stockQuantity: true,
      },
    }),
    prisma.medicineRequest.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        medicineId: true,
        status: true,
        createdAt: true,
        medicine: { select: { name: true } },
      },
    }),
  ]);

  const pendingMedicineIds = myRequests
    .filter((r) => r.status === "PENDING")
    .map((r) => r.medicineId);

  return NextResponse.json({ data: { medicines, pendingMedicineIds, myRequests } });
}
