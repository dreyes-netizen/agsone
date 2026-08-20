"use client";

import { useState } from "react";
import { Loader2, AlertCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ReactionFilterTabs } from "@/components/feed/ReactionFilterTabs";
import { ReactionUserRow } from "@/components/feed/ReactionUserRow";
import { useReactionDetails, ALL_TAB, type ReactionTarget } from "@/lib/hooks/useReactionDetails";

/**
 * The "who reacted, and how" popup opened by tapping a reaction summary line
 * — shared by posts and comments. `target` identifies which reactions
 * endpoint to hit (see useReactionDetails). Self-contained: owns its own
 * Dialog wiring and data fetching — the feed page only needs to pass which
 * target is open and forward the current user's live reaction so this stays
 * in sync if it changes from the ReactionBar button while the modal is open.
 */
export function ReactionDetailsDialog({
  target,
  onClose,
  myEmoji,
  currentUser,
  onOpenProfile,
}: {
  target: ReactionTarget;
  /** The current user's active reaction on this target, right now (or null). */
  myEmoji: string | null;
  onClose: () => void;
  currentUser: { id: string; displayName: string; avatarUrl: string | null; department: string | null } | null;
  onOpenProfile: (userId: string) => void;
}) {
  const { counts, total, activeTab, selectTab, items, loading, loadingMore, hasMore, loadMore, error, syncCurrentUserReaction } =
    useReactionDetails(target);

  // Keep an already-open modal in sync when the user changes their reaction
  // via the main ReactionBar button (outside the modal). Done during render
  // (React's "adjusting state when a prop changes" pattern) rather than in
  // an effect: when `target` itself changes we just re-baseline against the
  // newly-opened target without patching anything (its cache was just reset
  // by useReactionDetails); only a same-target reaction change triggers a
  // patch.
  const [trackedKey, setTrackedKey] = useState(target?.key ?? null);
  const [syncedEmoji, setSyncedEmoji] = useState(myEmoji);
  if ((target?.key ?? null) !== trackedKey) {
    setTrackedKey(target?.key ?? null);
    setSyncedEmoji(myEmoji);
  } else if (target && currentUser && myEmoji !== syncedEmoji) {
    syncCurrentUserReaction(syncedEmoji, myEmoji, currentUser);
    setSyncedEmoji(myEmoji);
  }

  return (
    <Dialog open={target !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-md p-0 gap-0 max-h-[80vh] flex flex-col">
        <DialogHeader className="p-4 pb-3 border-b border-gray-100">
          <DialogTitle>Reactions</DialogTitle>
        </DialogHeader>

        <div className="px-4 pt-3">
          <ReactionFilterTabs counts={counts} total={total} active={activeTab} onSelect={selectTab} />
        </div>

        <div className="flex-1 overflow-y-auto px-3 pb-3 min-h-[120px]">
          {loading ? (
            <div className="flex items-center justify-center py-10 text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
              <span className="sr-only">Loading reactions…</span>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-gray-500">
              <AlertCircle className="w-5 h-5 text-gray-400" aria-hidden="true" />
              {error}
            </div>
          ) : items.length === 0 ? (
            <p className="py-10 text-center text-sm text-gray-500">
              {activeTab === ALL_TAB ? "No reactions yet." : "No one reacted this way."}
            </p>
          ) : (
            <>
              <div className="divide-y divide-gray-50">
                {items.map((reactor) => (
                  <ReactionUserRow key={reactor.id} reactor={reactor} onOpenProfile={onOpenProfile} />
                ))}
              </div>
              {hasMore && (
                <div className="flex justify-center pt-2">
                  <button
                    type="button"
                    onClick={loadMore}
                    disabled={loadingMore}
                    className="text-xs font-semibold text-navy-600 hover:underline disabled:opacity-50 py-2"
                  >
                    {loadingMore ? "Loading…" : "Load more"}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
