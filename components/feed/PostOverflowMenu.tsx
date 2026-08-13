"use client";

import { MoreHorizontal, Pin, PinOff, Pencil, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Single `⋯` overflow trigger for a post's management actions (pin/edit/delete).
 * Renders nothing at all if the current user can't do any of them — permission
 * gating happens once in the caller (see computePostPermissions in useFeedActions
 * consumers), this component just reflects what it's told.
 */
export function PostOverflowMenu({
  isPinned,
  canPin,
  canEdit,
  canDelete,
  onPin,
  onEdit,
  onDelete,
  editLabel = "Edit post",
  deleteLabel = "Delete post",
}: {
  isPinned: boolean;
  canPin: boolean;
  canEdit: boolean;
  canDelete: boolean;
  onPin: () => void;
  onEdit: () => void;
  onDelete: () => void;
  editLabel?: string;
  deleteLabel?: string;
}) {
  if (!canPin && !canEdit && !canDelete) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="shrink-0 p-1.5 -m-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-500/30"
        aria-label="Post actions"
      >
        <MoreHorizontal className="w-4 h-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {canPin && (
          <DropdownMenuItem onClick={onPin}>
            {isPinned ? <PinOff /> : <Pin />}
            {isPinned ? "Unpin post" : "Pin post"}
          </DropdownMenuItem>
        )}
        {canPin && (canEdit || canDelete) && <DropdownMenuSeparator />}
        {canEdit && (
          <DropdownMenuItem onClick={onEdit}>
            <Pencil /> {editLabel}
          </DropdownMenuItem>
        )}
        {canDelete && (
          <DropdownMenuItem variant="destructive" onClick={onDelete}>
            <Trash2 /> {deleteLabel}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
