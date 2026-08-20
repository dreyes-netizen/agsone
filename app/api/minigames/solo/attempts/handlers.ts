import { NextResponse } from "next/server";
import { z } from "zod";
import type { FinishRankedAttemptResult, StartRankedAttemptResult } from "@/lib/minigames/solo/attempts";
import type { SoloGameType } from "@/lib/minigames/solo/types";

const startSchema = z.object({
  gameType: z.enum(["TYPING", "REACTION", "VISUAL_MEMORY", "SEQUENCE_MEMORY"]),
}).strict();

type RouteUser = { id: string; departmentId?: string | null };
type StartDependencies = {
  verifyAuth: (request: Request) => Promise<RouteUser | null>;
  checkRateLimit: (userId: string, scope: "arcade") => Promise<{ allowed: boolean; remaining: number }>;
  startRankedAttempt: (userId: string, gameType: z.infer<typeof startSchema>["gameType"], now: Date, departmentId: string | null) => Promise<StartRankedAttemptResult>;
  now: () => Date;
};

export function createStartHandler(dependencies: StartDependencies) {
  return async function POST(request: Request) {
    const user = await dependencies.verifyAuth(request);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const rateLimit = await dependencies.checkRateLimit(user.id, "arcade");
    if (!rateLimit.allowed) return NextResponse.json({ error: "Too many Arcade requests" }, { status: 429 });
    const parsed = startSchema.safeParse(await requestJson(request));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const result = await dependencies.startRankedAttempt(user.id, parsed.data.gameType, dependencies.now(), user.departmentId ?? null);
    if (result.kind === "limit") return NextResponse.json({ error: "Daily ranked attempt limit reached" }, { status: 429 });
    return NextResponse.json({ data: {
      attemptId: result.attemptId, gameType: result.gameType, attemptNumber: result.attemptNumber,
      attemptsRemaining: result.attemptsRemaining, expiresAt: result.expiresAt, challenge: result.challenge,
    } });
  };
}

const elapsedMs = z.number().int().nonnegative().max(15 * 60 * 1000);
const evidenceSchemas = {
  TYPING: z.object({ typedText: z.string().max(512), clientElapsedMs: elapsedMs }).strict(),
  REACTION: z.object({ reactionMs: z.array(z.number().finite().nonnegative().max(60_000)).length(5), falseStartTrials: z.array(z.number().int().min(0).max(4)).max(5), clientElapsedMs: elapsedMs }).strict(),
  VISUAL_MEMORY: z.object({ answers: z.array(z.object({ level: z.number().int().min(1).max(10), selectedIndexes: z.array(z.number().int().min(0).max(35)).max(36) }).strict()).min(1).max(10), claimedCompletedLevel: z.number().int().min(0).max(10), clientElapsedMs: elapsedMs }).strict(),
  SEQUENCE_MEMORY: z.object({ responses: z.array(z.object({ level: z.number().int().min(1).max(10), inputs: z.array(z.number().int().min(0).max(3)).max(10) }).strict()).min(1).max(10), claimedCompletedLevel: z.number().int().min(0).max(10), clientElapsedMs: elapsedMs }).strict(),
} satisfies Record<SoloGameType, z.ZodType>;

type AttemptInspection = { gameType: SoloGameType; status: "STARTED" | "COMPLETED" | "EXPIRED" } | null;
type FinishDependencies = {
  verifyAuth: (request: Request) => Promise<RouteUser | null>;
  checkRateLimit: (userId: string, scope: "arcade") => Promise<{ allowed: boolean; remaining: number }>;
  inspectAttempt: (userId: string, attemptId: string) => Promise<AttemptInspection>;
  finishRankedAttempt: (userId: string, attemptId: string, evidence: unknown, now: Date) => Promise<FinishRankedAttemptResult>;
  now: () => Date;
};
export type FinishContext = { params: Promise<{ id: string }> };

export function createFinishHandler(dependencies: FinishDependencies) {
  return async function POST(request: Request, context: FinishContext) {
    const user = await dependencies.verifyAuth(request);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const rateLimit = await dependencies.checkRateLimit(user.id, "arcade");
    if (!rateLimit.allowed) return NextResponse.json({ error: "Too many Arcade requests" }, { status: 429 });
    const { id: attemptId } = await context.params;
    const attempt = await dependencies.inspectAttempt(user.id, attemptId);
    if (!attempt) return NextResponse.json({ error: "Attempt not found" }, { status: 404 });
    let evidence: unknown = undefined;
    if (attempt.status === "STARTED") {
      const parsed = evidenceSchemas[attempt.gameType].safeParse(await requestJson(request));
      if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
      evidence = parsed.data;
    }
    const result = await dependencies.finishRankedAttempt(user.id, attemptId, evidence, dependencies.now());
    if (result.kind === "not_found") return NextResponse.json({ error: "Attempt not found" }, { status: 404 });
    if (result.kind === "expired") return NextResponse.json({ error: "Attempt expired" }, { status: 410 });
    return NextResponse.json({ data: { result: result.result, attemptsRemaining: result.attemptsRemaining, isPersonalBest: result.isPersonalBest } });
  };
}

async function requestJson(request: Request): Promise<unknown> {
  try { return await request.json(); } catch { return undefined; }
}
