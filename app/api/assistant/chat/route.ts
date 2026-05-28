import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";
import { downloadPdf } from "@/lib/supabase/storageClient";
import { generateChatReply } from "@/lib/gemini/client";
import { z } from "zod";
import { Content } from "@google/generative-ai";

const historySchema = z.array(
  z.object({
    role: z.enum(["user", "model"]),
    parts: z.array(z.object({ text: z.string() })),
  }),
);

const bodySchema = z.object({
  message: z.string().min(1).max(2000),
  history: historySchema,
});

export async function POST(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { message, history } = parsed.data;

  const documents = await prisma.policyDocument.findMany({
    where: { isActive: true },
    select: { storagePath: true },
  });

  if (documents.length === 0) {
    return NextResponse.json({
      reply: "No policy documents have been uploaded yet. Please contact HR directly.",
    });
  }

  const pdfBuffers = await Promise.all(
    documents.map((doc) => downloadPdf(doc.storagePath)),
  );

  const reply = await generateChatReply(message, history as Content[], pdfBuffers);

  return NextResponse.json({ reply });
}
