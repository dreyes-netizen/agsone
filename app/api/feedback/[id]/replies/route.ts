import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";
import { z } from "zod";
import { createNotification } from "@/lib/helpers/createNotification";
import { notifyRole, ADMIN_ROLES } from "@/lib/helpers/notifyRole";
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
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const feedback = await prisma.feedback.findUnique({ where: { id } });
  if (!feedback) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (feedback.authorId !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Anonymous threads are repliable from this side too. The reporter stays
  // anonymous to HR: the admin thread GET strips the author from any reply
  // whose authorId matches the (hidden) reporter, so this only ever appears to
  // HR as "Reporter".

  const body = await req.json();
  const parsed = replySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const reply = await prisma.feedbackReply.create({
    data: { feedbackId: id, authorId: user.id, body: parsed.data.body },
    include: {
      author: { select: { id: true, displayName: true, avatarUrl: true, role: true } },
    },
  });

  await prisma.feedback.update({ where: { id }, data: { updatedAt: new Date() } });

  // Notify the admin who last replied. Previously filtered on HR_ADMIN alone,
  // so a thread handled entirely by a SUPER_ADMIN notified nobody and the
  // reporter's reply went unseen. Falls back to the whole approver group when
  // no one has replied yet — which is now reachable, since HR can be the second
  // participant rather than always the first.
  const lastAdminReply = await prisma.feedbackReply.findFirst({
    where: {
      feedbackId: id,
      id: { not: reply.id },
      author: { role: { in: ["HR_ADMIN", "SUPER_ADMIN"] } },
    },
    orderBy: { createdAt: "desc" },
    select: { authorId: true },
  });

  const replyNotification = {
    type: "FEEDBACK_EMPLOYEE_REPLIED",
    title: "Reporter replied",
    body: "A new reply was added to a confidential report.",
    data: { feedbackId: id },
  };

  if (lastAdminReply) {
    void createNotification({ ...replyNotification, userId: lastAdminReply.authorId })
      .catch((err) => console.error("feedback reply notification failed", err));
  } else {
    void notifyRole([...ADMIN_ROLES], replyNotification, { excludeUserId: user.id });
  }

  scheduleBroadcast([
    { topic: confidentialRealtimeTopic("feedback-user", user.id) },
    { topic: confidentialRealtimeTopic("feedback-thread", id) },
    { topic: confidentialRealtimeTopic("feedback-admin") },
    { topic: realtimeTopics.adminAnalytics },
  ]);

  return NextResponse.json({ data: reply }, { status: 201 });
}
