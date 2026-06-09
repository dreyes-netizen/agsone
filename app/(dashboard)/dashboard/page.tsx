"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useApiClient } from "@/lib/hooks/useApiClient";
import Link from "next/link";
import {
  Rss, Gamepad2, ShoppingBag, Flame, Star, Coins,
  Target, Swords,
} from "lucide-react";
import { DashboardFeedCard } from "@/components/dashboard/DashboardFeedCard";


type UserProfile = {
  pointsBalance: number;
  level: number;
  streakDays: number;
  displayName: string;
  department: { id: string; name: string } | null;
};

type FeedPost = {
  id: string;
  type: string;
  title: string | null;
  content: string;
  createdAt: string;
  author: { id: string; displayName: string; avatarUrl: string | null; department: { name: string } | null };
  shoutoutRecipients: { id: string; userId: string; user: { id: string; displayName: string; avatarUrl: string | null } }[];
  flair: string | null;
  reactions: Record<string, number>;
  myReactions: string[];
  commentCount: number;
  imageUrls: string[];
  departmentId: string | null;
  department: { name: string } | null;
};

type LeaderboardEntry = {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  points: number;
  isCurrentUser: boolean;
};

type Challenge = {
  id: string;
  title: string;
  metric: string;
  targetValue: number;
  deptProgress: { deptId: string; deptName: string; progress: number }[];
};

type Mission = {
  id: string;
  title: string;
  pointsReward: number;
  myCompletion: { status: string } | null;
};

type BirthdayPerson = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  daysUntil: number;
};

const METRIC_LABEL: Record<string, string> = {
  TOTAL_POINTS: "pts earned",
  MISSIONS_COMPLETED: "missions done",
  SHOUTOUTS_SENT: "shoutouts sent",
};

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}


function Avatar({
  url, name, size = "w-8 h-8",
}: { url: string | null; name: string; size?: string }) {
  return url ? (
    <img src={url} alt={name} className={`${size} rounded-full object-cover shrink-0`} />
  ) : (
    <div className={`${size} rounded-full bg-zinc-200 flex items-center justify-center text-zinc-600 font-bold text-xs shrink-0`}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

function SectionHeader({ title, href }: { title: string; href: string }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="font-semibold text-zinc-900 text-sm">{title}</h2>
      <Link href={href} className="text-xs text-navy-600 hover:text-navy-700 font-medium">
        See all →
      </Link>
    </div>
  );
}

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const { apiFetch } = useApiClient();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [feedPosts, setFeedPosts] = useState<FeedPost[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [birthdays, setBirthdays] = useState<BirthdayPerson[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading || !user) return;
    Promise.allSettled([
      apiFetch<{ data: UserProfile }>("/api/me"),
      apiFetch<{ data: FeedPost[]; nextCursor: string | null }>("/api/feed?limit=5"),
      apiFetch<{ data: LeaderboardEntry[] }>("/api/leaderboard"),
      apiFetch<{ data: Challenge[] }>("/api/challenges"),
      apiFetch<{ data: Mission[] }>("/api/missions"),
      apiFetch<{ data: BirthdayPerson[] }>("/api/birthdays/upcoming"),
    ])
      .then(([me, feed, lb, ch, ms, bd]) => {
        if (me.status === "fulfilled") setProfile(me.value.data);
        if (feed.status === "fulfilled") setFeedPosts(feed.value.data ?? []);
        if (lb.status === "fulfilled") setLeaderboard(lb.value.data ?? []);
        if (ch.status === "fulfilled") setChallenges(ch.value.data ?? []);
        if (ms.status === "fulfilled") setMissions(ms.value.data ?? []);
        if (bd.status === "fulfilled") setBirthdays((bd.value.data ?? []).filter((b) => b.daysUntil <= 7));
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user]);

  const firstName = user?.displayName?.split(" ")[0] ?? "there";

  const availableMissions = missions.filter((m) => !m.myCompletion).slice(0, 2);

  const deptChallenge = (() => {
    if (!profile?.department) return null;
    for (const c of challenges) {
      const dp = c.deptProgress.find((d) => d.deptId === profile.department!.id);
      if (dp) return { challenge: c, dp };
    }
    return null;
  })();

  return (
    <div className="space-y-5">

      {/* ── Greeting ── */}
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

      {/* ── Compact stats strip ── */}
      <div className="bg-white border border-zinc-100 rounded-xl px-5 py-3 flex items-center divide-x divide-zinc-100">
        {[
          { icon: <Coins className="w-3.5 h-3.5 text-navy-500" />, label: "Points", value: profile?.pointsBalance?.toLocaleString() },
          { icon: <Star className="w-3.5 h-3.5 text-violet-500" />, label: "Level", value: profile?.level },
          { icon: <Flame className="w-3.5 h-3.5 text-orange-400" />, label: "Streak", value: profile ? `${profile.streakDays}d` : undefined },
        ].map(({ icon, label, value }) => (
          <div key={label} className="flex-1 flex items-center gap-2 px-4 first:pl-0 last:pr-0">
            {icon}
            <div>
              <p className="text-[10px] text-zinc-400 font-medium leading-none">{label}</p>
              <p className="text-sm font-bold text-zinc-900 leading-tight tabular-nums mt-0.5">
                {loading ? <span className="inline-block w-8 h-3.5 bg-zinc-100 animate-pulse rounded" /> : (value ?? "—")}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Two-column layout ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">

        {/* ════ LEFT COLUMN ════ */}
        <div className="space-y-6">

          {/* Feed widget */}
          <div>
            <SectionHeader title="What's happening" href="/feed" />
            <div className="space-y-2">
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="bg-white rounded-xl border border-zinc-100 p-4 animate-pulse">
                    <div className="flex gap-3">
                      <div className="w-8 h-8 rounded-full bg-zinc-100 shrink-0" />
                      <div className="flex-1 space-y-2">
                        <div className="h-3 bg-zinc-100 rounded w-1/3" />
                        <div className="h-3 bg-zinc-100 rounded w-full" />
                        <div className="h-3 bg-zinc-100 rounded w-2/3" />
                      </div>
                    </div>
                  </div>
                ))
              ) : feedPosts.length === 0 ? (
                <div className="bg-white rounded-xl border border-zinc-100 py-10 text-center">
                  <Rss className="w-6 h-6 text-zinc-300 mx-auto mb-2" />
                  <p className="text-sm text-zinc-400">No posts yet</p>
                </div>
              ) : (
                feedPosts.map((post) => (
                  <DashboardFeedCard key={post.id} post={post} />
                ))
              )}
            </div>
          </div>

          {/* Missions widget */}
          <div>
            <SectionHeader title="Missions" href="/missions" />
            {loading ? (
              <div className="bg-white rounded-xl border border-zinc-100 p-4 animate-pulse space-y-3">
                <div className="h-3 bg-zinc-100 rounded w-2/3" />
                <div className="h-3 bg-zinc-100 rounded w-1/2" />
              </div>
            ) : availableMissions.length === 0 ? (
              <div className="bg-white rounded-xl border border-zinc-100 py-8 text-center">
                <Target className="w-5 h-5 text-zinc-300 mx-auto mb-2" />
                <p className="text-sm text-zinc-400">No missions right now</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-zinc-100 divide-y divide-zinc-50">
                {availableMissions.map((m) => (
                  <Link key={m.id} href="/missions" className="flex items-center justify-between px-4 py-3 hover:bg-zinc-50/60 transition-colors">
                    <span className="text-sm text-zinc-800 font-medium truncate min-w-0 mr-3">{m.title}</span>
                    <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full shrink-0">
                      +{m.pointsReward.toLocaleString()} pts
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* ════ RIGHT COLUMN ════ */}
        <div className="space-y-4 sticky top-6 self-start">

          {/* My Stats */}
          <div className="bg-white rounded-xl border border-zinc-100 p-4">
            <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">My Stats</p>
            {loading ? (
              <div className="space-y-3 animate-pulse">
                <div className="h-8 bg-zinc-100 rounded w-1/2" />
                <div className="h-3 bg-zinc-100 rounded w-1/3" />
                <div className="h-3 bg-zinc-100 rounded w-1/4" />
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <p className="text-3xl font-black text-zinc-900 tabular-nums leading-none">
                    {profile?.pointsBalance?.toLocaleString() ?? "—"}
                  </p>
                  <p className="text-xs text-zinc-400 mt-1">points available</p>
                </div>
                <div className="flex items-center gap-4 pt-1 border-t border-zinc-50">
                  <div className="flex items-center gap-1.5">
                    <Star className="w-3.5 h-3.5 text-violet-500 shrink-0" />
                    <span className="text-sm font-bold text-violet-600">Lv {profile?.level ?? 1}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Flame className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                    <span className="text-sm font-bold text-orange-500">{profile?.streakDays ?? 0}d streak</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Top Performers widget */}
          <div className="bg-white rounded-xl border border-zinc-100 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-50">
              <div className="flex items-center gap-1.5">
                <Star className="w-3.5 h-3.5 text-yellow-500" />
                <span className="text-xs font-semibold text-zinc-700">Top Performers</span>
              </div>
              <Link href="/leaderboard" className="text-xs text-navy-600 hover:text-navy-700 font-medium">See all →</Link>
            </div>
            {loading ? (
              <div className="p-4 space-y-3 animate-pulse">
                {[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-8 bg-zinc-100 rounded" />)}
              </div>
            ) : leaderboard.length === 0 ? (
              <p className="text-xs text-zinc-400 text-center py-6">No data yet</p>
            ) : (
              <div>
                {leaderboard.slice(0, 5).map((entry) => (
                  <div key={entry.userId} className={`flex items-center gap-2.5 px-4 py-2.5 ${entry.isCurrentUser ? "bg-navy-50/50" : "hover:bg-zinc-50/60"} transition-colors`}>
                    <Link href={`/employees/${entry.userId}`}><Avatar url={entry.avatarUrl} name={entry.displayName} size="w-6 h-6" /></Link>
                    <Link href={`/employees/${entry.userId}`} className={`text-xs font-medium truncate flex-1 min-w-0 hover:underline ${entry.isCurrentUser ? "text-navy-700 font-semibold" : "text-zinc-700"}`}>
                      {entry.isCurrentUser ? `${entry.displayName} (You)` : entry.displayName}
                    </Link>
                    <span className="text-xs font-bold tabular-nums text-zinc-500 shrink-0">
                      {entry.points.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Department Challenge */}
          {!loading && deptChallenge && (
            <div className="bg-white rounded-xl border border-zinc-100 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-50">
                <div className="flex items-center gap-1.5">
                  <Swords className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="text-xs font-semibold text-zinc-700">Your Challenge</span>
                </div>
                <Link href="/challenges" className="text-xs text-navy-600 hover:text-navy-700 font-medium">See all →</Link>
              </div>
              <div className="px-4 py-3 space-y-2">
                <p className="text-xs font-semibold text-zinc-800">{deptChallenge.challenge.title}</p>
                <div className="flex items-center justify-between text-xs text-zinc-500">
                  <span>{profile?.department?.name}</span>
                  <span className="tabular-nums font-medium">
                    {deptChallenge.dp.progress.toLocaleString()} / {deptChallenge.challenge.targetValue.toLocaleString()} {METRIC_LABEL[deptChallenge.challenge.metric] ?? ""}
                  </span>
                </div>
                <div className="w-full bg-zinc-100 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-emerald-500 h-1.5 rounded-full transition-all"
                    style={{ width: `${Math.min((deptChallenge.dp.progress / deptChallenge.challenge.targetValue) * 100, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Upcoming Birthdays */}
          {!loading && birthdays.length > 0 && (
            <div className="bg-gradient-to-br from-pink-50 to-violet-50 border border-pink-100 rounded-xl px-4 py-3">
              <p className="text-xs font-semibold text-pink-500 uppercase tracking-wider mb-2.5">🎂 Birthdays</p>
              <div className="space-y-2">
                {birthdays.map((b) => (
                  <Link key={b.id} href={`/employees/${b.id}`} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                    <Avatar url={b.avatarUrl} name={b.displayName} size="w-7 h-7" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-zinc-900 truncate hover:underline">{b.displayName}</p>
                      <p className="text-[10px] text-zinc-400">
                        {b.daysUntil === 0 ? "Today 🎉" : b.daysUntil === 1 ? "Tomorrow" : `In ${b.daysUntil} days`}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Quick Actions */}
          <div className="grid grid-cols-2 gap-2">
            <Link
              href="/minigames"
              className="flex flex-col items-center gap-1.5 bg-white border border-zinc-100 rounded-xl py-3 px-2 hover:border-zinc-200 hover:shadow-sm transition-all text-center"
            >
              <Gamepad2 className="w-5 h-5 text-violet-500" />
              <span className="text-xs font-semibold text-zinc-700 leading-tight">Play a<br/>Minigame</span>
            </Link>
            <Link
              href="/marketplace"
              className="flex flex-col items-center gap-1.5 bg-white border border-zinc-100 rounded-xl py-3 px-2 hover:border-zinc-200 hover:shadow-sm transition-all text-center"
            >
              <ShoppingBag className="w-5 h-5 text-orange-400" />
              <span className="text-xs font-semibold text-zinc-700 leading-tight">Redeem<br/>Points</span>
            </Link>
          </div>

        </div>
      </div>
    </div>
  );
}
