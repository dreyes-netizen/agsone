"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RecipientRow } from "@/components/feed/RecipientRow";

type Recipient = { id: string; user: { id: string; displayName: string; avatarUrl: string | null; department: { name: string } | null } };

/**
 * Full recipient list for a Shoutout/Recognition post with more people than
 * fit inline (see RecipientList's "+N others"). All recipient data already
 * ships with the post — no fetch, unlike ReactionDetailsDialog which pages
 * through a separate reactions endpoint.
 */
export function RecipientsDialog({
  open,
  onClose,
  recipients,
  onOpenProfile,
}: {
  open: boolean;
  onClose: () => void;
  recipients: Recipient[];
  onOpenProfile: (userId: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="max-w-sm p-0 gap-0 max-h-[80vh] flex flex-col">
        <DialogHeader className="p-4 pb-3 border-b border-gray-100">
          <DialogTitle>Recognized ({recipients.length})</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto p-3 space-y-0.5">
          {recipients.map((r) => (
            <RecipientRow key={r.user.id} user={r.user} onOpenProfile={onOpenProfile} />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
