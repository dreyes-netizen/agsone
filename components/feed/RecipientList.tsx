"use client";

import { useState } from "react";
import { Avatar } from "@/components/feed/Avatar";
import { RecipientRow } from "@/components/feed/RecipientRow";
import { RecipientsDialog } from "@/components/feed/RecipientsDialog";

type Recipient = { id: string; user: { id: string; displayName: string; avatarUrl: string | null; department: { name: string } | null } };

const INLINE_LIMIT = 3;

/**
 * Recipient area for Shoutout/Recognition posts. Scales by count instead of
 * always rendering the same layout: 1-3 people stay fully visible as
 * lightweight identity rows (grid on desktop, stacked on mobile so nothing
 * clips); beyond that, a compact overlapping-avatar strip + "+N others" opens
 * the full list in a dialog rather than growing the post indefinitely.
 */
export function RecipientList({
  recipients,
  onOpenProfile,
  rowSize = "sm",
}: {
  recipients: Recipient[];
  onOpenProfile: (userId: string) => void;
  rowSize?: "sm" | "md";
}) {
  const [dialogOpen, setDialogOpen] = useState(false);

  if (recipients.length === 0) return null;

  if (recipients.length === 1) {
    return <RecipientRow user={recipients[0].user} onOpenProfile={onOpenProfile} size={rowSize} />;
  }

  if (recipients.length <= INLINE_LIMIT) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
        {recipients.map((r) => (
          <RecipientRow key={r.user.id} user={r.user} onOpenProfile={onOpenProfile} size={rowSize} />
        ))}
      </div>
    );
  }

  const shown = recipients.slice(0, INLINE_LIMIT);
  const remaining = recipients.length - shown.length;
  const names = shown.map((r) => r.user.displayName.split(" ")[0]).join(", ");

  return (
    <>
      <button
        type="button"
        onClick={() => setDialogOpen(true)}
        className="flex items-center gap-2.5 -mx-1.5 px-1.5 py-1 rounded-lg hover:bg-gray-50 transition-colors text-left"
        aria-label={`View all ${recipients.length} recognized employees`}
      >
        <span className="flex -space-x-2 shrink-0">
          {shown.map((r) => (
            <span key={r.user.id} className="ring-2 ring-white rounded-full">
              <Avatar name={r.user.displayName} url={r.user.avatarUrl} size="sm" />
            </span>
          ))}
        </span>
        <span className="text-sm text-gray-700 truncate">
          <span className="font-semibold text-gray-900">{names}</span>{" "}
          <span className="text-gray-500">+{remaining} other{remaining === 1 ? "" : "s"}</span>
        </span>
      </button>
      <RecipientsDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        recipients={recipients}
        onOpenProfile={onOpenProfile}
      />
    </>
  );
}
