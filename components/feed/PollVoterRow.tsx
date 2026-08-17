"use client";

import { Avatar } from "@/components/feed/Avatar";
import type { VoterItem } from "@/lib/types/feed";

/**
 * One voter row inside the poll voters modal: avatar, name (links to the
 * same employee profile used elsewhere in the feed), department if known,
 * and which option they picked. Mirrors ReactionUserRow, with a text pill
 * for the chosen option in place of the emoji glyph.
 */
export function PollVoterRow({
  voter,
  onOpenProfile,
}: {
  voter: VoterItem;
  onOpenProfile: (userId: string) => void;
}) {
  const { user } = voter;
  return (
    <div className="flex items-center gap-3 py-2 px-1">
      <button type="button" onClick={() => onOpenProfile(user.id)} className="shrink-0 hover:opacity-80 transition-opacity">
        <Avatar name={user.displayName} url={user.avatarUrl} size="sm" />
      </button>
      <div className="min-w-0 flex-1">
        <button type="button" onClick={() => onOpenProfile(user.id)} className="font-semibold text-sm text-gray-900 hover:underline block truncate text-left">
          {user.displayName}
          {voter.isCurrentUser && <span className="ml-1.5 text-xs font-normal text-gray-400">(You)</span>}
        </button>
        {user.department && <p className="text-xs text-gray-500 truncate">{user.department}</p>}
      </div>
      <span
        className="max-w-[8rem] truncate text-xs font-medium px-2 py-1 rounded-full bg-gray-100 text-gray-600 shrink-0"
        title={voter.optionText}
      >
        {voter.optionText}
      </span>
    </div>
  );
}
