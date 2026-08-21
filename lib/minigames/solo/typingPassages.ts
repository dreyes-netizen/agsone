export type TypingPassage = {
  id: string;
  text: string;
};

export const TYPING_PASSAGES: readonly TypingPassage[] = [
  {
    id: "solo-typing-001",
    text: "Calm fingers settle into a measured rhythm while the office wakes up around you. Each sentence asks for patience, not panic, because accuracy keeps every correction small and every restart unnecessary. When you let your shoulders drop and your eyes stay ahead of your hands, the keyboard stops feeling like a race and starts feeling like dependable equipment. By the end of the minute, clean habits have done more work than rushing ever could.",
  },
  {
    id: "solo-typing-002",
    text: "Every focused session rewards the typist who notices details before mistakes spread across the line. Smooth strokes build momentum, but the real gain comes from staying relaxed enough to correct a slip without losing the pace you already earned. A good run sounds almost quiet, with steady taps replacing frantic bursts and wasted backspaces. That kind of control turns ordinary practice into speed you can trust when pressure suddenly appears.",
  },
  {
    id: "solo-typing-003",
    text: "Morning drills teach your hands to cooperate with your attention instead of fighting it. One careful sentence becomes another, and soon the screen fills with proof that small corrections can prevent larger stumbles. When the pace rises, breathing evenly matters as much as striking the right keys, because tension makes simple words feel heavier than they are. Finish the passage with composure, and the next task will feel easier before it begins.",
  },
  {
    id: "solo-typing-004",
    text: "A steady pace leaves room for judgment, and judgment keeps hands from wasting effort on avoidable errors. The strongest runs are rarely dramatic; they come from reading ahead, trusting familiar patterns, and refusing to chase speed that your fingers cannot support yet. If one line goes wrong, recover and continue, because hesitation can cost more than a single typo. Over a minute, disciplined timing outlasts the scramble for instant numbers.",
  },
] as const;
