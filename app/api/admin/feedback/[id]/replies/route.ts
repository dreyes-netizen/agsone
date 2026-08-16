import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, requireRole } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";
import { z } from "zod";
import { createNotification } from "@/lib/helpers/createNotification";
import { sendMail } from "@/lib/email/mailer";
import { hrReplyEmail } from "@/lib/email/templates";
import { scheduleBroadcast } from "@/lib/realtime/broadcast";
import { realtimeTopics } from "@/lib/realtime/topics";
import { confidentialRealtimeTopic } from "@/lib/realtime/confidentialTopics";

const replySchema = z.object({
  body: z.string().min(1).max(1000),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth(req);
  if (!requireRole(user, ["HR_ADMIN", "SUPER_ADMIN"])) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  const feedback = await prisma.feedback.findUnique({
    where: { id },
    include: { author: { select: { email: true, displayName: true } } },
  });
  if (!feedback) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Anonymous threads are repliable. `isAnonymous` defaults to true in the
  // submit schema, so blocking replies here meant the *default* whistleblower
  // report could never be answered — HR's only possible action was a status
  // change, and the reporter never heard anything back.
  //
  // Replying is safe because the reporter's identity is never exposed to HR:
  // the thread GET nulls the author on the report and on any reply the reporter
  // wrote. The notification and email below go outward to the reporter, who
  // obviously already knows who they are.

  const body = await req.json();
  const parsed = replySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const reply = await prisma.feedbackReply.create({
    data: { feedbackId: id, authorId: user.id, body: parsed.data.body },
    include: {
      author: { select: { id: true, displayName: true, avatarUrl: true, role: true } },
    },
  });

  // Auto-advance status from OPEN to IN_REVIEW, always bump updatedAt
  if (feedback.status === "OPEN") {
    await prisma.feedback.update({ where: { id }, data: { status: "IN_REVIEW", updatedAt: new Date() } });
  } else {
    await prisma.feedback.update({ where: { id }, data: { updatedAt: new Date() } });
  }

  // Notify the employee — in-app + email
  if (feedback.authorId && feedback.author) {
    createNotification({
      userId: feedback.authorId,
      type: "FEEDBACK_HR_REPLIED",
      title: "HR responded to your feedback",
      body: `HR has replied to your feedback: "${feedback.title}".`,
    }).catch((err) => console.error("feedback reply notification failed", err));
    sendMail({
      to: feedback.author.email,
      ...hrReplyEmail(feedback.author.displayName, feedback.title, parsed.data.body),
    }).catch((err) => console.error("feedback reply email failed", err));
  }

  scheduleBroadcast([
    { topic: confidentialRealtimeTopic("feedback-admin") },
    { topic: confidentialRealtimeTopic("feedback-thread", id) },
    { topic: realtimeTopics.adminAnalytics },
    ...(feedback.authorId ? [{ topic: confidentialRealtimeTopic("feedback-user", feedback.authorId) }] : []),
  ]);

  return NextResponse.json({ data: reply }, { status: 201 });
}
