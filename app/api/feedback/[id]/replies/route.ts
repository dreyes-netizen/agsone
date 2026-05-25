import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";
import { z } from "zod";
import { createNotification } from "@/lib/helpers/createNotification";

const replySchema = z.object({
  body: z.string().min(1).max(1000),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const feedback = await prisma.feedback.findUnique({ where: { id } });
  if (!feedback) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (feedback.authorId !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (feedback.isAnonymous) return NextResponse.json({ error: "Cannot reply to anonymous feedback" }, { status: 400 });

  const body = await req.json();
  const parsed = replySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const reply = await prisma.feedbackReply.create({
    data: { feedbackId: id, authorId: user.id, body: parsed.data.body },
    include: {
      author: { select: { id: true, displayName: true, avatarUrl: true, role: true } },
    },
  });

  // Notify the HR admin who last replied, if any
  const lastHrReply = await prisma.feedbackReply.findFirst({
    where: { feedbackId: id, id: { not: reply.id }, author: { role: "HR_ADMIN" } },
    orderBy: { createdAt: "desc" },
    select: { authorId: true },
  });
  if (lastHrReply) {
    createNotification({
      userId: lastHrReply.authorId,
      type: "FEEDBACK_EMPLOYEE_REPLIED",
      title: "Employee replied to feedback",
      body: "A reply was added to a feedback thread you responded to.",
    });
  }

  return NextResponse.json({ data: reply }, { status: 201 });
}
