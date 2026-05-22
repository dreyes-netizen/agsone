import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";

// One-time route: promotes the calling user to HR_ADMIN
// Disabled automatically once any HR_ADMIN exists
export async function POST(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Block if an HR_ADMIN already exists
  const existingAdmin = await prisma.user.findFirst({
    where: { role: "HR_ADMIN" },
  });

  if (existingAdmin) {
    return NextResponse.json(
      { error: "An HR Admin already exists. This route is disabled." },
      { status: 403 }
    );
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { role: "HR_ADMIN" },
    select: { displayName: true, email: true, role: true },
  });

  return NextResponse.json({
    message: `${updated.displayName} has been promoted to HR_ADMIN.`,
    data: updated,
  });
}
