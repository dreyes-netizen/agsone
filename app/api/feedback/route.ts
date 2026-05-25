import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";
import { z } from "zod";

const createSchema = z.object({
  category: z.enum([
    "COMPENSATION_BENEFITS",
    "WORK_LIFE_BALANCE",
    "COMPANY_CULTURE",
    "TEAM_DYNAMICS",
    "PROCESSES_TOOLS",
    "RECOGNITION",
    "OTHER",
  ]),
  title: z.string().min(1).max(150),
  body: z.string().min(1).max(1000),
  isAnonymous: z.boolean().default(false),
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
      category: parsed.data.category,
      title: parsed.data.title,
      body: parsed.data.body,
      isAnonymous: parsed.data.isAnonymous,
    },
  });

  return NextResponse.json({ data: feedback }, { status: 201 });
}
