import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const today = new Date();

  // Birthdays are stored as UTC-midnight date-only values, so the lookahead
  // window must be built in UTC too — otherwise comparing against a
  // local-time "today" shifts the window by a day depending on the server's
  // timezone offset.
  const window: { month: number; day: number; daysUntil: number }[] = [];
  for (let i = 0; i < 14; i++) {
    const d = new Date(today);
    d.setUTCDate(today.getUTCDate() + i);
    window.push({ month: d.getUTCMonth(), day: d.getUTCDate(), daysUntil: i });
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
        (w) => w.month === u.birthday!.getUTCMonth() && w.day === u.birthday!.getUTCDate()
      );
      if (!match) return [];
      return [{
        id: u.id,
        displayName: u.displayName,
        avatarUrl: u.avatarUrl,
        department: u.department?.name ?? null,
        // Never expose the birth year — month/day + daysUntil is enough
        birthdayMonthDay: `${String(u.birthday!.getUTCMonth() + 1).padStart(2, "0")}-${String(u.birthday!.getUTCDate()).padStart(2, "0")}`,
        daysUntil: match.daysUntil,
      }];
    })
    .sort((a, b) => a.daysUntil - b.daysUntil);

  return NextResponse.json({ data: results });
}
