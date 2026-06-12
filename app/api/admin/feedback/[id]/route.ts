import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, requireRole } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";
import { z } from "zod";
import { createNotification } from "@/lib/helpers/createNotification";

const patchSchema = z.object({
  status: z.enum(["OPEN", "IN_REVIEW", "RESOLVED"]),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth(req);
  if (!requireRole(user, ["HR_ADMIN", "SUPER_ADMIN"])) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  const feedback = await prisma.feedback.findUnique({
    where: { id },
    include: {
      author: { select: { displayName: true, avatarUrl: true } },
      replies: {
        orderBy: { createdAt: "asc" },
        include: {
          author: { select: { id: true, displayName: true, avatarUrl: true, role: true } },
        },
      },
    },
  });

  if (!feedback) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    data: { ...feedback, author: feedback.isAnonymous ? null : feedback.author },
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth(req);
  if (!requireRole(user, ["HR_ADMIN", "SUPER_ADMIN"])) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  const feedback = await prisma.feedback.findUnique({ where: { id } });
  if (!feedback) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const updated = await prisma.feedback.update({
    where: { id },
    data: { status: parsed.data.status },
  });

  if (parsed.data.status === "RESOLVED" && feedback.authorId && !feedback.isAnonymous) {
    createNotification({
      userId: feedback.authorId,
      type: "FEEDBACK_RESOLVED",
      title: "Your feedback has been resolved",
      body: `HR has marked your feedback "${feedback.title}" as resolved.`,
    });
  }

  return NextResponse.json({ data: { status: updated.status } });
}
