"use client";

import { useEffect, useState } from "react";
import { useApiClient } from "@/lib/hooks/useApiClient";
import {
  Users, TrendingUp, ShoppingCart,
  ArrowUpRight, ArrowDownRight, Minus, Cake, Activity, AlertCircle,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

type UpcomingBirthday = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  department: string | null;
  birthday: string;
  daysUntil: number;
};

type DisengagedEmployee = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  pointsBalance: number;
  department: { name: string } | null;
};

type DeptRow = {
  id: string;
  name: string;
  totalEmployees: number;
  activeEmployees: number;
  pointsThisMonth: number;
};

type Analytics = {
  totalEmployees: number;
  pointsThisMonth: number;
  monthGrowth: number | null;
  pendingRedemptions: number;
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
  engagementRate: number;
  engagedCount: number;
  disengaged: DisengagedEmployee[];
  departmentBreakdown: DeptRow[];
};

const typeLabel: Record<string, string> = {
  MANUAL_AWARD: "Award",
  GAME_WIN: "Game Win",
};

function KpiCard({
  label, value, sub, icon: Icon, iconColor, growth, valueColor,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  iconColor: string;
  growth?: number | null;
  valueColor?: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <div className="flex items-start justify-between">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${iconColor}`}>
          <Icon aria-hidden="true" className="w-4 h-4 text-white" />
        </div>
        {growth != null && (
          <span className={`flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
            growth > 0 ? "bg-emerald-50 text-emerald-600" : growth < 0 ? "bg-red-50 text-red-500" : "bg-gray-50 text-gray-500"
          }`}>
            {growth > 0 ? <ArrowUpRight aria-hidden="true" className="w-3 h-3" /> : growth < 0 ? <ArrowDownRight aria-hidden="true" className="w-3 h-3" /> : <Minus aria-hidden="true" className="w-3 h-3" />}
            {Math.abs(growth)}%
          </span>
        )}
      </div>
      <p className={`text-xl font-black mt-2 tabular-nums ${valueColor ?? "text-gray-900"}`}>{value}</p>
      <p className="text-sm font-medium text-gray-500 mt-0.5">{label}</p>
      {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
    </div>
  );
}

function EngagementRing({ rate }: { rate: number }) {
  const r = 28;
  const circ = 2 * Math.PI * r;
  const dash = (rate / 100) * circ;
  const color = rate >= 70 ? "#10b981" : rate >= 40 ? "#f59e0b" : "#ef4444";
  return (
    <svg width="72" height="72" viewBox="0 0 72 72">
      <circle cx="36" cy="36" r={r} fill="none" stroke="#f3f4f6" strokeWidth="7" />
      <circle
        cx="36" cy="36" r={r} fill="none"
        stroke={color} strokeWidth="7"
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        transform="rotate(-90 36 36)"
      />
      {/* Rate percentage is shown in adjacent text — ring is the visual indicator only */}
    </svg>
  );
}

export default function AdminDashboardPage() {
  const { apiFetch } = useApiClient();
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [birthdays, setBirthdays] = useState<UpcomingBirthday[]>([]);

  useEffect(() => {
    apiFetch<{ data: Analytics }>("/api/admin/analytics")
      .then((r) => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
    apiFetch<{ data: UpcomingBirthday[] }>("/api/birthdays/upcoming")
      .then((r) => setBirthdays(r.data))
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div role="status" aria-label="Loading dashboard" className="space-y-5 animate-pulse">
        <div className="h-8 bg-gray-100 rounded w-1/3" />
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <div key={i} className="h-24 bg-gray-100 rounded-2xl" />)}
        </div>
        <div className="h-56 bg-gray-100 rounded-2xl" />
      </div>
    );
  }

  if (!data) return <p className="text-gray-500">Failed to load analytics.</p>;

  const chartData = data.dailyPoints.map((d) => ({
    date: new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    points: d.points,
  }));

  const engagementColor =
    data.engagementRate >= 70 ? "text-emerald-600" : data.engagementRate >= 40 ? "text-amber-600" : "text-red-500";

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Overview</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <KpiCard
          label="Total Employees"
          value={data.totalEmployees.toLocaleString()}
          icon={Users}
          iconColor="bg-navy-500"
          valueColor="text-navy-600"
        />
        <KpiCard
          label="Points Awarded"
          value={data.pointsThisMonth.toLocaleString()}
          sub="This month"
          icon={TrendingUp}
          iconColor="bg-emerald-500"
          growth={data.monthGrowth}
          valueColor="text-emerald-600"
        />
        <KpiCard
          label="Pending Redemptions"
          value={data.pendingRedemptions}
          sub={data.pendingRedemptions > 0 ? "Needs approval" : "All cleared"}
          icon={ShoppingCart}
          iconColor={data.pendingRedemptions > 0 ? "bg-amber-500" : "bg-gray-400"}
          valueColor={data.pendingRedemptions > 0 ? "text-amber-600" : "text-gray-700"}
        />
      </div>

      {/* Chart + Top Earners */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="font-semibold text-gray-900 text-sm mb-3">Points Awarded — Last 30 Days</p>
          {chartData.length === 0 ? (
            <div className="h-40 flex items-center justify-center text-gray-500 text-sm">No data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="ptGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#111827" stopOpacity={0.12} />
                    <stop offset="95%" stopColor="#111827" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ border: "1px solid #e5e7eb", borderRadius: 12, fontSize: 12 }}
                  formatter={(v) => [`${Number(v).toLocaleString()} pts`, "Awarded"]}
                />
                <Area type="monotone" dataKey="points" stroke="#111827" strokeWidth={2.5} fill="url(#ptGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="font-semibold text-gray-900 text-sm mb-3">Top Earners</p>
          <div className="space-y-2">
            {data.topEarners.map((e, i) => (
              <div key={e.id} className="flex items-center gap-3">
                <span className={`w-5 text-xs font-bold tabular-nums ${i === 0 ? "text-amber-500" : i === 1 ? "text-gray-400" : i === 2 ? "text-orange-400" : "text-gray-400"}`}>{i + 1}</span>
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-navy-600 to-navy-800 flex items-center justify-center text-white text-xs font-bold shrink-0 overflow-hidden">
                  {e.avatarUrl ? <img src={e.avatarUrl} alt={e.displayName} className="w-full h-full object-cover" /> : e.displayName.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{e.displayName}</p>
                  <p className="text-xs text-gray-500">Lv {e.level}</p>
                </div>
                <span className="text-sm font-bold text-navy-600 tabular-nums">{e.pointsBalance.toLocaleString()}</span>
              </div>
            ))}
            {data.topEarners.length === 0 && <p className="text-sm text-gray-500">No employees yet</p>}
          </div>
        </div>
      </div>

      {/* Engagement + Department Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Engagement card */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Activity aria-hidden="true" className="w-4 h-4 text-gray-500" />
            <p className="font-semibold text-gray-900 text-sm">Engagement</p>
            <span className="text-xs text-gray-500 ml-auto">Last 30 days</span>
          </div>
          <div className="flex items-center gap-5">
            <EngagementRing rate={data.engagementRate} />
            <div>
              <p className={`text-2xl font-black tabular-nums ${engagementColor}`}>
                {data.engagementRate}%
              </p>
              <p className="text-sm text-gray-500 mt-0.5">
                {data.engagedCount} of {data.totalEmployees} active
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                {data.disengaged.length > 0
                  ? `${data.disengaged.length} employee${data.disengaged.length !== 1 ? "s" : ""} need follow-up`
                  : "Everyone is active!"}
              </p>
            </div>
          </div>
        </div>

        {/* Department breakdown — 3 columns: Dept / Active / Points */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-50">
            <p className="font-semibold text-gray-900 text-sm">Department Activity — This Month</p>
          </div>
          {data.departmentBreakdown.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-500">No department data</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-4 py-2 text-xs font-semibold text-gray-700">Department</th>
                    <th className="text-right px-4 py-2 text-xs font-semibold text-gray-700">Active / Total</th>
                    <th className="text-right px-4 py-2 text-xs font-semibold text-gray-700">Points</th>
                  </tr>
                </thead>
                <tbody>
                  {data.departmentBreakdown.map((d, i) => {
                    const pct = d.totalEmployees === 0 ? 0 : Math.round((d.activeEmployees / d.totalEmployees) * 100);
                    return (
                      <tr key={d.id} className={`border-t border-gray-50 hover:bg-gray-50/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-inset transition-colors ${i === 0 ? "border-t-0" : ""}`}>
                        <td className="px-4 py-2.5 font-medium text-gray-900">{d.name}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">
                          <span className={pct >= 70 ? "text-emerald-600 font-semibold" : pct >= 40 ? "text-amber-600" : "text-red-500"}>
                            {d.activeEmployees}
                          </span>
                          <span className="text-gray-500">/{d.totalEmployees}</span>
                          <span className="text-gray-500 text-xs ml-1">({pct}%)</span>
                        </td>
                        <td className="px-4 py-2.5 text-right font-bold text-navy-600 tabular-nums">
                          {d.pointsThisMonth.toLocaleString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Disengaged Employees */}
      {data.disengaged.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-50">
            <AlertCircle aria-hidden="true" className="w-4 h-4 text-amber-500" />
            <p className="font-semibold text-gray-900 text-sm">No Activity in 30+ Days</p>
            <span className="ml-auto text-xs bg-amber-50 text-amber-600 font-semibold px-2 py-0.5 rounded-full">
              {data.disengaged.length} employee{data.disengaged.length !== 1 ? "s" : ""}
            </span>
          </div>
          <ul className="divide-y divide-gray-50">
            {data.disengaged.map((e) => (
              <li key={e.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-inset transition-colors">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-gray-300 to-gray-400 flex items-center justify-center text-white text-xs font-bold shrink-0 overflow-hidden">
                  {e.avatarUrl ? <img src={e.avatarUrl} alt={e.displayName} className="w-full h-full object-cover" /> : e.displayName.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{e.displayName}</p>
                  <p className="text-xs text-gray-500">{e.department?.name ?? "No department"}</p>
                </div>
                <span className="text-xs text-gray-500 tabular-nums">{e.pointsBalance.toLocaleString()} pts</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Birthdays + Recent Awards — side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Upcoming Birthdays */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-50">
            <Cake aria-hidden="true" className="w-4 h-4 text-pink-400" />
            <p className="font-semibold text-gray-900 text-sm">Upcoming Birthdays</p>
            <span className="text-xs text-gray-500 ml-auto">Next 14 days</span>
          </div>
          {birthdays.length === 0 ? (
            <div className="py-6 text-center text-sm text-gray-500">No birthdays in the next 14 days</div>
          ) : (
            <ul className="divide-y divide-gray-50 max-h-64 overflow-y-auto">
              {birthdays.map((b) => {
                const bDate = new Date(b.birthday);
                const labelText = b.daysUntil === 0 ? "Today!" : b.daysUntil === 1 ? "Tomorrow" : `In ${b.daysUntil} days`;
                const showBirthdayEmoji = b.daysUntil === 0;
                const labelColor = b.daysUntil === 0 ? "text-pink-600 bg-pink-50" : b.daysUntil <= 3 ? "text-amber-600 bg-amber-50" : "text-gray-500 bg-gray-50";
                return (
                  <li key={b.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-inset transition-colors">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-pink-400 to-violet-500 flex items-center justify-center text-white text-xs font-bold shrink-0 overflow-hidden">
                      {b.avatarUrl ? <img src={b.avatarUrl} alt={b.displayName} className="w-full h-full object-cover" /> : b.displayName.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{b.displayName}</p>
                      <p className="text-xs text-gray-500">{b.department ?? "No department"} · {bDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</p>
                    </div>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${labelColor}`}>
                      {labelText}{showBirthdayEmoji && <> <span aria-hidden="true">🎂</span></>}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Recent Awards */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-50">
            <p className="font-semibold text-gray-900 text-sm">Recent Awards</p>
          </div>
          {data.recentTransactions.length === 0 ? (
            <div className="py-6 text-center text-sm text-gray-500">No transactions yet</div>
          ) : (
            <ul className="divide-y divide-gray-50 max-h-64 overflow-y-auto">
              {data.recentTransactions.map((t) => (
                <li key={t.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-gray-50/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-inset transition-colors">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{t.toUser.displayName}</p>
                    <p className="text-xs text-gray-500">
                      {typeLabel[t.type] ?? t.type}
                      {t.fromUser ? ` · from ${t.fromUser.displayName}` : ""}
                      {t.note ? ` · "${t.note}"` : ""}
                    </p>
                  </div>
                  <div className="text-right shrink-0 ml-4">
                    <p className="text-sm font-bold text-emerald-600">+{t.amount.toLocaleString()} pts</p>
                    <p className="text-xs text-gray-500">{new Date(t.createdAt).toLocaleDateString()}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
