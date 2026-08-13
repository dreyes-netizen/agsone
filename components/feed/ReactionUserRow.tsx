"use client";

import { Avatar } from "@/components/feed/Avatar";
import { reactionLabel } from "@/lib/constants/reactions";
import type { ReactorItem } from "@/lib/types/feed";

/**
 * One reactor row inside the reaction-details modal: avatar, name (links to
 * the same employee profile used elsewhere in the feed), department if
 * known, and which reaction they picked. The emoji carries an accessible
 * label (via reactionLabel) rather than relying on the glyph alone.
 */
export function ReactionUserRow({
  reactor,
  onOpenProfile,
}: {
  reactor: ReactorItem;
  onOpenProfile: (userId: string) => void;
}) {
  const { user } = reactor;
  return (
    <div className="flex items-center gap-3 py-2 px-1">
      <button type="button" onClick={() => onOpenProfile(user.id)} className="shrink-0 hover:opacity-80 transition-opacity">
        <Avatar name={user.displayName} url={user.avatarUrl} size="sm" />
      </button>
      <div className="min-w-0 flex-1">
        <button type="button" onClick={() => onOpenProfile(user.id)} className="font-semibold text-sm text-gray-900 hover:underline block truncate text-left">
          {user.displayName}
          {reactor.isCurrentUser && <span className="ml-1.5 text-xs font-normal text-gray-400">(You)</span>}
        </button>
        {user.department && <p className="text-xs text-gray-500 truncate">{user.department}</p>}
      </div>
      <span
        className="text-lg leading-none shrink-0"
        role="img"
        aria-label={reactionLabel(reactor.emoji)}
        title={reactionLabel(reactor.emoji)}
      >
        {reactor.emoji}
      </span>
    </div>
  );
}
