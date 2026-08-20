import { scoreReactionAttempt, type ReactionChallenge, type ReactionEvidence } from "@/lib/minigames/solo/reaction";
import { scoreSequenceMemoryAttempt, type SequenceMemoryEvidence } from "@/lib/minigames/solo/sequenceMemory";
import { scoreTypingAttempt, type TypingChallenge, type TypingEvidence } from "@/lib/minigames/solo/typing";
import type { SoloGameResult, SoloGameType } from "@/lib/minigames/solo/types";
import { scoreVisualMemoryAttempt, type VisualMemoryEvidence } from "@/lib/minigames/solo/visualMemory";
import type { MemoryChallenge } from "./types";

export type SoloGameEvidence = TypingEvidence | ReactionEvidence | VisualMemoryEvidence | SequenceMemoryEvidence;
export type FinishSubmissionState =
  | { status: "idle"; evidence: null; message?: undefined }
  | { status: "submitting"; evidence: SoloGameEvidence; message: null }
  | { status: "retryable"; evidence: SoloGameEvidence; message: string }
  | { status: "completed"; evidence: SoloGameEvidence; message: null };

export type FinishSubmissionAction =
  | { type: "submit"; evidence: SoloGameEvidence }
  | { type: "failed"; message: string }
  | { type: "retry" }
  | { type: "succeeded" }
  | { type: "reset" };

export function finishSubmissionReducer(state: FinishSubmissionState, action: FinishSubmissionAction): FinishSubmissionState {
  switch (action.type) {
    case "submit": return { status: "submitting", evidence: action.evidence, message: null };
    case "failed": return state.evidence ? { status: "retryable", evidence: state.evidence, message: action.message } : state;
    case "retry": return state.status === "retryable" ? { status: "submitting", evidence: state.evidence, message: null } : state;
    case "succeeded": return state.evidence ? { status: "completed", evidence: state.evidence, message: null } : state;
    case "reset": return { status: "idle", evidence: null };
  }
}

export function createPracticeResult(gameType: SoloGameType, challenge: TypingChallenge | ReactionChallenge | MemoryChallenge, evidence: SoloGameEvidence): SoloGameResult {
  switch (gameType) {
    case "TYPING": {
      const typedEvidence = evidence as TypingEvidence;
      const typingChallenge = challenge as TypingChallenge;
      return scoreTypingAttempt(typingChallenge, typedEvidence, Math.max(typingChallenge.durationMs, typedEvidence.clientElapsedMs));
    }
    case "REACTION": return scoreReactionAttempt(challenge as ReactionChallenge, evidence as ReactionEvidence);
    case "VISUAL_MEMORY": return scoreVisualMemoryAttempt((challenge as MemoryChallenge).seed, evidence as VisualMemoryEvidence);
    case "SEQUENCE_MEMORY": return scoreSequenceMemoryAttempt((challenge as MemoryChallenge).seed, evidence as SequenceMemoryEvidence);
  }
}
