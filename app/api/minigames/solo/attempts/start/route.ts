import { type NextRequest } from "next/server";
import { verifyAuth } from "@/lib/auth/verifyAuth";
import { checkRateLimit } from "@/lib/guardrails/rateLimiter";
import { startRankedAttempt } from "@/lib/minigames/solo/attempts";
import { createStartHandler } from "../handlers";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const handler = createStartHandler({
  verifyAuth: (request) => verifyAuth(request as NextRequest),
  checkRateLimit,
  startRankedAttempt,
  now: () => new Date(),
});

export async function POST(request: NextRequest) {
  return handler(request);
}
