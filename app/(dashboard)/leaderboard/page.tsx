"use client";

import { useEffect, useState } from "react";
import { Star, Loader2, Trophy, Medal } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useApiClient } from "@/lib/hooks/useApiClient";
import { timeAgo } from "@/lib/helpers/timeAgo";

type Entry = {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  department: string | null;
  points: number;
  level?: number;
  isCurrentUser: boolean;
};

type Department = { id: string; name: string };

type UserProfile = {
  pointsBalance: number;
  level: number;
  displayName: string;
  avatarUrl: string | null;
  department: { id: string; name: string } | null;
};

type Achiever = {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  label: string;
  achievedAt: string;
};

function Avatar({ name, url, size = "md" }: { name: string; url: string | null; size?: "sm" | "md" | "lg" }) {
  const cls = size === "lg" ? "w-16 h-16 text-2xl" : size === "sm" ? "w-9 h-9 text-xs" : "w-11 h-11 text-sm";
  if (url) return <img src={url} alt={name} className={`${cls} rounded-full object-cover shrink-0`} />;
  return (
    <div className={`${cls} rounded-full bg-gradient-to-br from-navy-600 to-navy-800 flex items-center justify-center text-white font-bold shrink-0`}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return (
    <div className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center shrink-0" aria-label="Rank 1">
      <Trophy className="w-3.5 h-3.5 text-amber-500" aria-hidden="true" />
    </div>
  );
  if (rank === 2) return (
    <div className="w-7 h-7 rounded-full bg-zinc-100 flex items-center justify-center shrink-0" aria-label="Rank 2">
      <Medal className="w-3.5 h-3.5 text-zinc-500" aria-hidden="true" />
    </div>
  );
  if (rank === 3) return (
    <div className="w-7 h-7 rounded-full bg-orange-50 flex items-center justify-center shrink-0" aria-label="Rank 3">
      <Medal className="w-3.5 h-3.5 text-orange-400" aria-hidden="true" />
    </div>
  );
  return (
    <span className="w-7 text-center text-xs font-semibold text-zinc-400 shrink-0" aria-label={`Rank ${rank}`}>
      {rank}
    </span>
  );
}

export default function LeaderboardPage() {
  const { user, loading: authLoading } = useAuth();
  const { apiFetch } = useApiClient();

  const [entries, setEntries] = useState<Entry[]>([]);
  const [period, setPeriod] = useState<"monthly" | "alltime">("monthly");
  const [loading, setLoading] = useState(true);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [departmentId, setDepartmentId] = useState<string | "ALL">("ALL");
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [achievers, setAchievers] = useState<Achiever[]>([]);
  const [achieversLoading, setAchieversLoading] = useState(true);

  useEffect(() => {
    if (authLoading || !user) return;
    apiFetch<{ data: Department[] }>("/api/departments")
      .then((res) => setDepartments(res.data))
      .catch(() => {});
    setProfileLoading(true);
    setAchieversLoading(true);
    Promise.allSettled([
      apiFetch<{ data: UserProfile }>("/api/me"),
      apiFetch<{ data: Achiever[] }>("/api/leaderboard/achievers"),
    ]).then(([me, ach]) => {
      if (me.status === "fulfilled") setProfile(me.value.data);
      if (ach.status === "fulfilled") setAchievers(ach.value.data ?? []);
    }).finally(() => {
      setProfileLoading(false);
      setAchieversLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user]);

  useEffect(() => {
    if (authLoading || !user) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user, period, departmentId]);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ period });
      if (departmentId !== "ALL") params.set("departmentId", departmentId);
      const res = await apiFetch<{ data: Entry[] }>(`/api/leaderboard?${params.toString()}`);
      setEntries(res.data);
    } finally {
      setLoading(false);
    }
  }

  const totalPoints = entries.reduce((sum, e) => sum + e.points, 0);
  const avgPoints = entries.length > 0 ? Math.round(totalPoints / entries.length) : 0;
  const myRank = entries.findIndex((e) => e.isCurrentUser) + 1;

  const topDepts = (() => {
    const map = new Map<string, number>();
    for (const e of entries) {
      const key = e.department ?? "Unknown";
      map.set(key, (map.get(key) ?? 0) + e.points);
    }
    const sorted = Array.from(map.entries())
      .sort((a, b) => {
        if (a[0] === "Unknown") return 1;
        if (b[0] === "Unknown") return -1;
        return b[1] - a[1];
      })
      .slice(0, 5);
    const max = sorted[0]?.[1] ?? 1;
    return sorted.map(([name, points]) => ({ name, points, pct: Math.round((points / max) * 100) }));
  })();

  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Top Performers</h1>
        <p className="text-zinc-500 text-sm mt-1">{period === "monthly" ? "This month's" : "All-time"} highest earners.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">

        {/* ════ Left column ════ */}
        <div className="space-y-4">

          {/* Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            {departments.length > 0 && (
              <select
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
                aria-label="Filter by department"
                className="text-sm border border-zinc-200 rounded-lg px-3 py-1.5 text-zinc-700 bg-white focus:outline-none focus:ring-2 focus:ring-navy-500/30 focus:border-navy-400 transition max-w-[180px] min-w-0"
              >
                <option value="ALL">All Departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            )}
            <div role="tablist" aria-label="Leaderboard period" className="flex rounded-lg border border-zinc-200 overflow-hidden bg-white text-sm">
              <button
                role="tab"
                aria-selected={period === "monthly"}
                onClick={() => setPeriod("monthly")}
                className={`px-4 py-1.5 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-navy-500 ${
                  period === "monthly" ? "bg-[#111827] text-white" : "text-zinc-600 hover:bg-zinc-50"
                }`}
              >
                This Month
              </button>
              <button
                role="tab"
                aria-selected={period === "alltime"}
                onClick={() => setPeriod("alltime")}
                className={`px-4 py-1.5 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-navy-500 ${
                  period === "alltime" ? "bg-[#111827] text-white" : "text-zinc-600 hover:bg-zinc-50"
                }`}
              >
                All Time
              </button>
            </div>
          </div>

          {/* Rankings list */}
          <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
            {loading ? (
              <div role="status" aria-label="Loading leaderboard" className="flex items-center justify-center gap-2 py-12 text-zinc-400">
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                <span className="text-sm">Loading…</span>
              </div>
            ) : entries.length === 0 ? (
              <div className="text-center py-12 text-zinc-400 text-sm">No data yet. Start earning points!</div>
            ) : (
              <ul aria-label="Leaderboard rankings" className="divide-y divide-zinc-100">
                {entries.map((e, i) => {
                  const rank = i + 1;
                  return (
                    <li
                      key={e.userId}
                      className={`flex items-center gap-3 px-5 py-3 transition-colors motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-300 ${
                        e.isCurrentUser ? "bg-navy-50" : "hover:bg-zinc-50"
                      }`}
                      style={{ animationDelay: `${Math.min(i * 25, 400)}ms` }}
                      aria-current={e.isCurrentUser ? "true" : undefined}
                    >
                      <RankBadge rank={rank} />
                      <Avatar name={e.displayName} url={e.avatarUrl} />
                      <div className="flex-1 min-w-0">
                        <p className={`font-medium text-sm truncate ${e.isCurrentUser ? "text-navy-800 font-semibold" : "text-zinc-900"}`}>
                          {e.isCurrentUser ? `${e.displayName} (You)` : e.displayName}
                        </p>
                        {e.department && <p className="text-xs text-zinc-400 truncate">{e.department}</p>}
                      </div>
                      <span className={`font-bold text-sm tabular-nums shrink-0 ${rank === 1 ? "text-amber-600" : rank <= 3 ? "text-zinc-700" : "text-navy-600"}`}>
                        {e.points.toLocaleString()} pts
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {/* ════ Right column ════ */}
        <div className="space-y-4 sticky top-6 self-start">

          {/* Card 1: Your Stats */}
          <div className="bg-white rounded-xl border border-zinc-100 p-4">
            <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">Your Stats</p>
            {profileLoading ? (
              <div className="space-y-3 motion-safe:animate-pulse">
                <div className="h-8 bg-zinc-100 rounded w-1/2" />
                <div className="h-3 bg-zinc-100 rounded w-1/3" />
                <div className="h-3 bg-zinc-100 rounded w-1/4" />
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <p className="text-3xl font-black text-zinc-900 tabular-nums leading-none">
                    {profile?.pointsBalance?.toLocaleString() ?? "—"}
                  </p>
                  <p className="text-xs text-zinc-400 mt-1">points balance</p>
                </div>
                <div className="flex items-center gap-4 pt-1 border-t border-zinc-50">
                  <div className="flex items-center gap-1.5">
                    <Star className="w-3.5 h-3.5 text-violet-500 shrink-0" aria-hidden="true" />
                    <span className="text-sm font-bold text-violet-600">Lv {profile?.level ?? 1}</span>
                  </div>
                  {myRank > 0 && !loading && (
                    <div className="flex items-center gap-1.5">
                      <Trophy className="w-3.5 h-3.5 text-amber-500 shrink-0" aria-hidden="true" />
                      <span className="text-sm font-bold text-zinc-700">#{myRank}</span>
                    </div>
                  )}
                </div>
                {profile?.department && (
                  <p className="text-xs text-zinc-400 truncate">{profile.department.name}</p>
                )}
              </div>
            )}
          </div>

          {/* Card 2: Period Summary */}
          {!loading && entries.length > 0 && (
            <div className="bg-white rounded-xl border border-zinc-100 p-4">
              <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">Period Summary</p>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-500">Participants</span>
                  <span className="font-semibold text-zinc-900">{entries.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-500">Total points</span>
                  <span className="font-semibold text-zinc-900">{totalPoints.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-500">Avg per person</span>
                  <span className="font-semibold text-zinc-900">{avgPoints.toLocaleString()}</span>
                </div>
              </div>
            </div>
          )}

          {/* Card 3: Top Departments */}
          {!loading && topDepts.length > 0 && (
            <div className="bg-white rounded-xl border border-zinc-100 p-4">
              <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">Top Departments</p>
              <div className="space-y-3">
                {topDepts.map(({ name, points, pct }) => (
                  <div key={name}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-zinc-700 font-medium truncate mr-2">{name}</span>
                      <span className="text-zinc-500 tabular-nums shrink-0">{points.toLocaleString()}</span>
                    </div>
                    <div className="w-full bg-zinc-100 rounded-full h-1.5 overflow-hidden">
                      <div
                        role="progressbar"
                        aria-label={`${name} department points`}
                        aria-valuenow={pct}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        className="bg-navy-500 h-1.5 rounded-full transition-all motion-safe:duration-700"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Card 4: Recent Achievers */}
          <div className="bg-white rounded-xl border border-zinc-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-50">
              <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Recent Achievers</p>
            </div>
            {achieversLoading ? (
              <div className="p-4 space-y-3 motion-safe:animate-pulse">
                {[1, 2, 3].map((i) => <div key={i} className="h-8 bg-zinc-100 rounded" />)}
              </div>
            ) : achievers.length === 0 ? (
              <p className="text-xs text-zinc-400 text-center py-6">No recent achievements</p>
            ) : (
              <div className="divide-y divide-zinc-50">
                {achievers.map((a, i) => (
                  <div key={`${a.userId}-${i}`} className="flex items-center gap-2.5 px-4 py-2.5 hover:bg-zinc-50/60 transition-colors">
                    <Avatar name={a.displayName} url={a.avatarUrl} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-zinc-800 truncate">{a.displayName}</p>
                      <p className="text-[10px] text-zinc-500 truncate">{a.label}</p>
                    </div>
                    <span className="text-[10px] text-zinc-400 shrink-0">{timeAgo(a.achievedAt)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
