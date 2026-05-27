import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const today = new Date();

  // Build the next 14 days as (month, day) pairs
  const window: { month: number; day: number; daysUntil: number }[] = [];
  for (let i = 0; i < 14; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    window.push({ month: d.getMonth(), day: d.getDate(), daysUntil: i });
  }

  const users = await prisma.user.findMany({
    where: { birthday: { not: null }, isActive: true },
    select: {
      id: true,
      displayName: true,
      avatarUrl: true,
      birthday: true,
      department: { select: { name: true } },
    },
  });

  const results = users
    .flatMap((u) => {
      const match = window.find(
        (w) => w.month === u.birthday!.getMonth() && w.day === u.birthday!.getDate()
      );
      if (!match) return [];
      return [{
        id: u.id,
        displayName: u.displayName,
        avatarUrl: u.avatarUrl,
        department: u.department?.name ?? null,
        birthday: u.birthday,
        daysUntil: match.daysUntil,
      }];
    })
    .sort((a, b) => a.daysUntil - b.daysUntil);

  return NextResponse.json({ data: results });
}
