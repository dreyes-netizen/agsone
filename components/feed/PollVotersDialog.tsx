"use client";

import { useState } from "react";
import { Loader2, AlertCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PollVoteFilterTabs } from "@/components/feed/PollVoteFilterTabs";
import { PollVoterRow } from "@/components/feed/PollVoterRow";
import { usePollVoters, ALL_TAB } from "@/lib/hooks/usePollVoters";
import type { PollOption } from "@/lib/types/feed";

/**
 * The "who voted" popup opened by tapping an option's vote count or the
 * total-votes line under a poll. Self-contained: owns its own Dialog wiring
 * and data fetching (usePollVoters) — the feed page only needs to say which
 * post/option is open and forward the current user's live vote so this stays
 * in sync if it changes from PollBlock while the modal is open. Mirrors
 * ReactionDetailsDialog. Never rendered for an anonymous poll — the caller
 * simply doesn't wire up the open action in that case, and the backing route
 * refuses the request server-side regardless.
 */
export function PollVotersDialog({
  postId,
  options,
  initialOptionId,
  onClose,
  myOptionId,
  currentUser,
  onOpenProfile,
}: {
  postId: string | null;
  options: PollOption[];
  /** Which tab to open on — a specific option id, or null for "All". */
  initialOptionId: string | null;
  onClose: () => void;
  /** The current user's active vote on this poll, right now (or null). */
  myOptionId: string | null;
  currentUser: { id: string; displayName: string; avatarUrl: string | null; department: string | null } | null;
  onOpenProfile: (userId: string) => void;
}) {
  const { counts, total, activeTab, selectTab, items, loading, loadingMore, hasMore, loadMore, error, syncCurrentUserVote } =
    usePollVoters(postId);

  const [trackedPostId, setTrackedPostId] = useState(postId);
  const [syncedOptionId, setSyncedOptionId] = useState(myOptionId);
  if (postId !== trackedPostId) {
    setTrackedPostId(postId);
    setSyncedOptionId(myOptionId);
    if (postId && activeTab !== (initialOptionId ?? ALL_TAB)) selectTab(initialOptionId ?? ALL_TAB);
  } else if (postId && currentUser && myOptionId !== syncedOptionId) {
    const optionText = options.find((o) => o.id === myOptionId)?.text ?? null;
    syncCurrentUserVote(syncedOptionId, myOptionId, optionText, currentUser);
    setSyncedOptionId(myOptionId);
  }

  return (
    <Dialog open={postId !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-md p-0 gap-0 max-h-[80vh] flex flex-col">
        <DialogHeader className="p-4 pb-3 border-b border-gray-100">
          <DialogTitle>Votes</DialogTitle>
        </DialogHeader>

        <div className="px-4 pt-3">
          <PollVoteFilterTabs options={options} counts={counts} total={total} active={activeTab} onSelect={selectTab} />
        </div>

        <div className="flex-1 overflow-y-auto px-3 pb-3 min-h-[120px]">
          {loading ? (
            <div className="flex items-center justify-center py-10 text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
              <span className="sr-only">Loading votes…</span>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-gray-500">
              <AlertCircle className="w-5 h-5 text-gray-400" aria-hidden="true" />
              {error}
            </div>
          ) : items.length === 0 ? (
            <p className="py-10 text-center text-sm text-gray-500">
              {activeTab === ALL_TAB ? "No votes yet." : "No one voted for this option."}
            </p>
          ) : (
            <>
              <div className="divide-y divide-gray-50">
                {items.map((voter) => (
                  <PollVoterRow key={voter.id} voter={voter} onOpenProfile={onOpenProfile} />
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
