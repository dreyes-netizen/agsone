"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useApiClient } from "@/lib/hooks/useApiClient";
import { Medal } from "lucide-react";

type Entry = {
  rank: number;
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  department: string | null;
  points: number;
  level?: number;
  isCurrentUser: boolean;
};

type Department = { id: string; name: string };

const rankColors: Record<number, string> = {
  1: "text-yellow-500",
  2: "text-zinc-400",
  3: "text-orange-500",
};

const podiumOrder = [1, 0, 2];

const podiumStyle: Record<number, { bg: string; height: string; medal: React.ElementType; medalClass: string }> = {
  0: { bg: "bg-zinc-100 border border-zinc-200",        height: "pt-10", medal: Medal, medalClass: "text-zinc-400" },
  1: { bg: "bg-yellow-50 border border-yellow-200",     height: "pt-4",  medal: Medal, medalClass: "text-yellow-500" },
  2: { bg: "bg-orange-50 border border-orange-200",     height: "pt-14", medal: Medal, medalClass: "text-orange-500" },
};

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
    const params = new URLSearchParams({ period });
    if (departmentId !== "ALL") params.set("departmentId", departmentId);
    const res = await apiFetch<{ data: Entry[] }>(`/api/leaderboard?${params.toString()}`);
    setEntries(res.data);
    setLoading(false);
  }

  const currentUserEntry = entries.find((e) => e.isCurrentUser);

  return (
    <div className="space-y-5 max-w-2xl mx-auto">

      {/* ── Header ── */}
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Leaderboard</h1>
        <p className="text-zinc-500 text-sm mt-1">Top point earners in the company.</p>
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

      {/* ── Current user rank (if outside top 10) ── */}
      {currentUserEntry && currentUserEntry.rank > 10 && (
        <div className="bg-navy-50 border border-navy-200 rounded-xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-navy-600 font-bold text-sm">#{currentUserEntry.rank}</span>
            <Avatar name={currentUserEntry.displayName} url={currentUserEntry.avatarUrl} />
            <div>
              <p className="font-semibold text-sm text-zinc-900">You</p>
              {currentUserEntry.department && <p className="text-xs text-zinc-500">{currentUserEntry.department}</p>}
            </div>
          </div>
          <span className="font-bold text-navy-600 text-sm">{currentUserEntry.points.toLocaleString()} pts</span>
        </div>
      )}

      {/* ── Podium ── */}
      {!loading && entries.length >= 3 && (
        <div className="flex items-end justify-center gap-3 px-2">
          {podiumOrder.map((idx) => {
            const e = entries[idx];
            if (!e) return null;
            const style = podiumStyle[idx];
            const isFirst = idx === 1;
            return (
              <div
                key={e.userId}
                className={`flex-1 rounded-xl text-center ${style.bg} ${style.height} ${e.isCurrentUser ? "ring-2 ring-navy-400 ring-offset-1" : ""}`}
              >
                <div className={`flex flex-col items-center gap-1 px-2 pb-4 ${isFirst ? "pt-4" : "pt-3"}`}>
                  <style.medal className={`${isFirst ? "w-10 h-10" : "w-8 h-8"} ${style.medalClass}`} />
                  <Avatar name={e.displayName} url={e.avatarUrl} size={isFirst ? "lg" : "md"} />
                  <p className={`font-semibold text-zinc-800 mt-1 truncate w-full px-1 ${isFirst ? "text-sm" : "text-xs"}`}>
                    {e.isCurrentUser ? "You" : e.displayName}
                  </p>
                  <p className={`font-bold text-zinc-700 ${isFirst ? "text-sm" : "text-xs"}`}>
                    {e.points.toLocaleString()} pts
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

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
                <span className={`w-7 text-center font-bold text-sm tabular-nums ${rankColors[e.rank] ?? "text-zinc-400"}`}>
                  {`#${e.rank}`}
                </span>
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
