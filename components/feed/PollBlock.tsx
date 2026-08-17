"use client";

import { Check } from "lucide-react";
import type { PollOption } from "@/lib/types/feed";

export function PollBlock({
  postId,
  options,
  myVoteOptionId,
  voting,
  isAnonymous,
  onVote,
  onOpenVoters,
}: {
  postId: string;
  options: PollOption[];
  myVoteOptionId: string | null;
  voting: boolean;
  isAnonymous: boolean;
  onVote: (postId: string, optionId: string) => void;
  /** optionId = a specific option's voter list; null = the "All" overview. Never called for an anonymous poll. */
  onOpenVoters: (optionId: string | null) => void;
}) {
  const totalVotes = options.reduce((sum, o) => sum + o._count.votes, 0);

  return (
    <div className="mt-3 space-y-1.5">
      {options.map((opt) => {
        const pct = totalVotes > 0 ? Math.round((opt._count.votes / totalVotes) * 100) : 0;
        const voted = myVoteOptionId === opt.id;
        return (
          // A native <button> can't contain another interactive control (the
          // per-option vote-count button below), so the "cast a vote" tap
          // target is a div with button semantics instead — the only way to
          // nest a real <button> inside it without invalid/auto-corrected HTML.
          <div
            key={opt.id}
            role="button"
            tabIndex={voting ? -1 : 0}
            aria-disabled={voting}
            onClick={() => { if (!voting) onVote(postId, opt.id); }}
            onKeyDown={(e) => { if (!voting && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onVote(postId, opt.id); } }}
            className={`relative w-full text-left rounded-lg border px-3 py-2.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-navy-400 ${
              voting ? "cursor-not-allowed opacity-70" : "cursor-pointer"
            } ${voted ? "border-navy-200 bg-navy-50/40" : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"}`}
          >
            {voted && <span className="absolute inset-y-0 left-0 w-0.5 rounded-l-lg bg-navy-500" aria-hidden="true" />}

            <div className="flex items-start gap-1.5">
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-gray-900 leading-snug line-clamp-2">{opt.text}</span>
                {voted && (
                  <span className="mt-0.5 inline-flex items-center gap-0.5 text-[11px] font-semibold text-navy-600">
                    <Check className="w-3 h-3" aria-hidden="true" /> Your vote
                  </span>
                )}
              </span>
            </div>

            <div className="mt-2 h-1.5 rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-navy-400 transition-all duration-300"
                style={{ width: `${pct}%` }}
              />
            </div>

            <div className="mt-1 flex items-center justify-between text-xs text-gray-500">
              <span>{pct}%</span>
              {isAnonymous ? (
                <span>{opt._count.votes} {opt._count.votes === 1 ? "vote" : "votes"}</span>
              ) : (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onOpenVoters(opt.id); }}
                  className="font-medium hover:underline hover:text-navy-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-navy-400 rounded-sm"
                  aria-label={`${opt._count.votes} ${opt._count.votes === 1 ? "vote" : "votes"} for ${opt.text} — view who voted`}
                >
                  {opt._count.votes} {opt._count.votes === 1 ? "vote" : "votes"}
                </button>
              )}
            </div>
          </div>
        );
      })}

      <div className="pt-0.5 pl-1">
        {totalVotes === 0 ? (
          <p className="text-xs text-gray-400 italic">No votes yet — be the first to vote</p>
        ) : isAnonymous ? (
          <p className="text-xs text-gray-500">{totalVotes} {totalVotes === 1 ? "vote" : "votes"}</p>
        ) : (
          <button
            type="button"
            onClick={() => onOpenVoters(null)}
            className="text-xs text-gray-500 font-medium hover:underline hover:text-navy-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-navy-400 rounded-sm"
          >
            {totalVotes} {totalVotes === 1 ? "vote" : "votes"}
          </button>
        )}
      </div>
    </div>
  );
}
