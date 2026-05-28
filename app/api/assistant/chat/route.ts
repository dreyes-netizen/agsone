import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";
import { generateChatReplyStream } from "@/lib/gemini/client";
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

const encoder = new TextEncoder();

function sseChunk(data: object) {
  return encoder.encode(`data: ${JSON.stringify(data)}\n\n`);
}

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
    select: { content: true },
  });

  const documentTexts = documents
    .map((doc) => doc.content)
    .filter((c): c is string => !!c);

  const stream = new ReadableStream({
    async start(controller) {
      try {
        if (documentTexts.length === 0) {
          controller.enqueue(sseChunk({ chunk: "No policy documents have been uploaded yet. Please contact HR directly." }));
        } else {
          for await (const chunk of generateChatReplyStream(message, history as Content[], documentTexts)) {
            controller.enqueue(sseChunk({ chunk }));
          }
        }
      } catch {
        controller.enqueue(sseChunk({ error: "Failed to generate response" }));
      } finally {
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
