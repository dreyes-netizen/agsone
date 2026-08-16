import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";
import { z } from "zod";
import { sendMail } from "@/lib/email/mailer";
import { newWhistleblowerEmail } from "@/lib/email/templates";
import { scheduleBroadcast } from "@/lib/realtime/broadcast";
import { realtimeTopics } from "@/lib/realtime/topics";
import { confidentialRealtimeTopic } from "@/lib/realtime/confidentialTopics";
import { notifyRole, ADMIN_ROLES } from "@/lib/helpers/notifyRole";

// Static distribution list, kept as a belt-and-braces channel alongside the
// in-app notification below. It does not track who holds HR_ADMIN, so it should
// not be the only delivery path — see the notifyRole call in POST.
const HR_EMAILS = "hr.ags@allianceglobalsolutions.com, hr@allianceglobalsolutions.com";

const createSchema = z.object({
  category: z.enum([
    "HARASSMENT_DISCRIMINATION",
    "ETHICAL_FRAUD",
    "MISCONDUCT_ABUSE",
    "SECURITY_POLICY",
  ]),
  title: z.string().min(1).max(150),
  body: z.string().min(1).max(1000),
  isAnonymous: z.boolean().default(true),
});

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const feedbacks = await prisma.feedback.findMany({
    where: { authorId: user.id },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      category: true,
      title: true,
      status: true,
      isAnonymous: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { replies: true } },
    },
  });

  return NextResponse.json({
    data: feedbacks,
    realtimeTopic: confidentialRealtimeTopic("feedback-user", user.id),
  });
}

export async function POST(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const feedback = await prisma.feedback.create({
    data: {
      authorId: user.id,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      category: parsed.data.category as any,
      title: parsed.data.title,
      body: parsed.data.body,
      isAnonymous: parsed.data.isAnonymous,
    },
    include: { author: { select: { displayName: true } } },
  });

  const submitterName = parsed.data.isAnonymous ? null : (feedback.author?.displayName ?? null);
  sendMail({
    to: HR_EMAILS,
    ...newWhistleblowerEmail(parsed.data.category, parsed.data.title, parsed.data.body, parsed.data.isAnonymous, submitterName),
  }).catch((err) => console.error("whistleblower notify email failed", err));

  // In-app alert to whoever actually holds an approver role right now. The
  // email above goes to a hardcoded address list that does not track the role —
  // granting someone HR_ADMIN never added them to it — and it is
  // fire-and-forget, so an SMTP failure meant the report reached nobody at all.
  //
  // Deliberately content-free: no title, no category, no body, no reporter.
  // The notification says only that something is waiting, mirroring the
  // discipline already applied to Realtime above. Anyone entitled to the detail
  // gets it behind auth on /admin/feedback.
  void notifyRole([...ADMIN_ROLES], {
    type: "FEEDBACK_SUBMITTED",
    title: "New confidential report",
    body: "A new report has been filed and is waiting for review.",
    data: { feedbackId: feedback.id },
  });

  // Empty invalidations only: confidential report fields never enter Realtime.
  scheduleBroadcast([
    { topic: confidentialRealtimeTopic("feedback-user", user.id) },
    { topic: confidentialRealtimeTopic("feedback-admin") },
    { topic: realtimeTopics.adminAnalytics },
  ]);

  return NextResponse.json({ data: feedback }, { status: 201 });
}
