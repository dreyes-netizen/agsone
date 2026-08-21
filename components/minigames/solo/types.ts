import type { ReactionChallenge, ReactionEvidence } from "@/lib/minigames/solo/reaction";
import type { TypingChallenge, TypingEvidence } from "@/lib/minigames/solo/typing";
import type { SequenceMemoryEvidence } from "@/lib/minigames/solo/sequenceMemory";
import type { VisualMemoryEvidence } from "@/lib/minigames/solo/visualMemory";

export type SoloGameMode = "practice" | "ranked";

export type SoloGameProps<TChallenge, TEvidence> = {
  mode: SoloGameMode;
  challenge: TChallenge;
  disabled?: boolean;
  onComplete: (evidence: TEvidence) => void;
};

export type MemoryChallenge = { seed: number };

export type TypingGameProps = SoloGameProps<TypingChallenge, TypingEvidence>;
export type ReactionGameProps = SoloGameProps<ReactionChallenge, ReactionEvidence>;
export type VisualMemoryGameProps = SoloGameProps<MemoryChallenge, VisualMemoryEvidence>;
export type SequenceMemoryGameProps = SoloGameProps<MemoryChallenge, SequenceMemoryEvidence>;
