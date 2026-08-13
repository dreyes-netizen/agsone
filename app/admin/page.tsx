"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useApiClient } from "@/lib/hooks/useApiClient";
import {
  Users, TrendingUp, ClipboardList,
  ArrowUpRight, ArrowDownRight, Minus, Cake, MessageSquareWarning, CheckCircle2,
} from "lucide-react";
import { ActionQueue, type ActionItem } from "@/components/admin/ActionQueue";
import { StockAlerts, type StockItem } from "@/components/admin/StockAlerts";
import { RecentActivity } from "@/components/admin/RecentActivity";
import { useRealtimeChannel } from "@/lib/hooks/useRealtimeChannel";
import { realtimeTopics } from "@/lib/realtime/topics";

// recharts is the largest chunk in the build (~349 KB) for a chart that
// renders below the fold on one admin page — load it only once this page
// actually mounts, and only in the browser (recharts needs layout measurements
// it can't get during SSR anyway).
const PointsFlowChart = dynamic(
  () => import("@/components/admin/PointsFlowChart").then((m) => m.PointsFlowChart),
  { ssr: false, loading: () => <div className="lg:col-span-2 bg-white rounded-card border border-table-border p-4 h-[236px] animate-pulse" /> },
);

type UpcomingBirthday = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  department: string | null;
  birthdayMonthDay: string; // MM-DD
  daysUntil: number;
};

type AuditEntry = {
  id: string;
  action: string;
  entityType: string;
  createdAt: string;
  afterState: Record<string, unknown> | null;
  beforeState: Record<string, unknown> | null;
  actor: { id: string; displayName: string; avatarUrl: string | null; role: string };
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
  actionQueue: ActionItem[];
  stockAlerts: StockItem[];
  recentActivity: AuditEntry[];
  counts: { redemptions: number; medicine: number; reports: number };
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
    <div className="bg-white rounded-card border border-table-border p-4">
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

export default function AdminDashboardPage() {
  const { apiFetch } = useApiClient();
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [birthdays, setBirthdays] = useState<UpcomingBirthday[]>([]);
  const [failedAvatars, setFailedAvatars] = useState<Set<string>>(new Set());

  async function loadAnalytics() {
    try {
      const r = await apiFetch<{ data: Analytics }>("/api/admin/analytics");
      setData(r.data);
    } catch (err) {
      console.error("admin analytics fetch failed", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    queueMicrotask(loadAnalytics);
    apiFetch<{ data: UpcomingBirthday[] }>("/api/birthdays/upcoming")
      .then((r) => setBirthdays(r.data))
      .catch((err) => console.error("upcoming birthdays fetch failed", err));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useRealtimeChannel(realtimeTopics.adminAnalytics, loadAnalytics, { debounceMs: 300 });
  useRealtimeChannel(
    realtimeTopics.employees,
    () => {
      apiFetch<{ data: UpcomingBirthday[] }>("/api/birthdays/upcoming")
        .then((res) => setBirthdays(res.data))
        .catch((err) => console.error("upcoming birthdays refresh failed", err));
    },
    { debounceMs: 300 },
  );

  if (loading) {
    return (
      <div role="status" aria-label="Loading dashboard" className="space-y-5 animate-pulse">
        <div className="h-8 bg-gray-100 rounded w-1/3" />
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-gray-100 rounded-2xl" />)}
        </div>
        <div className="h-56 bg-gray-100 rounded-2xl" />
        <div className="h-56 bg-gray-100 rounded-2xl" />
        <div className="h-40 bg-gray-100 rounded-2xl" />
      </div>
    );
  }

  if (!data) return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Overview</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}
        </p>
      </div>
      <div role="alert" className="bg-white rounded-card border border-table-border p-8 text-center space-y-3">
        <p className="text-gray-500">Failed to load analytics.</p>
        <button
          onClick={() => window.location.reload()}
          className="text-sm text-gray-700 font-medium underline underline-offset-2 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-900"
        >
          Retry
        </button>
      </div>
    </div>
  );

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
          label="Active Employees"
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
          iconColor="bg-gray-500"
          growth={data.monthGrowth}
          valueColor="text-gray-900"
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

      {/* Action Queue + Stock Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ActionQueue items={data.actionQueue} counts={data.counts} />
        <StockAlerts items={data.stockAlerts} />
      </div>

      {/* Chart + Top Earners */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <PointsFlowChart data={chartData} />

        <div className="bg-white rounded-card border border-table-border p-4">
          <p className="font-semibold text-gray-900 text-sm mb-3">Top Earners</p>
          <div className="space-y-1.5">
            {(() => {
              const maxBal = Math.max(...data.topEarners.map(e => e.pointsBalance), 1);
              return data.topEarners.map((e, i) => (
                <div key={e.id} className="grid grid-cols-[16px_28px_1fr_64px] items-center gap-2.5">
                  <span className={`text-xs font-bold tabular-nums text-center ${i === 0 ? "text-gray-700" : i === 1 ? "text-gray-500" : i === 2 ? "text-gray-500" : "text-gray-500"}`}>{i + 1}</span>
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-navy-600 to-navy-800 flex items-center justify-center text-white text-xs font-bold overflow-hidden">
                    {e.avatarUrl && !failedAvatars.has(e.id) ? <img src={e.avatarUrl} alt={e.displayName} className="w-full h-full object-cover" onError={() => setFailedAvatars((prev) => new Set(prev).add(e.id))} /> : e.displayName.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate leading-tight">{e.displayName}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <div className="flex-1 bg-gray-100 rounded-full h-1 overflow-hidden">
                        <div className="h-full bg-navy-400 rounded-full" style={{ width: `${Math.round((e.pointsBalance / maxBal) * 100)}%` }} />
                      </div>
                      <span className="text-[10px] text-gray-500 shrink-0">Lv {e.level}</span>
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

      {/* Recent Admin Activity */}
      <RecentActivity entries={data.recentActivity} />

      {/* Upcoming Birthdays — only shown when there are birthdays in the next 14 days */}
      {birthdays.length > 0 && (
        <div className="bg-white rounded-card border border-table-border overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-50">
            <Cake aria-hidden="true" className="w-4 h-4 text-gray-500" />
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
                const labelColor = b.daysUntil === 0 ? "text-gray-700 bg-gray-100" : b.daysUntil <= 3 ? "text-gray-600 bg-gray-100" : "text-gray-500 bg-gray-50";
                return (
                  <li key={b.id} className="grid grid-cols-[28px_1fr_auto] items-center gap-2.5 py-1.5 px-1 hover:bg-gray-50/60 rounded-lg transition-colors">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-gray-300 to-gray-400 flex items-center justify-center text-white text-xs font-bold shrink-0 overflow-hidden">
                      {b.avatarUrl && !failedAvatars.has(b.id) ? <img src={b.avatarUrl} alt={b.displayName} className="w-full h-full object-cover" onError={() => setFailedAvatars((prev) => new Set(prev).add(b.id))} /> : b.displayName.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate leading-tight">{b.displayName}</p>
                      <p className="text-xs text-gray-500 truncate">{b.department ?? "No dept"} · {displayDate}</p>
                    </div>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${labelColor}`}>
                      {labelText}{b.daysUntil === 0 && <> <Cake className="w-3 h-3 inline" aria-hidden="true" /></>}
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
