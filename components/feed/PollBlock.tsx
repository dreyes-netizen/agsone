"use client";

import { Check } from "lucide-react";
import type { PollOption } from "@/lib/types/feed";

export function PollBlock({
  postId,
  options,
  myVoteOptionId,
  voting,
  onVote,
}: {
  postId: string;
  options: PollOption[];
  myVoteOptionId: string | null;
  voting: boolean;
  onVote: (postId: string, optionId: string) => void;
}) {
  const totalVotes = options.reduce((sum, o) => sum + o._count.votes, 0);
  return (
    <div className="mt-3 space-y-2">
      {options.map((opt) => {
        const pct = totalVotes > 0 ? Math.round((opt._count.votes / totalVotes) * 100) : 0;
        const voted = myVoteOptionId === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onVote(postId, opt.id)}
            disabled={voting}
            className={`w-full text-left relative overflow-hidden rounded-full border px-4 py-2 text-sm font-medium transition-all disabled:cursor-not-allowed ${
              voted
                ? "border-navy-500 text-navy-800"
                : "border-gray-200 text-gray-700 hover:border-navy-300"
            }`}
          >
            <div
              className="absolute inset-y-0 left-0 rounded-full transition-all duration-300"
              style={{
                width: `${pct}%`,
                background: voted ? "rgba(99,102,241,0.15)" : "rgba(99,102,241,0.07)",
              }}
            />
            <span className="relative flex items-center justify-between gap-2">
              <span className="flex-1 min-w-0 truncate">{opt.text}{voted && <span className="ml-1.5 text-navy-600 text-xs inline-flex items-center gap-0.5"><Check className="w-3 h-3" /> Voted</span>}</span>
              <span className="text-xs text-gray-500 font-normal shrink-0">{pct}% · {opt._count.votes}</span>
            </span>
          </button>
        );
      })}
      <p className="text-xs text-gray-500 pl-1">{totalVotes} {totalVotes === 1 ? "vote" : "votes"}</p>
    </div>
  );
}
