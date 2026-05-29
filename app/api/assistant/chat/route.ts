import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verifyAuth";
import { generateChatReplyStream } from "@/lib/groq/client";
import { searchRelevantChunks } from "@/lib/rag/search";
import { isJailbreakAttempt } from "@/lib/guardrails/jailbreak";
import { checkRateLimit } from "@/lib/guardrails/rateLimiter";
import { z } from "zod";

const MAX_HISTORY_TURNS = 10;
const STREAM_TIMEOUT_MS = 30_000;

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
    return NextResponse.json({ error: JSON.stringify(parsed.error.flatten()) }, { status: 400 });
  }

  const { message, history: rawHistory } = parsed.data;
  const history = rawHistory.slice(-MAX_HISTORY_TURNS) as typeof rawHistory;

  if (isJailbreakAttempt(message)) {
    return NextResponse.json(
      { error: "I'm only here to help with company HR policies. Please ask a policy-related question." },
      { status: 400 },
    );
  }

  const { allowed } = checkRateLimit(user.id);
  if (!allowed) {
    return NextResponse.json(
      { error: "You've reached the message limit (20/hour). Please try again later." },
      { status: 429 },
    );
  }

  let context = "";
  try {
    const relevantChunks = await searchRelevantChunks(message);
    context = relevantChunks.join("\n\n---\n\n");
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Internal server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const stream = new ReadableStream({
    async start(controller) {
      const timeoutId = setTimeout(() => {
        controller.enqueue(sseChunk({ error: "Response timed out. Please try again." }));
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      }, STREAM_TIMEOUT_MS);

      try {
        for await (const chunk of generateChatReplyStream(message, history as Parameters<typeof generateChatReplyStream>[1], context)) {
          controller.enqueue(sseChunk({ chunk }));
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Failed to generate response";
        controller.enqueue(sseChunk({ error: msg }));
      } finally {
        clearTimeout(timeoutId);
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
