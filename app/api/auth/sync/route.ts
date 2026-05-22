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

    // Check if user already exists
    const existing = await prisma.user.findUnique({
      where: { firebaseUid: decoded.uid },
    });

    if (!existing) {
      const displayName = decoded.name ?? decoded.email ?? "New Employee";
      const email = decoded.email ?? "";

      await prisma.user.create({
        data: {
          firebaseUid: decoded.uid,
          email,
          displayName,
          avatarUrl: decoded.picture ?? null,
          role: "EMPLOYEE",
          onboardingComplete: false,
        },
      });

      // Send welcome email (fire-and-forget)
      if (email) {
        sendMail({ to: email, ...welcomeEmail(displayName) }).catch(() => {});
      }

      return NextResponse.json({ status: "created" });
    }

    return NextResponse.json({ status: "existing" });
  } catch (err) {
    console.error("Auth sync error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
