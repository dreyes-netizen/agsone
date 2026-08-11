"use client";

import Link from "next/link";
import { Cake, PartyPopper, ShoppingBag, Gamepad2, Megaphone, Award, type LucideIcon } from "lucide-react";
import { txTypeLabel } from "@/components/profile/PointsTimeline";
import type { UserProfile, PointsData, PointTx } from "@/lib/hooks/useProfileActions";

function getDaysUntil(isoDate: string): number {
  const now = new Date();
  const d = new Date(isoDate);
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const next = new Date(now.getFullYear(), d.getMonth(), d.getDate());
  if (next.getTime() < todayMidnight.getTime()) next.setFullYear(now.getFullYear() + 1);
  return Math.round((next.getTime() - todayMidnight.getTime()) / (1000 * 60 * 60 * 24));
}

function getAnniversaryYear(hireDate: string): number {
  const now = new Date();
  const hire = new Date(hireDate);
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const thisYearDate = new Date(now.getFullYear(), hire.getMonth(), hire.getDate());
  return thisYearDate.getTime() < todayMidnight.getTime()
    ? now.getFullYear() + 1 - hire.getFullYear()
    : now.getFullYear() - hire.getFullYear();
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function ProfileSidebar({
  profile,
  deptRank,
  pointsData,
  onViewPoints,
  onViewBadges,
}: {
  profile: UserProfile;
  deptRank: { rank: number; total: number } | null;
  pointsData: PointsData | null;
  onViewPoints: () => void;
  onViewBadges: () => void;
}) {
  return (
    <div className="space-y-4 sticky top-6 self-start">

      {/* Widget 0: Upcoming Milestone */}
      {(() => {
        const items: { icon: LucideIcon; label: string; daysUntil: number }[] = [];
        const dayLabel = (d: number) => d === 0 ? "Today!" : `in ${d} day${d === 1 ? "" : "s"}`;
        if (profile.birthday) {
          const d = getDaysUntil(profile.birthday);
          if (d <= 30) items.push({ icon: Cake, label: `Birthday ${dayLabel(d)}`, daysUntil: d });
        }
        if (profile.hireDate) {
          const d = getDaysUntil(profile.hireDate);
          if (d <= 30) {
            const yr = getAnniversaryYear(profile.hireDate);
            if (yr > 0) items.push({ icon: PartyPopper, label: `${ordinal(yr)} anniversary ${dayLabel(d)}`, daysUntil: d });
          }
        }
        if (items.length === 0) return null;
        return (
          <div className="bg-white rounded-card border border-table-border px-5 py-4 space-y-2">
            <p className="text-xs text-gray-500 font-medium">Upcoming</p>
            {items.map((item) => (
              <p key={item.label} className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
                <item.icon className="w-3.5 h-3.5" aria-hidden="true" /> {item.label}
              </p>
            ))}
          </div>
        );
      })()}

      {/* Widget 1: Department Rank */}
      <Link href="/leaderboard">
        <div className="bg-white rounded-card border border-table-border px-5 py-4 hover:border-gray-300 transition-colors">
          <p className="text-xs text-gray-500 font-medium mb-2">Department Rank</p>
          {profile.department && deptRank ? (
            <>
              <p className="text-2xl font-black text-navy-600">#{deptRank.rank}</p>
              <p className="text-xs text-gray-500 mt-0.5">
                in {profile.department.name} · of {deptRank.total}
              </p>
            </>
          ) : (
            <p className="text-xs text-gray-500">No department assigned</p>
          )}
        </div>
      </Link>

      {/* Widget 2: Recent Activity */}
      <div className="bg-white rounded-card border border-table-border overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <p className="text-xs font-semibold text-gray-700">Recent Activity</p>
          <button onClick={onViewPoints} className="text-xs text-navy-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-600 rounded">
            View all →
          </button>
        </div>
        {pointsData && pointsData.transactions.length > 0 ? (
          <ul className="divide-y divide-gray-100">
            {(() => {
              const deduped: { t: PointTx; count: number }[] = [];
              for (const t of pointsData.transactions.slice(0, 6)) {
                const last = deduped[deduped.length - 1];
                if (last && last.t.note === t.note && last.t.type === t.type) { last.count++; }
                else { deduped.push({ t, count: 1 }); }
              }
              return deduped.slice(0, 3).map(({ t, count }) => {
                const positive = t.amount >= 0;
                const meta = txTypeLabel[t.type] ?? { label: t.type, color: "text-gray-600" };
                return (
                  <li key={t.id} className="flex items-center gap-3 px-4 py-2.5">
                    <span className={`text-xs font-bold shrink-0 ${positive ? "text-emerald-600" : "text-rose-500"}`}>
                      {positive ? "+" : ""}{t.amount.toLocaleString()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-gray-800 truncate">{t.note ?? meta.label}</p>
                      <p className="text-xs text-gray-500">{new Date(t.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>
                    </div>
                    {count > 1 && (
                      <span className="text-[10px] font-semibold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-full shrink-0">×{count}</span>
                    )}
                  </li>
                );
              });
            })()}
          </ul>
        ) : (
          <p className="text-xs text-gray-500 text-center py-4">No activity yet</p>
        )}
      </div>

      {/* Widget 3: Quick Actions */}
      <div className="bg-white rounded-card border border-table-border overflow-hidden">
        <p className="px-4 py-3 text-xs font-semibold text-gray-700 border-b border-gray-100">Quick Actions</p>
        <div className="divide-y divide-gray-100">
          {[
            { href: "/marketplace", icon: ShoppingBag, label: "Redeem Points",   color: "text-orange-500" },
            { href: "/minigames",   icon: Gamepad2,    label: "Play a Minigame", color: "text-navy-500" },
            { href: "/feed",        icon: Megaphone,   label: "Send a Shoutout", color: "text-emerald-500" },
          ].map(({ href, icon: Icon, label, color }) => (
            <Link key={href} href={href} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
              <Icon className={`w-4 h-4 shrink-0 ${color}`} aria-hidden="true" />
              <span className="text-sm font-medium text-gray-700">{label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Widget 4: Recent Badges */}
      {profile.userBadges.length > 0 && (
        <div className="bg-white rounded-card border border-table-border overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-700">Recent Badges</p>
            <button onClick={onViewBadges} className="text-xs text-navy-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-600 rounded">
              See all →
            </button>
          </div>
          <ul className="divide-y divide-gray-100">
            {profile.userBadges.slice(0, 2).map((ub) => (
              <li key={ub.id} className="flex items-center gap-3 px-4 py-2.5">
                <Award className="w-4 h-4 text-amber-500 shrink-0" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-gray-800 truncate">{ub.badge.name}</p>
                  <p className="text-xs text-gray-500">{new Date(ub.awardedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

    </div>
  );
}
