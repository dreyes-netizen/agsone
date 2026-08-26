"use client";

/**
 * A leaderboard player name rendered as a real button, so it is focusable and
 * activates on Enter/Space like the click target it is. Shared by both minigame
 * boards so the affordance (and its focus ring) stays identical.
 */
export function PlayerNameButton({
  name,
  isCurrentUser,
  onClick,
  className = "",
}: {
  name: string;
  isCurrentUser: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`View ${isCurrentUser ? "your" : `${name}'s`} minigame record`}
      className={`block max-w-full truncate text-left font-medium text-gray-900 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-600 rounded ${className}`}
    >
      {isCurrentUser ? `${name} (You)` : name}
    </button>
  );
}
