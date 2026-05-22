// CRON_SECRET must be set in .env.local and the Vercel dashboard.
// Vercel will call this route daily at midnight (see vercel.json).

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma/client";
import { createNotification } from "@/lib/helpers/createNotification";
import { sendMail } from "@/lib/email/mailer";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = new Date();

  const usersWithBirthday = await prisma.user.findMany({
    where: { birthday: { not: null } },
    select: { id: true, displayName: true, email: true, birthday: true },
  });

  const birthdayUsers = usersWithBirthday.filter(
    (u) =>
      u.birthday!.getMonth() === today.getMonth() &&
      u.birthday!.getDate() === today.getDate(),
  );

  for (const user of birthdayUsers) {
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: { pointsBalance: { increment: 500 } },
      });
      await tx.pointTransaction.create({
        data: {
          toUserId: user.id,
          amount: 500,
          type: "ATTENDANCE",
          note: "Happy Birthday! 🎂",
          createdById: user.id,
        },
      });
    });

    await Promise.all([
      createNotification({
        userId: user.id,
        type: "POINTS_RECEIVED",
        title: "Happy Birthday! 🎂",
        body: "You received 500 birthday points. Have a wonderful day!",
        data: { amount: 500 },
      }),
      prisma.socialPost.create({
        data: {
          authorId: user.id,
          type: "CELEBRATION",
          content: `🎂 Happy Birthday, ${user.displayName}! They received 500 birthday points today!`,
        },
      }),
      sendMail({
        to: user.email,
        subject: "Happy Birthday from AGS One! 🎂",
        html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><title>Happy Birthday!</title></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
        <tr><td style="background:#4f46e5;padding:24px 32px;">
          <span style="color:#ffffff;font-size:20px;font-weight:700;">🎮 AGS One</span>
        </td></tr>
        <tr><td style="padding:32px;">
          <h1 style="margin:0 0 8px;font-size:24px;color:#111827;">Happy Birthday, ${user.displayName}! 🎂</h1>
          <p style="margin:0 0 20px;font-size:15px;color:#4b5563;line-height:1.6;">
            Wishing you a fantastic day! To celebrate, we've added <strong>500 bonus points</strong> to your account.
          </p>
          <div style="background:#eef2ff;border:1px solid #c7d2fe;border-radius:8px;padding:20px;margin-bottom:24px;text-align:center;">
            <span style="font-size:40px;font-weight:800;color:#4f46e5;">+500</span>
            <p style="margin:4px 0 0;font-size:14px;color:#6366f1;">birthday points added</p>
          </div>
          <a href="${process.env.NEXT_PUBLIC_APP_URL ?? "#"}/dashboard"
             style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:14px;">
            View Dashboard →
          </a>
        </td></tr>
        <tr><td style="padding:20px 32px;border-top:1px solid #e5e7eb;">
          <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">
            This is an automated message from AGS One. Please do not reply to this email.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
      }),
    ]);
  }

  return NextResponse.json({ data: { processed: birthdayUsers.length } });
}
