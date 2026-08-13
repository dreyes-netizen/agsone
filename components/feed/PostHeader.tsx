"use client";

import { Pin } from "lucide-react";
import { Avatar } from "@/components/feed/Avatar";
import { PostOverflowMenu } from "@/components/feed/PostOverflowMenu";
import { postTimestamp } from "@/lib/helpers/timeAgo";

/**
 * Author-first post header: avatar + name carry the strongest weight,
 * department/timestamp/pinned-status are a single muted secondary line,
 * and pin/edit/delete live behind one overflow menu instead of sitting
 * permanently next to the timestamp.
 */
export function PostHeader({
  authorId,
  authorName,
  authorAvatarUrl,
  avatarSize = "sm",
  department,
  createdAt,
  isPinned,
  canPin,
  canEdit,
  canDelete,
  onAuthorClick,
  onPin,
  onEdit,
  onDelete,
  editLabel,
  deleteLabel,
}: {
  authorId: string;
  authorName: string;
  authorAvatarUrl: string | null;
  avatarSize?: "sm" | "md";
  department?: string | null;
  createdAt: string;
  isPinned: boolean;
  canPin: boolean;
  canEdit: boolean;
  canDelete: boolean;
  onAuthorClick: (authorId: string) => void;
  onPin: () => void;
  onEdit: () => void;
  onDelete: () => void;
  editLabel?: string;
  deleteLabel?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <button
        type="button"
        onClick={() => onAuthorClick(authorId)}
        className="shrink-0 hover:opacity-80 transition-opacity"
        aria-label={`View ${authorName}'s profile`}
      >
        <Avatar name={authorName} url={authorAvatarUrl} size={avatarSize} />
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <button
            type="button"
            onClick={() => onAuthorClick(authorId)}
            className="font-semibold text-sm text-gray-900 hover:underline transition-colors truncate text-left"
          >
            {authorName}
          </button>
          <PostOverflowMenu
            isPinned={isPinned}
            canPin={canPin}
            canEdit={canEdit}
            canDelete={canDelete}
            onPin={onPin}
            onEdit={onEdit}
            onDelete={onDelete}
            editLabel={editLabel}
            deleteLabel={deleteLabel}
          />
        </div>
        <div className="flex items-center gap-1 mt-0.5 text-xs text-gray-500">
          {department && <span className="truncate">{department}</span>}
          {department && <span aria-hidden="true">·</span>}
          <span className="whitespace-nowrap">{postTimestamp(createdAt)}</span>
          {isPinned && (
            <>
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-0.5 text-amber-600 font-medium whitespace-nowrap">
                <Pin className="w-3 h-3" aria-hidden="true" /> Pinned
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
