import type { SoloGameType } from "@/lib/minigames/solo/types";
import type { SoloGameMode } from "./types";

export async function startSoloRun<TChallenge, TRankedStart>(
  mode: SoloGameMode,
  gameType: SoloGameType,
  createPracticeChallenge: (gameType: SoloGameType) => TChallenge,
  startRanked: (gameType: SoloGameType) => Promise<TRankedStart>,
): Promise<{ kind: "practice"; challenge: TChallenge } | { kind: "ranked"; data: TRankedStart }> {
  if (mode === "practice") return { kind: "practice", challenge: createPracticeChallenge(gameType) };
  return { kind: "ranked", data: await startRanked(gameType) };
}

export async function completeSoloRun<TChallenge, TEvidence, TPracticeResult, TRankedFinish>(
  mode: SoloGameMode,
  gameType: SoloGameType,
  challenge: TChallenge,
  evidence: TEvidence,
  scorePractice: (gameType: SoloGameType, challenge: TChallenge, evidence: TEvidence) => TPracticeResult,
  finishRanked: (gameType: SoloGameType, evidence: TEvidence) => Promise<TRankedFinish>,
): Promise<{ kind: "practice"; result: TPracticeResult } | { kind: "ranked"; data: TRankedFinish }> {
  if (mode === "practice") return { kind: "practice", result: scorePractice(gameType, challenge, evidence) };
  return { kind: "ranked", data: await finishRanked(gameType, evidence) };
}
