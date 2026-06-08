"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useApiClient } from "@/lib/hooks/useApiClient";

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

function Avatar({ name, url, size = "md" }: { name: string; url: string | null; size?: "sm" | "md" | "lg" }) {
  const cls = size === "lg" ? "w-16 h-16 text-2xl" : size === "sm" ? "w-9 h-9 text-xs" : "w-11 h-11 text-sm";
  if (url) return <img src={url} alt={name} className={`${cls} rounded-full object-cover`} />;
  return (
    <div className={`${cls} rounded-full bg-navy-100 flex items-center justify-center text-navy-600 font-bold`}>
      {name.charAt(0).toUpperCase()}
    </div>
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

  useEffect(() => {
    if (authLoading || !user) return;
    apiFetch<{ data: Department[] }>("/api/departments").then((res) => setDepartments(res.data));
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

  return (
    <div className="space-y-5 max-w-2xl mx-auto">

      {/* ── Header ── */}
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Top Performers</h1>
        <p className="text-zinc-500 text-sm mt-1">{period === "monthly" ? "This month's" : "All-time"} highest earners.</p>
      </div>

      {/* ── Filters ── */}
      <div className="flex items-center gap-2 flex-wrap">
        {departments.length > 0 && (
          <select
            value={departmentId}
            onChange={(e) => setDepartmentId(e.target.value)}
            className="text-sm border border-zinc-200 rounded-lg px-3 py-1.5 text-zinc-700 bg-white focus:outline-none focus:ring-2 focus:ring-navy-500/30 focus:border-navy-400 transition"
          >
            <option value="ALL">All Departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        )}
        <div className="flex rounded-lg border border-zinc-200 overflow-hidden bg-white text-sm">
          <button
            className={`px-4 py-1.5 font-medium transition-colors ${period === "monthly" ? "bg-[#111827] text-white" : "text-zinc-600 hover:bg-zinc-50"}`}
            onClick={() => setPeriod("monthly")}
          >
            This Month
          </button>
          <button
            className={`px-4 py-1.5 font-medium transition-colors ${period === "alltime" ? "bg-[#111827] text-white" : "text-zinc-600 hover:bg-zinc-50"}`}
            onClick={() => setPeriod("alltime")}
          >
            All Time
          </button>
        </div>
      </div>

      {/* ── Rankings list ── */}
      <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
        {loading ? (
          <div className="text-center py-12 text-zinc-400 text-sm">Loading...</div>
        ) : entries.length === 0 ? (
          <div className="text-center py-12 text-zinc-400 text-sm">No data yet. Start earning points!</div>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {entries.map((e) => (
              <li
                key={e.userId}
                className={`flex items-center gap-3 px-5 py-3 transition-colors ${
                  e.isCurrentUser
                    ? "bg-navy-50 border-l-2 border-navy-500"
                    : "hover:bg-zinc-50 border-l-2 border-transparent"
                }`}
              >
                <Avatar name={e.displayName} url={e.avatarUrl} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-zinc-900 truncate">
                    {e.isCurrentUser ? `${e.displayName} (You)` : e.displayName}
                  </p>
                  {e.department && <p className="text-xs text-zinc-400 truncate">{e.department}</p>}
                </div>
                <span className="font-bold text-navy-600 text-sm tabular-nums">
                  {e.points.toLocaleString()} pts
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
