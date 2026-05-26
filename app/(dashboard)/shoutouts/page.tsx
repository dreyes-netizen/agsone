"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useApiClient } from "@/lib/hooks/useApiClient";
import { Sparkles, Search } from "lucide-react";
import { timeAgo } from "@/lib/helpers/timeAgo";

type Shoutout = {
  id: string;
  content: string;
  createdAt: string;
  author: { displayName: string; avatarUrl: string | null };
  recipient: { id: string; displayName: string; avatarUrl: string | null } | null;
};

function Avatar({ name, url }: { name: string; url: string | null }) {
  if (url) return <img src={url} alt={name} className="w-8 h-8 rounded-full object-cover" />;
  return (
    <div className="w-8 h-8 rounded-full bg-navy-100 flex items-center justify-center text-navy-600 font-bold text-xs">
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

export default function ShoutoutsPage() {
  const { user, loading: authLoading } = useAuth();
  const { apiFetch } = useApiClient();
  const [shoutouts, setShoutouts] = useState<Shoutout[]>([]);
  const [loading, setLoading] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (authLoading || !user) return;
    load(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user]);

  async function load(cursor: string | null) {
    const params = new URLSearchParams({ type: "SHOUTOUT" });
    if (cursor) params.set("cursor", cursor);
    const res = await apiFetch<{ data: Shoutout[]; nextCursor: string | null }>(`/api/feed?${params}`);
    if (cursor) {
      setShoutouts((prev) => [...prev, ...res.data]);
    } else {
      setShoutouts(res.data);
    }
    setNextCursor(res.nextCursor);
    setLoading(false);
    setLoadingMore(false);
  }

  const filtered = shoutouts.filter((s) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      s.author.displayName.toLowerCase().includes(q) ||
      (s.recipient?.displayName.toLowerCase().includes(q) ?? false) ||
      s.content.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Recognition Wall</h1>
          <p className="text-zinc-500 text-sm mt-1">Every shoutout, every colleague who went above and beyond.</p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input
            type="text"
            placeholder="Search by name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-4 py-2 text-sm border border-zinc-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-navy-500/20 focus:border-navy-400 transition w-52"
          />
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-zinc-200 p-4 animate-pulse">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-full bg-zinc-100" />
                <div className="h-3 bg-zinc-100 rounded w-24" />
              </div>
              <div className="h-3 bg-zinc-100 rounded w-full mb-2" />
              <div className="h-3 bg-zinc-100 rounded w-3/4" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 rounded-xl border border-zinc-200 bg-white text-center">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center mb-4">
            <Sparkles className="w-7 h-7 text-amber-400" />
          </div>
          <p className="text-zinc-900 font-semibold text-lg">
            {search ? "No matches found" : "No shoutouts yet"}
          </p>
          <p className="text-zinc-400 text-sm mt-1">
            {search ? "Try a different name or keyword." : "Head to the Feed to recognize a colleague!"}
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((s) => (
              <div key={s.id} className="bg-white rounded-xl border border-zinc-200 overflow-hidden hover:shadow-md transition-shadow">
                <div className="h-1 bg-gradient-to-r from-amber-400 to-yellow-300" />
                <div className="p-4 space-y-3">
                  <div className="flex items-center gap-1.5 flex-wrap text-sm">
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Avatar name={s.author.displayName} url={s.author.avatarUrl} />
                      <span className="font-semibold text-zinc-800">{s.author.displayName}</span>
                    </div>
                    <span className="text-amber-600 font-medium flex items-center gap-1 shrink-0">
                      <Sparkles className="w-3.5 h-3.5" /> shouted out
                    </span>
                    {s.recipient && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Avatar name={s.recipient.displayName} url={s.recipient.avatarUrl} />
                        <span className="font-semibold text-zinc-800">{s.recipient.displayName}</span>
                      </div>
                    )}
                  </div>
                  <p className="text-sm text-zinc-600 leading-relaxed line-clamp-3">{s.content}</p>
                  <p className="text-xs text-zinc-400">{timeAgo(s.createdAt)}</p>
                </div>
              </div>
            ))}
          </div>
          {nextCursor && !search && (
            <div className="flex justify-center">
              <button
                onClick={() => { setLoadingMore(true); load(nextCursor); }}
                disabled={loadingMore}
                className="px-6 py-2 text-sm font-medium bg-white border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-colors disabled:opacity-50"
              >
                {loadingMore ? "Loading…" : "Load more"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
