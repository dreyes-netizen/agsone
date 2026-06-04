import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";
import { prisma } from "@/lib/prisma/client";
import { sendMail } from "@/lib/email/mailer";
import { welcomeEmail } from "@/lib/email/templates";

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get("authorization")?.split("Bearer ")[1];
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const decoded = await adminAuth.verifyIdToken(token);
    const displayName = decoded.name ?? decoded.email ?? "New Employee";
    const email = decoded.email ?? "";

    // 1. Already fully linked — nothing to do
    const byUid = await prisma.user.findUnique({ where: { firebaseUid: decoded.uid } });
    if (byUid) return NextResponse.json({ status: "existing" });

    // 2. Pending account pre-created by admin sync — link the real Firebase UID
    if (email) {
      const pending = await prisma.user.findFirst({
        where: { email: { equals: email, mode: "insensitive" }, firebaseUid: null },
      });
      if (pending) {
        await prisma.user.update({
          where: { id: pending.id },
          data: {
            firebaseUid: decoded.uid,
            avatarUrl: pending.avatarUrl ?? decoded.picture ?? null,
            // Keep displayName from the import unless it's just the email placeholder
            displayName: pending.displayName !== email ? pending.displayName : displayName,
          },
        });
        return NextResponse.json({ status: "linked" });
      }
    }

    // 3. Email not in the system — reject access
    return NextResponse.json({ error: "not_in_directory" }, { status: 403 });
  } catch (err) {
    console.error("Auth sync error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
