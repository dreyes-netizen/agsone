import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, requireRole } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";
import { z } from "zod";
import { scheduleBroadcast } from "@/lib/realtime/broadcast";
import { realtimeTopics } from "@/lib/realtime/topics";
import { ALL_DOCUMENT_CATEGORIES } from "@/lib/constants/documentCategories";

const createSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  category: z.enum(ALL_DOCUMENT_CATEGORIES as [string, ...string[]]),
  version: z.string().max(50).optional(),
  fileUrl: z.string().url(),
  fileName: z.string().min(1),
});

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!requireRole(user, ["HR_ADMIN", "SUPER_ADMIN"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const documents = await prisma.hrDocument.findMany({
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ data: documents });
}

export async function POST(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!requireRole(user, ["HR_ADMIN", "SUPER_ADMIN"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const document = await prisma.hrDocument.create({
    data: {
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      category: parsed.data.category,
      version: parsed.data.version ?? null,
      fileUrl: parsed.data.fileUrl,
      fileName: parsed.data.fileName,
      uploadedById: user.id,
    },
  });

  scheduleBroadcast([{ topic: realtimeTopics.hrDocuments }]);

  return NextResponse.json({ data: document }, { status: 201 });
}
