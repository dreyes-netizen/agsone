"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useApiClient } from "@/lib/hooks/useApiClient";
import { History, Star, Flame, Medal, Coins, CalendarDays, Trophy, Award } from "lucide-react";

type UserBadge = {
  id: string;
  awardedAt: string;
  badge: { name: string; description: string | null };
};

type UserProfile = {
  id: string;
  displayName: string;
  email: string;
  avatarUrl: string | null;
  role: string;
  pointsBalance: number;
  level: number;
  streakDays: number;
  birthday: string | null;
  hireDate: string | null;
  department: { id: string; name: string } | null;
  userBadges: UserBadge[];
};

type PointTx = {
  id: string;
  amount: number;
  type: string;
  note: string | null;
  createdAt: string;
  fromUser: { displayName: string } | null;
};

type RedemptionTx = {
  id: string;
  pointsSpent: number;
  createdAt: string;
  reward: { name: string };
};

type PointsData = {
  balance: number;
  level: number;
  totalEarned: number;
  transactions: PointTx[];
  redemptions: RedemptionTx[];
};

type TimelineEntry =
  | { kind: "earn"; data: PointTx }
  | { kind: "redeem"; data: RedemptionTx };

const txTypeLabel: Record<string, { label: string; color: string }> = {
  MANUAL_AWARD: { label: "Award",      color: "text-emerald-600" },
  ATTENDANCE:   { label: "Attendance", color: "text-blue-600" },
  TASK:         { label: "Task",       color: "text-purple-600" },
  KPI:          { label: "KPI",        color: "text-navy-600" },
  CONTEST:      { label: "Contest",    color: "text-yellow-600" },
  REDEMPTION:   { label: "Redemption", color: "text-rose-500" },
  GAME_WIN:     { label: "Game Win",   color: "text-emerald-500" },
  GAME_SPEND:   { label: "Game",       color: "text-orange-500" },
  REFUND:       { label: "Refund",     color: "text-teal-600" },
  MILESTONE:    { label: "Milestone",  color: "text-amber-600" },
};

const POINTS_PER_LEVEL = 1000;

const roleLabel: Record<string, string> = {
  EMPLOYEE: "Employee",
  MANAGER:  "Manager",
  HR_ADMIN: "HR Admin",
};

const roleBadgeStyle: Record<string, string> = {
  EMPLOYEE: "bg-zinc-100 text-zinc-700",
  MANAGER:  "bg-blue-50 text-blue-700",
  HR_ADMIN: "bg-violet-50 text-violet-700",
};

function CompletenessBar({ profile }: { profile: UserProfile }) {
  const items = [
    { label: "Display name", done: !!profile.displayName },
    { label: "Profile photo", done: !!profile.avatarUrl },
    { label: "Birthday", done: !!profile.birthday, hint: "Set it on this page" },
    { label: "Department", done: !!profile.department, hint: "Contact HR to assign" },
  ];
  const doneCount = items.filter((i) => i.done).length;
  const pct = Math.round((doneCount / items.length) * 100);
  if (pct === 100) return null;

  return (
    <div className="bg-white rounded-xl border border-zinc-200 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-zinc-700">Profile completeness</p>
        <span className="text-sm font-bold text-navy-600">{pct}%</span>
      </div>
      <div className="w-full bg-zinc-100 rounded-full h-1.5">
        <div
          className="bg-navy-500 h-1.5 rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <span
            key={item.label}
            className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border font-medium ${
              item.done
                ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                : "bg-zinc-50 border-zinc-200 text-zinc-500"
            }`}
            title={!item.done && item.hint ? item.hint : undefined}
          >
            {item.done ? (
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
            {item.label}
          </span>
        ))}
      </div>
      <p className="text-xs text-zinc-400">
        Complete your profile to unlock features like milestone rewards and birthday bonuses.
      </p>
    </div>
  );
}

function PlayerAvatar({ name, url }: { name: string; url: string | null }) {
  if (url) {
    return <img src={url} alt={name} className="w-20 h-20 rounded-full object-cover ring-4 ring-white shadow-md" />;
  }
  return (
    <div className="w-20 h-20 rounded-full bg-navy-500 flex items-center justify-center text-white font-bold text-3xl ring-4 ring-white shadow-md">
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

export default function ProfilePage() {
  const { user: authUser, loading: authLoading } = useAuth();
  const { apiFetch } = useApiClient();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [pointsData, setPointsData] = useState<PointsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "points" | "badges">("overview");
  const [visibleCount, setVisibleCount] = useState(10);
  const [birthdayEdit, setBirthdayEdit] = useState("");
  const [birthdaySaving, setBirthdaySaving] = useState(false);
  const [birthdayError, setBirthdayError] = useState("");

  useEffect(() => {
    if (authLoading || !authUser) return;
    Promise.all([
      apiFetch<{ data: UserProfile }>("/api/me"),
      apiFetch<{ data: PointsData }>("/api/me/points"),
    ]).then(([me, pts]) => {
      setProfile(me.data);
      setPointsData(pts.data);
    }).catch(() => {
      // intentional: stop loading spinner on fetch failure
    }).finally(() => {
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, authUser]);

  async function handleBirthdaySave() {
    if (!birthdayEdit || !profile) return;
    setBirthdaySaving(true);
    setBirthdayError("");
    try {
      await apiFetch("/api/auth/onboarding", {
        method: "PATCH",
        body: JSON.stringify({ displayName: profile.displayName, birthday: birthdayEdit }),
      });
      setProfile((p) => p ? { ...p, birthday: birthdayEdit } : p);
      setBirthdayEdit("");
    } catch (err: unknown) {
      setBirthdayError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setBirthdaySaving(false);
    }
  }

  if (loading || !profile) {
    return <div className="text-zinc-400 py-12 text-center text-sm">Loading profile...</div>;
  }

  const pointsIntoLevel = profile.pointsBalance % POINTS_PER_LEVEL;
  const levelPct = Math.min(100, (pointsIntoLevel / POINTS_PER_LEVEL) * 100);

  return (
    <div className="space-y-5 max-w-3xl">

      {/* ── Profile card ── */}
      <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
        {/* Top accent */}
        <div className="h-24 bg-gradient-to-br from-navy-500 to-violet-600 relative">
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)", backgroundSize: "20px 20px" }} />
        </div>

        <div className="px-6 pb-6 relative">
          {/* Avatar */}
          <div className="-mt-10 mb-3">
            <PlayerAvatar name={profile.displayName} url={profile.avatarUrl} />
          </div>

          <div className="flex items-start justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-xl font-bold text-zinc-900">{profile.displayName}</h1>
              <p className="text-sm text-zinc-500 mt-0.5">{profile.email}</p>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${roleBadgeStyle[profile.role] ?? "bg-zinc-100 text-zinc-700"}`}>
                  {roleLabel[profile.role] ?? profile.role}
                </span>
                {profile.department && (
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-zinc-100 text-zinc-600">
                    {profile.department.name}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Level progress */}
          <div className="mt-5 space-y-1.5">
            <div className="flex justify-between text-xs text-zinc-500">
              <span className="font-medium">Level {profile.level}</span>
              <span>{pointsIntoLevel.toLocaleString()} / {POINTS_PER_LEVEL.toLocaleString()} pts to next level</span>
            </div>
            <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-navy-500 rounded-full transition-all"
                style={{ width: `${levelPct}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Tab bar ── */}
      <div className="flex gap-1 bg-zinc-100 p-1 rounded-xl">
        {(["overview", "points", "badges"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => { setActiveTab(tab); setVisibleCount(10); }}
            className={`flex-1 py-1.5 text-sm font-semibold rounded-lg capitalize transition-colors ${
              activeTab === tab
                ? "bg-white text-zinc-900 shadow-sm"
                : "text-zinc-500 hover:text-zinc-700"
            }`}
          >
            {tab === "points" ? "Points" : tab === "badges" ? "Badges" : "Overview"}
          </button>
        ))}
      </div>

      {/* ── Overview tab ── */}
      {activeTab === "overview" && (
        <>
          <CompletenessBar profile={profile} />
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { icon: Coins,  value: profile.pointsBalance.toLocaleString(), label: "Points Balance", color: "text-navy-600", bg: "bg-navy-50" },
              { icon: Star,   value: profile.level,                          label: "Level",          color: "text-violet-600", bg: "bg-violet-50" },
              { icon: Flame,  value: profile.streakDays,                     label: "Streak (days)",  color: "text-orange-500", bg: "bg-orange-50" },
              { icon: Medal,  value: profile.userBadges.length,              label: "Badges",         color: "text-amber-600",  bg: "bg-amber-50" },
            ].map(({ icon: Icon, value, label, color, bg }) => (
              <div key={label} className="bg-white rounded-xl border border-zinc-200 p-4 flex flex-col gap-2">
                <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center`}>
                  <Icon className={`w-4 h-4 ${color}`} />
                </div>
                <p className={`text-2xl font-black leading-none ${color}`}>{value}</p>
                <p className="text-xs text-zinc-400 font-medium">{label}</p>
              </div>
            ))}
          </div>

          {/* Birthday */}
          <div className="bg-white rounded-xl border border-zinc-200 px-5 py-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center">
                  <CalendarDays className="w-4 h-4 text-rose-500" />
                </div>
                <div>
                  <p className="text-xs text-zinc-400 font-medium">Birthday</p>
                  <p className="text-sm font-semibold text-zinc-800">
                    {profile.birthday
                      ? new Date(profile.birthday).toLocaleDateString(undefined, { month: "long", day: "numeric" })
                      : "Not set"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={birthdayEdit}
                  onChange={(e) => setBirthdayEdit(e.target.value)}
                  className="text-sm border border-zinc-200 rounded-lg px-3 py-1.5 text-zinc-800 focus:outline-none focus:ring-2 focus:ring-navy-500/30 focus:border-navy-400 transition"
                />
                <button
                  onClick={handleBirthdaySave}
                  disabled={birthdaySaving || !birthdayEdit}
                  className="text-sm bg-[#111827] hover:bg-gray-800 text-white font-medium px-4 py-1.5 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {birthdaySaving ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
            {birthdayError && <p className="mt-2 text-xs text-red-500">{birthdayError}</p>}
          </div>
          {profile.hireDate && (
            <div className="bg-white rounded-xl border border-zinc-200 px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                  <Trophy className="w-4 h-4 text-blue-500" />
                </div>
                <div>
                  <p className="text-xs text-zinc-400 font-medium">Hire Date</p>
                  <p className="text-sm font-semibold text-zinc-800">
                    {new Date(profile.hireDate).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}
                  </p>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Points tab ── */}
      {activeTab === "points" && pointsData && (
        <>
          {/* Balance card */}
          <div className="bg-white rounded-xl border border-zinc-200 p-5">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <p className="text-xs text-zinc-400 font-medium uppercase tracking-wide">Current Balance</p>
                <p className="text-4xl font-black text-navy-600 leading-none mt-1">
                  {pointsData.balance.toLocaleString()}
                  <span className="text-lg font-semibold text-zinc-400 ml-1">pts</span>
                </p>
              </div>
              <div className="text-right">
                <span className="inline-block bg-violet-100 text-violet-700 text-xs font-bold px-3 py-1 rounded-full">
                  Level {pointsData.level}
                </span>
                <p className="text-xs text-zinc-400 mt-2">
                  Total earned:{" "}
                  <span className="font-semibold text-zinc-700">
                    {pointsData.totalEarned.toLocaleString()} pts
                  </span>
                </p>
              </div>
            </div>
          </div>

          {/* Unified timeline */}
          <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-zinc-100 flex items-center gap-2">
              <History className="w-4 h-4 text-zinc-400" />
              <h2 className="text-sm font-bold text-zinc-800">Transaction History</h2>
            </div>
            {(() => {
              const entries: TimelineEntry[] = [
                ...pointsData.transactions.map((t): TimelineEntry => ({ kind: "earn", data: t })),
                ...pointsData.redemptions.map((r): TimelineEntry => ({ kind: "redeem", data: r })),
              ].sort(
                (a, b) =>
                  new Date(b.data.createdAt).getTime() - new Date(a.data.createdAt).getTime()
              );

              if (entries.length === 0) {
                return (
                  <div className="flex flex-col items-center py-10 gap-2 text-center px-4">
                    <Trophy className="w-8 h-8 text-zinc-300" />
                    <p className="text-sm font-medium text-zinc-500">No points yet</p>
                    <p className="text-xs text-zinc-400">Complete missions or wait for your manager to recognize you!</p>
                  </div>
                );
              }

              const visible = entries.slice(0, visibleCount);
              return (
                <>
                  <ul className="divide-y divide-zinc-100">
                    {visible.map((entry) => {
                      if (entry.kind === "earn") {
                        const t = entry.data;
                        const meta = txTypeLabel[t.type] ?? { label: t.type, color: "text-zinc-600" };
                        const positive = t.amount >= 0;
                        return (
                          <li key={`earn-${t.id}`} className="flex items-center gap-4 px-5 py-3 hover:bg-zinc-50 transition-colors">
                            <span className={`shrink-0 text-xs font-bold px-2 py-0.5 rounded-full ${positive ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-500"}`}>
                              {positive ? "+" : ""}{t.amount.toLocaleString()} pts
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-zinc-900 truncate">{t.note ?? meta.label}</p>
                              <p className="text-xs text-zinc-400">
                                <span className={`font-medium ${meta.color}`}>{meta.label}</span>
                                {t.fromUser ? ` · from ${t.fromUser.displayName}` : ""}
                                {" · "}{new Date(t.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                          </li>
                        );
                      } else {
                        const r = entry.data;
                        return (
                          <li key={`redeem-${r.id}`} className="flex items-center gap-4 px-5 py-3 hover:bg-zinc-50 transition-colors">
                            <span className="shrink-0 text-xs font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-500">
                              -{r.pointsSpent.toLocaleString()} pts
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-zinc-900 truncate">{r.reward.name}</p>
                              <p className="text-xs text-zinc-400">
                                <span className="font-medium text-rose-500">Redemption</span>
                                {" · "}{new Date(r.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                          </li>
                        );
                      }
                    })}
                  </ul>
                  {entries.length > visibleCount && (
                    <div className="px-5 py-3 border-t border-zinc-100">
                      <button
                        onClick={() => setVisibleCount((c) => c + 10)}
                        className="text-sm text-navy-600 hover:text-navy-700 font-medium transition-colors"
                      >
                        Load more ({entries.length - visibleCount} remaining)
                      </button>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </>
      )}

      {/* ── Badges tab ── */}
      {activeTab === "badges" && (
        <div className="bg-white rounded-xl border border-zinc-200 p-5">
          <h2 className="text-sm font-bold text-zinc-800 mb-4 flex items-center gap-2">
            <Medal className="w-4 h-4 text-amber-500" />
            Badges
            <span className="text-xs font-normal text-zinc-400">({profile.userBadges.length})</span>
          </h2>
          {profile.userBadges.length === 0 ? (
            <div className="flex flex-col items-center py-8 gap-2 text-center">
              <Award className="w-10 h-10 text-zinc-300" />
              <p className="text-sm text-zinc-500 font-medium">No badges yet</p>
              <p className="text-xs text-zinc-400">Keep earning points to unlock your first badge!</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {profile.userBadges.map((ub) => {
                return (
                  <div
                    key={ub.id}
                    className="flex flex-col items-center gap-1.5 bg-zinc-50 border border-zinc-200 rounded-xl p-3 text-center"
                  >
                    <Award className="w-6 h-6 text-amber-500" />
                    <p className="text-xs font-semibold text-zinc-800">{ub.badge.name}</p>
                    {ub.badge.description && (
                      <p className="text-xs text-zinc-400 line-clamp-2">{ub.badge.description}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
