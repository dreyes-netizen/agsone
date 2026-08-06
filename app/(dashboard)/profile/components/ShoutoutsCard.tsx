import { Megaphone } from "lucide-react";
import Link from "next/link";
import type { ShoutoutEntry } from "../types";

interface ShoutoutsCardProps {
  shoutouts: ShoutoutEntry[] | null;
}

export function ShoutoutsCard({ shoutouts }: ShoutoutsCardProps) {
  if (shoutouts === null) return null;

  return (
    <div className="bg-white rounded-card border border-table-border overflow-hidden">
      <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-800"><span aria-hidden="true">💬</span> Shoutouts</p>
        <Link href="/feed" className="text-xs text-navy-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-600 rounded">See all →</Link>
      </div>
      {shoutouts.length === 0 ? (
        <div className="flex flex-col items-center gap-1 py-3 px-4 text-center">
          <Megaphone className="w-4 h-4 text-gray-300" aria-hidden="true" />
          <p className="text-xs font-medium text-gray-600">No shoutouts yet</p>
          <p className="text-[10px] text-gray-400">Your colleagues will recognize you here</p>
        </div>
      ) : (
        <ul className="divide-y divide-gray-100">
          {shoutouts.map((s) => (
            <li key={s.id} className="flex gap-3 px-5 py-3">
              <div className="w-8 h-8 rounded-full bg-navy-500 flex items-center justify-center text-white font-bold text-xs shrink-0 overflow-hidden">
                {s.post.author.avatarUrl
                  ? <img src={s.post.author.avatarUrl} alt={s.post.author.displayName} className="w-full h-full object-cover" />
                  : s.post.author.displayName.charAt(0).toUpperCase()
                }
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-gray-800">{s.post.author.displayName}</p>
                <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed">{s.post.content}</p>
                <p className="text-xs text-gray-500 mt-0.5">{new Date(s.post.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
