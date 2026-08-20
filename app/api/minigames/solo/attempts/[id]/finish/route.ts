import { type NextRequest } from "next/server";
import { verifyAuth } from "@/lib/auth/verifyAuth";
import { checkRateLimit } from "@/lib/guardrails/rateLimiter";
import { finishRankedAttempt, inspectRankedAttempt } from "@/lib/minigames/solo/attempts";
import { createFinishHandler, type FinishContext } from "../../handlers";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const handler = createFinishHandler({
  verifyAuth: (request) => verifyAuth(request as NextRequest),
  checkRateLimit,
  inspectAttempt: inspectRankedAttempt,
  finishRankedAttempt,
  now: () => new Date(),
});

export async function POST(request: NextRequest, context: FinishContext) {
  return handler(request, context);
}
