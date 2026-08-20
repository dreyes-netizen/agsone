"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useApiClient } from "@/lib/hooks/useApiClient";
import { useConfetti } from "@/lib/hooks/useConfetti";
import { createReactionChallenge, type ReactionChallenge, type ReactionEvidence } from "@/lib/minigames/solo/reaction";
import { SOLO_GAME_REGISTRY } from "@/lib/minigames/solo/registry";
import { createTypingChallenge, type TypingChallenge, type TypingEvidence } from "@/lib/minigames/solo/typing";
import type { SequenceMemoryEvidence } from "@/lib/minigames/solo/sequenceMemory";
import type { SoloGameResult, SoloGameType } from "@/lib/minigames/solo/types";
import type { VisualMemoryEvidence } from "@/lib/minigames/solo/visualMemory";
import { SoloResultPanel } from "./SoloResultPanel";
import { createFinishSubmitter, createPracticeResult, finishSubmissionReducer, type SoloGameEvidence } from "./soloGameRun";
import { completeSoloRun, startSoloRun } from "./soloGameOrchestration";
import type { MemoryChallenge, SoloGameMode } from "./types";

const TypingGame = dynamic(() => import("./TypingGame").then((module) => module.TypingGame), { ssr: false, loading: () => <GameLoader /> });
const ReactionGame = dynamic(() => import("./ReactionGame").then((module) => module.ReactionGame), { ssr: false, loading: () => <GameLoader /> });
const VisualMemoryGame = dynamic(() => import("./VisualMemoryGame").then((module) => module.VisualMemoryGame), { ssr: false, loading: () => <GameLoader /> });
const SequenceMemoryGame = dynamic(() => import("./SequenceMemoryGame").then((module) => module.SequenceMemoryGame), { ssr: false, loading: () => <GameLoader /> });

type StartResponse = { data: { attemptId: string; attemptsRemaining: number; challenge: Record<string, unknown> } };
type FinishResponse = { data: { result: SoloGameResult; attemptsRemaining: number; isPersonalBest: boolean } };
type SummaryResponse = { data: { attemptsRemaining: number } };
type ActiveChallenge = TypingChallenge | ReactionChallenge | MemoryChallenge;

export function SoloGameShell({ gameType }: { gameType: SoloGameType }) {
  const game = SOLO_GAME_REGISTRY[gameType];
  const router = useRouter();
  const { apiFetch } = useApiClient();
  const { fire } = useConfetti();
  const [mode, setMode] = useState<SoloGameMode>("practice");
  const [challenge, setChallenge] = useState<ActiveChallenge | null>(null);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SoloGameResult | null>(null);
  const [isPersonalBest, setIsPersonalBest] = useState(false);
  const [gameInstance, setGameInstance] = useState(0);
  const [finishState, dispatchFinish] = useReducer(finishSubmissionReducer, { status: "idle", evidence: null });
  const finishSubmitterRef = useRef<((evidence: SoloGameEvidence) => Promise<FinishResponse>) | null>(null);

  const loadSummary = useCallback(async () => {
    try {
      const response = await apiFetch<SummaryResponse>(`/api/minigames/solo/summary?gameType=${gameType}`);
      setAttemptsRemaining(response.data.attemptsRemaining);
    } catch {
      setAttemptsRemaining(null);
    }
  }, [apiFetch, gameType]);

  // Practice is entirely local: do not read attempt state until Ranked is selected.
  useEffect(() => {
    if (mode === "ranked" && !challenge) queueMicrotask(() => void loadSummary());
  }, [challenge, loadSummary, mode]);
  useEffect(() => {
    if (!isPersonalBest || !result?.isValid || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    fire();
  }, [fire, isPersonalBest, result?.isValid]);

  const attemptLabel = useMemo(() => attemptsRemaining === null ? "Ranked attempts loading…" : `${attemptsRemaining} attempt${attemptsRemaining === 1 ? "" : "s"} remaining today`, [attemptsRemaining]);

  async function begin() {
    setError(null);
    setResult(null);
    setIsPersonalBest(false);
    dispatchFinish({ type: "reset" });
    setBusy(true);
    try {
      const started = await startSoloRun(
        mode,
        gameType,
        createLocalChallenge,
        (rankedGameType) => apiFetch<StartResponse>("/api/minigames/solo/attempts/start", { method: "POST", body: JSON.stringify({ gameType: rankedGameType }) }),
      );
      if (started.kind === "practice") {
        setAttemptId(null);
        finishSubmitterRef.current = null;
        setChallenge(started.challenge);
        setGameInstance((instance) => instance + 1);
        return;
      }
      const response = started.data;
      setAttemptId(response.data.attemptId);
      finishSubmitterRef.current = createFinishSubmitter((evidence) => apiFetch<FinishResponse>(`/api/minigames/solo/attempts/${response.data.attemptId}/finish`, { method: "POST", body: JSON.stringify(evidence) }));
      setAttemptsRemaining(response.data.attemptsRemaining);
      setChallenge(asChallenge(gameType, response.data.challenge));
      setGameInstance((instance) => instance + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Couldn’t start this ranked attempt.");
    } finally {
      setBusy(false);
    }
  }

  async function submitRankedFinish(evidence: SoloGameEvidence) {
    const submit = finishSubmitterRef.current;
    if (!attemptId || !submit || busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await submit(evidence);
      setResult(response.data.result);
      setAttemptsRemaining(response.data.attemptsRemaining);
      setIsPersonalBest(response.data.isPersonalBest);
      dispatchFinish({ type: "succeeded" });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Couldn’t submit this attempt.";
      setError(message);
      dispatchFinish({ type: "failed", message });
    } finally {
      setBusy(false);
    }
  }

  function complete(evidence: TypingEvidence | ReactionEvidence | VisualMemoryEvidence | SequenceMemoryEvidence) {
    if (busy || !challenge || finishState.status === "submitting") return;
    if (mode === "practice") {
      void completePracticeRun(challenge, evidence);
      return;
    }
    dispatchFinish({ type: "submit", evidence });
    void submitRankedFinish(evidence);
  }

  async function completePracticeRun(challenge: ActiveChallenge, evidence: SoloGameEvidence) {
    const completed = await completeSoloRun(
      "practice",
      gameType,
      challenge,
      evidence,
      (practiceGameType, practiceChallenge, practiceEvidence) => createPracticeResult(practiceGameType, practiceChallenge, practiceEvidence),
      async () => {
        throw new Error("Practice runs must not finish through the ranked API");
      },
    );
    if (completed.kind === "practice") setResult(completed.result);
  }

  function retryFinish() {
    if (finishState.status !== "retryable") return;
    dispatchFinish({ type: "retry" });
    void submitRankedFinish(finishState.evidence);
  }

  function reset() {
    setChallenge(null);
    setAttemptId(null);
    finishSubmitterRef.current = null;
    setResult(null);
    setError(null);
    setIsPersonalBest(false);
    dispatchFinish({ type: "reset" });
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => router.push("/minigames")} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-900">
          <ArrowLeft className="w-4 h-4" aria-hidden="true" /> Minigames
        </button>
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-gray-900">{game.label}</h1>
          <p className="text-xs text-gray-500">No points or credits are awarded for Solo Arcade.</p>
        </div>
      </div>

      {!challenge && !result && (
        <section className="bg-white border border-table-border rounded-card p-5 space-y-4">
          <div role="group" aria-label="Game mode" className="grid grid-cols-2 gap-2">
            {(["practice", "ranked"] as const).map((nextMode) => (
              <button key={nextMode} aria-pressed={mode === nextMode} onClick={() => setMode(nextMode)} className={`rounded-lg border px-3 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-navy-600 ${mode === nextMode ? "border-navy-600 bg-navy-50 text-navy-900" : "border-gray-200 text-gray-700 hover:bg-gray-50"}`}>
                <span className="block text-sm font-bold capitalize">{nextMode}</span>
                <span className="block text-xs mt-1 text-gray-500">{nextMode === "practice" ? game.practiceCopy : game.rankedCopy}</span>
              </button>
            ))}
          </div>
          {mode === "ranked" && <p aria-live="polite" className="text-sm font-semibold text-navy-800">{attemptLabel}</p>}
          <button onClick={() => void begin()} disabled={busy || (mode === "ranked" && attemptsRemaining === 0)} className="w-full py-2.5 rounded-xl bg-command-black text-white text-sm font-bold hover:bg-gray-800 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-900">
            {busy ? "Starting…" : mode === "ranked" ? "Start ranked attempt" : "Start practice"}
          </button>
        </section>
      )}

      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
      {finishState.status === "retryable" && <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 space-y-2"><p>Your game is complete, but the official result was not received. Retry safely with the same evidence.</p><button onClick={retryFinish} className="px-3 py-1.5 rounded-lg bg-amber-700 text-white font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-amber-700">Retry finish</button></div>}
      {result && <SoloResultPanel game={game} mode={mode} result={result} isPersonalBest={isPersonalBest} onPlayAgain={reset} />}
      {challenge && !result && <SoloGameRenderer gameType={gameType} mode={mode} challenge={challenge} disabled={busy || finishState.status === "submitting"} onComplete={complete} gameInstance={gameInstance} />}
    </div>
  );
}

type SoloGameRendererProps = {
  gameType: SoloGameType;
  mode: SoloGameMode;
  challenge: ActiveChallenge;
  disabled: boolean;
  onComplete: (evidence: TypingEvidence | ReactionEvidence | VisualMemoryEvidence | SequenceMemoryEvidence) => void;
  gameInstance: number;
};

function SoloGameRenderer({ gameType, mode, challenge, disabled, onComplete, gameInstance }: SoloGameRendererProps) {
  switch (gameType) {
    case "TYPING": return <TypingGame key={gameInstance} mode={mode} challenge={challenge as TypingChallenge} disabled={disabled} onComplete={onComplete} />;
    case "REACTION": return <ReactionGame key={gameInstance} mode={mode} challenge={challenge as ReactionChallenge} disabled={disabled} onComplete={onComplete} />;
    case "VISUAL_MEMORY": return <VisualMemoryGame key={gameInstance} mode={mode} challenge={challenge as MemoryChallenge} disabled={disabled} onComplete={onComplete} />;
    case "SEQUENCE_MEMORY": return <SequenceMemoryGame key={gameInstance} mode={mode} challenge={challenge as MemoryChallenge} disabled={disabled} onComplete={onComplete} />;
  }
}

function createLocalChallenge(gameType: SoloGameType): ActiveChallenge {
  const seed = Math.floor(Math.random() * 2 ** 32);
  if (gameType === "TYPING") return createTypingChallenge(seed);
  if (gameType === "REACTION") return createReactionChallenge(seed);
  return { seed };
}

function asChallenge(gameType: SoloGameType, value: Record<string, unknown>): ActiveChallenge {
  if (gameType === "TYPING") return { passageId: String(value.passageId), passageText: String(value.text), durationMs: Number(value.durationMs) };
  if (gameType === "REACTION") return { waitDurationsMs: value.waitDurationsMs as ReactionChallenge["waitDurationsMs"] };
  return { seed: Number(value.seed) };
}

function GameLoader() {
  return <div role="status" className="bg-white border border-table-border rounded-card min-h-48 flex items-center justify-center gap-2 text-sm text-gray-500"><Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Loading game…</div>;
}
