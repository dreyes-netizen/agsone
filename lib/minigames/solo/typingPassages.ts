export type TypingPassage = {
  id: string;
  text: string;
};

export const TYPING_PASSAGES: readonly TypingPassage[] = [
  {
    id: "solo-typing-001",
    text: "Calm fingers keep time as bright letters flow across the screen and each steady breath turns practice into a quiet daily win.",
  },
  {
    id: "solo-typing-002",
    text: "Every focused session builds durable speed, because clean strokes and patient rhythm outlast bursts of frantic typing.",
  },
  {
    id: "solo-typing-003",
    text: "Morning drills reward attention to detail, turning small corrections into smooth habits that stay useful under pressure.",
  },
  {
    id: "solo-typing-004",
    text: "A steady pace leaves room for accuracy, and accuracy is what keeps fast hands from wasting effort on avoidable mistakes.",
  },
] as const;
