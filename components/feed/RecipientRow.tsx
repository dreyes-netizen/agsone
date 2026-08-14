"use client";

import { Avatar } from "@/components/feed/Avatar";

/**
 * A recognized/shouted-out employee, presented as a person — avatar, name,
 * department — not a removable tag/filter chip. Used inside both the casual
 * Shoutout and formal Recognition post variants (see PostBody.tsx) so a
 * recipient always reads the same way regardless of how many others are
 * being recognized alongside them.
 */
export function RecipientRow({
  user,
  onOpenProfile,
  size = "sm",
}: {
  user: { id: string; displayName: string; avatarUrl: string | null; department: { name: string } | null };
  onOpenProfile: (userId: string) => void;
  size?: "sm" | "md";
}) {
  return (
    <button
      type="button"
      onClick={() => onOpenProfile(user.id)}
      className="flex items-center gap-2.5 min-w-0 text-left rounded-lg -mx-1.5 px-1.5 py-1 hover:bg-gray-50 transition-colors"
    >
      <Avatar name={user.displayName} url={user.avatarUrl} size={size} />
      <span className="min-w-0">
        <span className="block font-semibold text-sm text-gray-900 truncate hover:underline">{user.displayName}</span>
        {user.department && <span className="block text-xs text-gray-500 truncate">{user.department.name}</span>}
      </span>
    </button>
  );
}
