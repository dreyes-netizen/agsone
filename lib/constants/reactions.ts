/**
 * Single source of truth for the feed's emoji reactions. Shared by the
 * reaction picker (ReactionBar), the API's zod validation, and the
 * reaction-details modal's filter tabs — was previously duplicated between
 * ReactionBar.tsx and the react route's z.enum literal list.
 */
export const REACTIONS = [
  { emoji: "👍", label: "Like" },
  { emoji: "❤️", label: "Love" },
  { emoji: "🔥", label: "Fire" },
  { emoji: "👏", label: "Clap" },
  { emoji: "🎉", label: "Celebrate" },
  { emoji: "💪", label: "Strong" },
] as const;

export type ReactionEmoji = (typeof REACTIONS)[number]["emoji"];

export const REACTION_EMOJIS = REACTIONS.map((r) => r.emoji) as [ReactionEmoji, ...ReactionEmoji[]];

export function reactionLabel(emoji: string): string {
  return REACTIONS.find((r) => r.emoji === emoji)?.label ?? "Reacted";
}
