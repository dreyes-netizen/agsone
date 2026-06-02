"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useApiClient } from "@/lib/hooks/useApiClient";
import Link from "next/link";
import {
  ShoppingBag, Trophy, Gamepad2, Rss, ArrowUpRight,
  TrendingUp, Flame, Star, BarChart3, Coins, UtensilsCrossed, Pill,
} from "lucide-react";

type Transaction = {
  id: string;
  amount: number;
  type: string;
  note: string | null;
  createdAt: string;
  fromUser: { displayName: string } | null;
};

type UserProfile = {
  pointsBalance: number;
  level: number;
  streakDays: number;
  displayName: string;
};

type BirthdayPerson = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  department: string | null;
};

const typeConfig: Record<string, { label: string; color: string; bg: string }> = {
  MANUAL_AWARD: { label: "Points Awarded",  color: "text-emerald-600", bg: "bg-emerald-50" },
  ATTENDANCE:   { label: "Streak Bonus",    color: "text-sky-600",     bg: "bg-sky-50" },
  REDEMPTION:   { label: "Redeemed",        color: "text-rose-500",    bg: "bg-rose-50" },
  REFUND:       { label: "Refund",          color: "text-emerald-600", bg: "bg-emerald-50" },
  GAME_WIN:     { label: "Game Win",        color: "text-violet-600",  bg: "bg-violet-50" },
  GAME_SPEND:   { label: "Game Entry",      color: "text-orange-500",  bg: "bg-orange-50" },
  CONTEST:      { label: "Contest",         color: "text-navy-600",  bg: "bg-navy-50" },
  KPI:          { label: "KPI Bonus",       color: "text-emerald-600", bg: "bg-emerald-50" },
  TASK:         { label: "Task Completion", color: "text-emerald-600", bg: "bg-emerald-50" },
  MILESTONE:    { label: "Milestone Reward", color: "text-violet-600",  bg: "bg-violet-50" },
};

const quickLinks = [
  {
    href: "/marketplace",
    label: "Marketplace",
    sub: "Redeem your points",
    icon: ShoppingBag,
    accent: "text-orange-500",
    bg: "bg-orange-50",
  },
  {
    href: "/games",
    label: "Games",
    sub: "Play & win prizes",
    icon: Gamepad2,
    accent: "text-violet-600",
    bg: "bg-violet-50",
  },
  {
    href: "/leaderboard",
    label: "Leaderboard",
    sub: "See top earners",
    icon: Trophy,
    accent: "text-yellow-600",
    bg: "bg-yellow-50",
  },
  {
    href: "/feed",
    label: "Feed",
    sub: "Company updates",
    icon: Rss,
    accent: "text-emerald-600",
    bg: "bg-emerald-50",
  },
  {
    href: "/food",
    label: "Food Board",
    sub: "Order from colleagues",
    icon: UtensilsCrossed,
    accent: "text-rose-500",
    bg: "bg-rose-50",
  },
  {
    href: "/medicine",
    label: "Medicine",
    sub: "Request supplies",
    icon: Pill,
    accent: "text-sky-600",
    bg: "bg-sky-50",
  },
];

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const { apiFetch } = useApiClient();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [upcomingBirthdays, setUpcomingBirthdays] = useState<(BirthdayPerson & { daysUntil: number })[]>([]);

  useEffect(() => {
    if (authLoading || !user) return;
    apiFetch<{ data: UserProfile }>("/api/me").then((r) => setProfile(r.data)).catch(() => {});
    apiFetch<{ data: Transaction[] }>("/api/points/history").then((r) => setTransactions(r.data.slice(0, 6))).catch(() => {});
    apiFetch<{ data: (BirthdayPerson & { daysUntil: number })[] }>("/api/birthdays/upcoming")
      .then((r) => setUpcomingBirthdays(r.data.filter((b) => b.daysUntil <= 7)))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user]);

  const firstName = user?.displayName?.split(" ")[0] ?? "there";

  return (
    <div className="max-w-5xl space-y-6">

      {/* ── Header ── */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-zinc-400 font-medium">
            {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
          </p>
          <h1 className="text-2xl font-bold text-zinc-900 mt-0.5">
            {authLoading ? (
              <span className="inline-block h-8 w-48 bg-zinc-100 animate-pulse rounded align-middle" />
            ) : (
              <>{getGreeting()}, {firstName}</>
            )}
          </h1>
        </div>
      </div>

      {/* ── Stats row ── */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-zinc-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 rounded-md bg-navy-50 flex items-center justify-center">
              <Coins className="w-3.5 h-3.5 text-navy-500" />
            </div>
            <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Balance</p>
          </div>
          <p className="text-3xl font-black text-zinc-900 tabular-nums leading-none">
            {profile?.pointsBalance?.toLocaleString() ?? <span className="text-zinc-300">—</span>}
          </p>
          <p className="text-xs text-zinc-400 mt-1.5">points available</p>
        </div>

        <div className="bg-white rounded-xl border border-zinc-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 rounded-md bg-violet-50 flex items-center justify-center">
              <Star className="w-3.5 h-3.5 text-violet-500" />
            </div>
            <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Level</p>
          </div>
          <p className="text-3xl font-black text-violet-600 leading-none">{profile?.level ?? 1}</p>
          <p className="text-xs text-zinc-400 mt-1.5">current level</p>
        </div>

        <div className="bg-white rounded-xl border border-zinc-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 rounded-md bg-orange-50 flex items-center justify-center">
              <Flame className="w-3.5 h-3.5 text-orange-500" />
            </div>
            <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Streak</p>
          </div>
          <p className="text-3xl font-black text-orange-500 leading-none">{profile?.streakDays ?? 0}</p>
          <p className="text-xs text-zinc-400 mt-1.5">days active</p>
        </div>
      </div>

      {/* ── Upcoming Birthdays ── */}
      {upcomingBirthdays.length > 0 && (
        <div className="bg-gradient-to-r from-pink-50 to-violet-50 border border-pink-100 rounded-xl px-5 py-4">
          <p className="text-xs font-semibold text-pink-500 uppercase tracking-wider mb-3">🎂 Upcoming Birthdays</p>
          <div className="flex flex-wrap gap-4">
            {upcomingBirthdays.map((b) => (
              <div key={b.id} className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-400 to-violet-500 flex items-center justify-center text-white text-xs font-bold shrink-0 overflow-hidden">
                  {b.avatarUrl ? <img src={b.avatarUrl} alt={b.displayName} className="w-full h-full object-cover" /> : b.displayName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-semibold text-zinc-900 leading-tight">{b.displayName}</p>
                  <p className="text-xs text-zinc-400">
                    {b.daysUntil === 0 ? "Today 🎉" : b.daysUntil === 1 ? "Tomorrow" : `In ${b.daysUntil} days`}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Quick links ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {quickLinks.map(({ href, label, sub, icon: Icon, accent, bg }) => (
          <Link key={href} href={href} className="group">
            <div className="bg-white rounded-xl border border-zinc-200 p-4 hover:border-zinc-300 hover:shadow-sm transition-all duration-150">
              <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center mb-3`}>
                <Icon className={`w-4.5 h-4.5 ${accent}`} />
              </div>
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-zinc-900 text-sm">{label}</p>
                  <p className="text-xs text-zinc-400 mt-0.5 leading-tight">{sub}</p>
                </div>
                <ArrowUpRight className="w-3.5 h-3.5 text-zinc-300 group-hover:text-zinc-500 transition-colors shrink-0 mt-0.5" />
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* ── Recent Activity ── */}
      <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-100">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-zinc-400" />
            <span className="font-semibold text-zinc-900 text-sm">Recent Activity</span>
          </div>
          <Link
            href="/profile"
            className="flex items-center gap-1 text-xs text-navy-600 font-medium hover:text-navy-700 transition-colors"
          >
            View all <ArrowUpRight className="w-3 h-3" />
          </Link>
        </div>

        {transactions.length === 0 ? (
          <div className="py-14 text-center">
            <div className="w-10 h-10 rounded-xl bg-zinc-50 flex items-center justify-center mx-auto mb-3">
              <TrendingUp className="w-5 h-5 text-zinc-300" />
            </div>
            <p className="text-zinc-500 text-sm font-medium">No activity yet</p>
            <p className="text-zinc-400 text-xs mt-1">Earn points to see your history here</p>
          </div>
        ) : (
          <ul>
            {transactions.map((t, i) => {
              const cfg = typeConfig[t.type] ?? { label: t.type, color: "text-zinc-600", bg: "bg-zinc-50" };
              const positive = t.amount > 0;
              return (
                <li
                  key={t.id}
                  className={`flex items-center justify-between px-5 py-3.5 hover:bg-zinc-50/80 transition-colors ${i < transactions.length - 1 ? "border-b border-zinc-100" : ""}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg ${cfg.bg} flex items-center justify-center shrink-0`}>
                      <span className={`text-xs font-black ${cfg.color}`}>{positive ? "+" : "−"}</span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-zinc-900 leading-tight">{cfg.label}</p>
                      <p className="text-xs text-zinc-400 mt-0.5">
                        {t.fromUser
                          ? `From ${t.fromUser.displayName}`
                          : (t.note ?? new Date(t.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }))}
                      </p>
                    </div>
                  </div>
                  <span className={`text-sm font-bold tabular-nums ${positive ? "text-emerald-600" : "text-rose-500"}`}>
                    {positive ? "+" : ""}{t.amount.toLocaleString()} <span className="font-normal text-xs text-zinc-400">pts</span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

    </div>
  );
}
