"use client";

import { MessageCircle } from "lucide-react";
import { ReactionBar } from "@/components/feed/ReactionBar";

/**
 * The post footer: a reaction-emoji + count summary line (only rendered
 * when there's something real to show — no fake zeros), then a flat
 * full-width React/Comment row in place of the old floating pill pair.
 * All counts come straight from the existing reactions/commentCount data —
 * nothing here is synthesized.
 */
export function PostEngagement({
  postId,
  reactions,
  myReactions,
  commentCount,
  commentsOpen,
  onReact,
  onToggleComments,
}: {
  postId: string;
  reactions: Record<string, number>;
  myReactions: string[];
  commentCount: number;
  commentsOpen: boolean;
  onReact: (postId: string, emoji: string) => void;
  onToggleComments: () => void;
}) {
  const totalReactions = Object.values(reactions).reduce((a, b) => a + b, 0);
  const topEmojis = Object.entries(reactions)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([emoji]) => emoji);

  return (
    <div>
      {(totalReactions > 0 || commentCount > 0) && (
        <div className="flex items-center justify-between px-1 pb-2 text-xs text-gray-500">
          {totalReactions > 0 ? (
            <span className="flex items-center gap-1">
              <span className="text-sm leading-none" aria-hidden="true">{topEmojis.join("")}</span>
              {totalReactions}
            </span>
          ) : <span />}
          {commentCount > 0 && (
            <button type="button" onClick={onToggleComments} className="hover:underline">
              {commentCount} {commentCount === 1 ? "comment" : "comments"}
            </button>
          )}
        </div>
      )}
      <div className="flex items-center gap-1 border-t border-gray-100 pt-1">
        <ReactionBar postId={postId} myReactions={myReactions} onReact={onReact} />
        <button
          type="button"
          onClick={onToggleComments}
          aria-expanded={commentsOpen}
          className={`flex flex-1 items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition-colors ${
            commentsOpen ? "text-navy-600" : "text-gray-600 hover:bg-gray-50"
          }`}
        >
          <MessageCircle className="w-4 h-4" />
          Comment
        </button>
      </div>
    </div>
  );
}
