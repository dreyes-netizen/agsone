"use client";

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { Inbox } from "lucide-react";

type ChartPoint = { date: string; Awarded: number; Redeemed: number };

// Below this many non-zero days, a 30-day line chart reads as "broken" rather
// than "quiet" — an empty state communicates the actual state better than a
// near-blank grid with a couple of stray points.
const MIN_ACTIVE_DAYS_FOR_CHART = 5;

/**
 * Extracted from app/admin/page.tsx so `recharts` (the largest chunk in the
 * build — ~349 KB) can be dynamic-imported instead of loading on every visit
 * to the admin overview, for a card that renders below the fold.
 */
export function PointsFlowChart({ data }: { data: ChartPoint[] }) {
  const activeDays = data.filter((d) => d.Awarded > 0 || d.Redeemed > 0).length;
  const hasEnoughActivity = activeDays >= MIN_ACTIVE_DAYS_FOR_CHART;

  return (
    <div className="lg:col-span-2 bg-white rounded-card border border-table-border p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="font-semibold text-gray-900 text-sm">Points Flow — Last 30 Days</p>
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1.5">
             <span className="w-3 h-0.5 bg-command-black inline-block rounded" />
            Awarded
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-gray-400 inline-block rounded" />
            Redeemed
          </span>
        </div>
      </div>
      {!hasEnoughActivity ? (
        <div className="h-40 flex flex-col items-center justify-center gap-1.5 text-gray-500 text-sm">
          <Inbox className="w-5 h-5" aria-hidden="true" />
          {data.length === 0 ? "No data yet" : "Not enough activity yet this period"}
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="awardedGrad" x1="0" y1="0" x2="0" y2="1">
                 <stop offset="5%" stopColor="var(--color-command-black)" stopOpacity={0.12} />
                 <stop offset="95%" stopColor="var(--color-command-black)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="redeemedGrad" x1="0" y1="0" x2="0" y2="1">
                 <stop offset="5%" stopColor="#9ca3af" stopOpacity={0.1} />
                 <stop offset="95%" stopColor="#9ca3af" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ border: "1px solid #e5e7eb", borderRadius: 12, fontSize: 12 }}
              formatter={(v, name) => [`${Number(v ?? 0).toLocaleString()} pts`, String(name)]}
            />
             <Area type="monotone" dataKey="Awarded" stroke="var(--color-command-black)" strokeWidth={2.5} fill="url(#awardedGrad)" />
            <Area type="monotone" dataKey="Redeemed" stroke="#9ca3af" strokeWidth={2} fill="url(#redeemedGrad)" strokeDasharray="4 2" />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
