"use client";

import { useEffect, useState } from "react";
import { useApiClient } from "@/lib/hooks/useApiClient";
import { Users, TrendingUp, ShoppingCart, Gamepad2, ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type Analytics = {
  totalEmployees: number;
  pointsThisMonth: number;
  monthGrowth: number | null;
  pendingRedemptions: number;
  activeGames: number;
  topEarners: { id: string; displayName: string; pointsBalance: number; level: number; avatarUrl: string | null }[];
  recentTransactions: {
    id: string;
    amount: number;
    type: string;
    note: string | null;
    createdAt: string;
    toUser: { displayName: string };
    fromUser: { displayName: string } | null;
  }[];
  dailyPoints: { date: string; points: number }[];
};

const typeLabel: Record<string, string> = {
  MANUAL_AWARD: "Award",
  GAME_WIN: "Game Win",
  ATTENDANCE: "Streak Bonus",
};

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  iconColor,
  growth,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  iconColor: string;
  growth?: number | null;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-start justify-between">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${iconColor}`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        {growth != null && (
          <span className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${
            growth > 0 ? "bg-emerald-50 text-emerald-600" : growth < 0 ? "bg-red-50 text-red-500" : "bg-gray-50 text-gray-400"
          }`}>
            {growth > 0 ? <ArrowUpRight className="w-3 h-3" /> : growth < 0 ? <ArrowDownRight className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
            {Math.abs(growth)}%
          </span>
        )}
      </div>
      <p className="text-2xl font-black text-gray-900 mt-3 tabular-nums">{value}</p>
      <p className="text-sm font-medium text-gray-500 mt-0.5">{label}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

export default function AdminDashboardPage() {
  const { apiFetch } = useApiClient();
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<{ data: Analytics }>("/api/admin/analytics")
      .then((r) => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 bg-gray-100 rounded w-1/3" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-28 bg-gray-100 rounded-2xl" />)}
        </div>
        <div className="h-64 bg-gray-100 rounded-2xl" />
      </div>
    );
  }

  if (!data) return <p className="text-gray-500">Failed to load analytics.</p>;

  const chartData = data.dailyPoints.map((d) => ({
    date: new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    points: d.points,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Overview</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Total Employees"
          value={data.totalEmployees.toLocaleString()}
          icon={Users}
          iconColor="bg-navy-500"
        />
        <KpiCard
          label="Points Awarded"
          value={data.pointsThisMonth.toLocaleString()}
          sub="This month"
          icon={TrendingUp}
          iconColor="bg-emerald-500"
          growth={data.monthGrowth}
        />
        <KpiCard
          label="Pending Redemptions"
          value={data.pendingRedemptions}
          sub={data.pendingRedemptions > 0 ? "Needs approval" : "All cleared"}
          icon={ShoppingCart}
          iconColor={data.pendingRedemptions > 0 ? "bg-amber-500" : "bg-gray-400"}
        />
        <KpiCard
          label="Active Games"
          value={data.activeGames}
          icon={Gamepad2}
          iconColor="bg-violet-500"
        />
      </div>

      {/* Chart + Top Earners side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Area chart */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="font-semibold text-gray-900 text-sm mb-4">Points Awarded — Last 30 Days</p>
          {chartData.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-gray-400 text-sm">No data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="ptGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ border: "1px solid #e5e7eb", borderRadius: 12, fontSize: 12 }}
                  formatter={(v) => [`${Number(v).toLocaleString()} pts`, "Awarded"]}
                />
                <Area type="monotone" dataKey="points" stroke="#4f46e5" strokeWidth={2} fill="url(#ptGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Top Earners */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="font-semibold text-gray-900 text-sm mb-4">Top Earners</p>
          <div className="space-y-3">
            {data.topEarners.map((e, i) => (
              <div key={e.id} className="flex items-center gap-3">
                <span className="w-5 text-xs font-bold text-gray-400 tabular-nums">{i + 1}</span>
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-navy-400 to-violet-500 flex items-center justify-center text-white text-xs font-bold shrink-0 overflow-hidden">
                  {e.avatarUrl ? <img src={e.avatarUrl} alt={e.displayName} className="w-full h-full object-cover" /> : e.displayName.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{e.displayName}</p>
                  <p className="text-xs text-gray-400">Lv {e.level}</p>
                </div>
                <span className="text-sm font-bold text-navy-600 tabular-nums">{e.pointsBalance.toLocaleString()}</span>
              </div>
            ))}
            {data.topEarners.length === 0 && <p className="text-sm text-gray-400">No employees yet</p>}
          </div>
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-50">
          <p className="font-semibold text-gray-900 text-sm">Recent Awards</p>
        </div>
        {data.recentTransactions.length === 0 ? (
          <div className="py-10 text-center text-sm text-gray-400">No transactions yet</div>
        ) : (
          <ul className="divide-y divide-gray-50">
            {data.recentTransactions.map((t) => (
              <li key={t.id} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50/60 transition-colors">
                <div>
                  <p className="text-sm font-medium text-gray-900">{t.toUser.displayName}</p>
                  <p className="text-xs text-gray-400">
                    {typeLabel[t.type] ?? t.type}
                    {t.fromUser ? ` · from ${t.fromUser.displayName}` : ""}
                    {t.note ? ` · "${t.note}"` : ""}
                  </p>
                </div>
                <div className="text-right shrink-0 ml-4">
                  <p className="text-sm font-bold text-emerald-600">+{t.amount.toLocaleString()} pts</p>
                  <p className="text-xs text-gray-400">{new Date(t.createdAt).toLocaleDateString()}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
