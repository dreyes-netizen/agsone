import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verifyAuth";
import { generateChatReplyStream } from "@/lib/groq/client";
import { searchRelevantChunks } from "@/lib/rag/search";
import { isJailbreakAttempt } from "@/lib/guardrails/jailbreak";
import { checkRateLimit } from "@/lib/guardrails/rateLimiter";
import { getAllyEnabled } from "@/lib/settings/appSettings";
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

  // getAllyEnabled() (an AppSetting DB read) and checkRateLimit() (an Upstash
  // Redis read) are independent of each other and of body parsing below —
  // kick both off now instead of one-at-a-time, but keep applying their
  // results in the same priority order the original sequential code did
  // (ally-disabled > jailbreak > rate-limited).
  const [allyEnabled, rateLimit] = await Promise.all([
    getAllyEnabled(),
    checkRateLimit(user.id),
  ]);

  // Respect the global on/off switch — disabling Ally must stop the AI, not
  // just hide the widget (a user could still hit this endpoint directly).
  if (!allyEnabled) {
    return NextResponse.json(
      { error: "Ally is currently unavailable." },
      { status: 403 },
    );
  }

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

  if (!rateLimit.allowed) {
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
      // `closed` is the single source of truth for whether this controller
      // may still be touched. The timeout and the normal completion path
      // race against the same controller with no other synchronization —
      // once either side ends the stream, every other enqueue/close call
      // (loop, catch, finally) must become a no-op instead of throwing on
      // an already-closed controller.
      let closed = false;
      const abortController = new AbortController();

      const timeoutId = setTimeout(() => {
        if (closed) return;
        closed = true;
        abortController.abort();
        controller.enqueue(sseChunk({ error: "Response timed out. Please try again." }));
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      }, STREAM_TIMEOUT_MS);

      try {
        for await (const chunk of generateChatReplyStream(
          message,
          history as Parameters<typeof generateChatReplyStream>[1],
          context,
          abortController.signal,
        )) {
          if (closed) break;
          controller.enqueue(sseChunk({ chunk }));
        }
      } catch (e) {
        // An abort triggered by the timeout above surfaces here as a thrown
        // error too — the timeout path already sent the user-facing message
        // and closed the stream, so don't send a second, contradictory one.
        if (!closed) {
          const msg = e instanceof Error ? e.message : "Failed to generate response";
          controller.enqueue(sseChunk({ error: msg }));
        }
      } finally {
        clearTimeout(timeoutId);
        if (!closed) {
          closed = true;
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        }
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
