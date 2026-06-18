"use client";

import { useEffect, useState } from "react";
import { useApiClient } from "@/lib/hooks/useApiClient";
import {
  Users, TrendingUp, ClipboardList,
  ArrowUpRight, ArrowDownRight, Minus, Cake, Activity, AlertCircle, MessageSquareWarning, CheckCircle2,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

type UpcomingBirthday = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  department: string | null;
  birthdayMonthDay: string; // MM-DD
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
  openReports: number;
  pendingMedicineRequests: number;
  pointsRedeemedThisMonth: number;
  avgPointsBalance: number;
  topEarners: { id: string; displayName: string; pointsBalance: number; level: number; avatarUrl: string | null }[];
  dailyPoints: { date: string; points: number }[];
  dailyRedemptions: { date: string; points: number }[];
  engagementRate: number;
  engagedCount: number;
  disengaged: DisengagedEmployee[];
  departmentBreakdown: DeptRow[];
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
    <svg width="72" height="72" viewBox="0 0 72 72" aria-hidden="true">
      <circle cx="36" cy="36" r={r} fill="none" stroke="#f3f4f6" strokeWidth="7" />
      <circle
        cx="36" cy="36" r={r} fill="none"
        stroke={color} strokeWidth="7"
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        transform="rotate(-90 36 36)"
      />
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
          {[...Array(5)].map((_, i) => <div key={i} className="h-24 bg-gray-100 rounded-2xl" />)}
        </div>
        <div className="h-56 bg-gray-100 rounded-2xl" />
      </div>
    );
  }

  if (!data) return <p className="text-gray-500">Failed to load analytics.</p>;

  // Merge daily awarded + redeemed into a single chart dataset by date
  const allDates = new Set([
    ...data.dailyPoints.map((d) => d.date),
    ...data.dailyRedemptions.map((d) => d.date),
  ]);
  const awardedMap = Object.fromEntries(data.dailyPoints.map((d) => [d.date, d.points]));
  const redeemedMap = Object.fromEntries(data.dailyRedemptions.map((d) => [d.date, d.points]));
  const chartData = Array.from(allDates)
    .sort()
    .map((date) => ({
      date: new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      Awarded: awardedMap[date] ?? 0,
      Redeemed: redeemedMap[date] ?? 0,
    }));

  const engagementColor =
    data.engagementRate >= 70 ? "text-emerald-600" : data.engagementRate >= 40 ? "text-amber-600" : "text-red-500";

  const redemptionRate = data.pointsThisMonth === 0
    ? 0
    : Math.round((data.pointsRedeemedThisMonth / data.pointsThisMonth) * 100);

  const totalPending = data.pendingRedemptions + data.pendingMedicineRequests;
  const pendingSubText = (() => {
    if (totalPending === 0) return "All clear";
    const parts: string[] = [];
    if (data.pendingRedemptions > 0) parts.push(`${data.pendingRedemptions} redemption${data.pendingRedemptions !== 1 ? "s" : ""}`);
    if (data.pendingMedicineRequests > 0) parts.push(`${data.pendingMedicineRequests} medicine`);
    return parts.join(" · ");
  })();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Overview</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}
        </p>
      </div>

      {/* KPI Cards — 2 cols mobile, 4 cols xl */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          label="Total Employees"
          value={data.totalEmployees.toLocaleString()}
          sub={`Avg ${data.avgPointsBalance.toLocaleString()} pts/person`}
          icon={Users}
          iconColor="bg-navy-500"
          valueColor="text-navy-600"
        />
        <KpiCard
          label="Points Awarded"
          value={data.pointsThisMonth.toLocaleString()}
          sub={`${redemptionRate}% redeemed this month`}
          icon={TrendingUp}
          iconColor="bg-emerald-500"
          growth={data.monthGrowth}
          valueColor="text-emerald-600"
        />
        <KpiCard
          label="Pending Actions"
          value={totalPending === 0 ? "All clear" : totalPending}
          sub={pendingSubText}
          icon={totalPending === 0 ? CheckCircle2 : ClipboardList}
          iconColor={totalPending === 0 ? "bg-emerald-500" : "bg-amber-500"}
          valueColor={totalPending === 0 ? "text-emerald-600" : "text-amber-600"}
        />
        <KpiCard
          label="Open Reports"
          value={data.openReports === 0 ? "All clear" : data.openReports}
          sub={data.openReports > 0 ? "Awaiting HR review" : "No open reports"}
          icon={data.openReports === 0 ? CheckCircle2 : MessageSquareWarning}
          iconColor={data.openReports > 0 ? "bg-red-500" : "bg-emerald-500"}
          valueColor={data.openReports > 0 ? "text-red-600" : "text-emerald-600"}
        />
      </div>

      {/* Chart + Top Earners */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="font-semibold text-gray-900 text-sm">Points Flow — Last 30 Days</p>
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-[#111827] inline-block rounded" />
                Awarded
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-violet-500 inline-block rounded" />
                Redeemed
              </span>
            </div>
          </div>
          {chartData.length === 0 ? (
            <div className="h-40 flex items-center justify-center text-gray-500 text-sm">No data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="awardedGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#111827" stopOpacity={0.12} />
                    <stop offset="95%" stopColor="#111827" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="redeemedGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.1} />
                    <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ border: "1px solid #e5e7eb", borderRadius: 12, fontSize: 12 }}
                  formatter={(v, name) => [`${Number(v ?? 0).toLocaleString()} pts`, String(name)]}
                />
                <Area type="monotone" dataKey="Awarded" stroke="#111827" strokeWidth={2.5} fill="url(#awardedGrad)" />
                <Area type="monotone" dataKey="Redeemed" stroke="#7c3aed" strokeWidth={2} fill="url(#redeemedGrad)" strokeDasharray="4 2" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="font-semibold text-gray-900 text-sm mb-3">Top Earners</p>
          <div className="space-y-1.5">
            {(() => {
              const maxBal = Math.max(...data.topEarners.map(e => e.pointsBalance), 1);
              return data.topEarners.map((e, i) => (
                <div key={e.id} className="grid grid-cols-[16px_28px_1fr_64px] items-center gap-2.5">
                  <span className={`text-xs font-bold tabular-nums text-center ${i === 0 ? "text-amber-500" : i === 1 ? "text-gray-400" : i === 2 ? "text-orange-400" : "text-gray-400"}`}>{i + 1}</span>
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-navy-600 to-navy-800 flex items-center justify-center text-white text-xs font-bold overflow-hidden">
                    {e.avatarUrl ? <img src={e.avatarUrl} alt={e.displayName} className="w-full h-full object-cover" /> : e.displayName.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate leading-tight">{e.displayName}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <div className="flex-1 bg-gray-100 rounded-full h-1 overflow-hidden">
                        <div className="h-full bg-navy-400 rounded-full" style={{ width: `${Math.round((e.pointsBalance / maxBal) * 100)}%` }} />
                      </div>
                      <span className="text-[10px] text-gray-400 shrink-0">Lv {e.level}</span>
                    </div>
                  </div>
                  <span className="text-sm font-bold text-navy-600 tabular-nums text-right">{e.pointsBalance.toLocaleString()}</span>
                </div>
              ));
            })()}
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
              <p className="text-xs text-gray-400 mt-0.5">
                posted, reacted, played, or redeemed
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {data.disengaged.length > 0
                  ? `${data.disengaged.length} employee${data.disengaged.length !== 1 ? "s" : ""} need follow-up`
                  : "Everyone is active!"}
              </p>
            </div>
          </div>
        </div>

        {/* Department breakdown */}
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
                    <th className="px-4 py-2 text-xs font-semibold text-gray-700 w-40">Engagement</th>
                    <th className="text-right px-4 py-2 text-xs font-semibold text-gray-700 w-16">Active</th>
                    <th className="text-right px-4 py-2 text-xs font-semibold text-gray-700 w-24">Points</th>
                  </tr>
                </thead>
                <tbody>
                  {data.departmentBreakdown.map((d, i) => {
                    const pct = d.totalEmployees === 0 ? 0 : Math.round((d.activeEmployees / d.totalEmployees) * 100);
                    const barColor = pct >= 70 ? "bg-emerald-400" : pct >= 40 ? "bg-amber-400" : "bg-red-400";
                    const textColor = pct >= 70 ? "text-emerald-600" : pct >= 40 ? "text-amber-600" : "text-red-500";
                    return (
                      <tr key={d.id} className={`border-t border-gray-50 hover:bg-gray-50/60 transition-colors ${i === 0 ? "border-t-0" : ""}`}>
                        <td className="px-4 py-2 font-medium text-gray-900">{d.name}</td>
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                              <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
                            </div>
                            <span className={`text-xs tabular-nums w-8 text-right font-medium ${textColor}`}>{pct}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums text-gray-500 text-xs">
                          {d.activeEmployees}/{d.totalEmployees}
                        </td>
                        <td className="px-4 py-2 text-right font-bold text-navy-600 tabular-nums">
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
          <div className="p-4">
            {(() => {
              const maxBal = Math.max(...data.disengaged.map(e => e.pointsBalance), 1);
              return (
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
                  {data.disengaged.map((e) => (
                    <li key={e.id} className="grid grid-cols-[28px_1fr_72px] items-center gap-2.5 py-1.5 hover:bg-gray-50/60 rounded-lg px-1 transition-colors">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-gray-300 to-gray-400 flex items-center justify-center text-white text-xs font-bold overflow-hidden shrink-0">
                        {e.avatarUrl ? <img src={e.avatarUrl} alt={e.displayName} className="w-full h-full object-cover" /> : e.displayName.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate leading-tight">{e.displayName}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <div className="flex-1 bg-gray-100 rounded-full h-1 overflow-hidden">
                            <div className="h-full bg-gray-300 rounded-full" style={{ width: `${Math.round((e.pointsBalance / maxBal) * 100)}%` }} />
                          </div>
                          <span className="text-[10px] text-gray-400 shrink-0 truncate">{e.department?.name ?? "—"}</span>
                        </div>
                      </div>
                      <span className="text-xs text-gray-500 tabular-nums text-right">{e.pointsBalance.toLocaleString()} pts</span>
                    </li>
                  ))}
                </ul>
              );
            })()}
          </div>
        </div>
      )}

      {/* Upcoming Birthdays — only shown when there are birthdays in the next 14 days */}
      {birthdays.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-50">
            <Cake aria-hidden="true" className="w-4 h-4 text-pink-400" />
            <p className="font-semibold text-gray-900 text-sm">Upcoming Birthdays</p>
            <span className="text-xs text-gray-500 ml-auto">Next 14 days</span>
          </div>
          <div className="p-4">
            <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-1">
              {birthdays.map((b) => {
                const [mm, dd] = b.birthdayMonthDay.split("-");
                const displayDate = new Date(2000, parseInt(mm) - 1, parseInt(dd))
                  .toLocaleDateString("en-US", { month: "short", day: "numeric" });
                const labelText = b.daysUntil === 0 ? "Today!" : b.daysUntil === 1 ? "Tomorrow" : `In ${b.daysUntil} days`;
                const labelColor = b.daysUntil === 0 ? "text-pink-600 bg-pink-50" : b.daysUntil <= 3 ? "text-amber-600 bg-amber-50" : "text-gray-500 bg-gray-50";
                return (
                  <li key={b.id} className="grid grid-cols-[28px_1fr_auto] items-center gap-2.5 py-1.5 px-1 hover:bg-gray-50/60 rounded-lg transition-colors">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-pink-400 to-violet-500 flex items-center justify-center text-white text-xs font-bold shrink-0 overflow-hidden">
                      {b.avatarUrl ? <img src={b.avatarUrl} alt={b.displayName} className="w-full h-full object-cover" /> : b.displayName.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate leading-tight">{b.displayName}</p>
                      <p className="text-xs text-gray-400 truncate">{b.department ?? "No dept"} · {displayDate}</p>
                    </div>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${labelColor}`}>
                      {labelText}{b.daysUntil === 0 && <> <span aria-hidden="true">🎂</span></>}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
