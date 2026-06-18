import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";
import { z } from "zod";
import { sendMail } from "@/lib/email/mailer";
import { newWhistleblowerEmail } from "@/lib/email/templates";

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

  return NextResponse.json({ data: feedbacks });
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
  }).catch(() => {});

  return NextResponse.json({ data: feedback }, { status: 201 });
}
