"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useApiClient } from "@/lib/hooks/useApiClient";
import { History, Star, Medal, Coins, CalendarDays, Trophy, Award, Bell, FileText, Tag, Pencil, X, ShoppingBag, Gamepad2, Megaphone, Palette, Loader2, AlertCircle, Lock } from "lucide-react";
import { getLevelProgress } from "@/lib/helpers/levelUtils";

type UserBadge = {
  id: string;
  awardedAt: string;
  badge: { name: string; description: string | null };
};

type ShoutoutEntry = {
  id: string;
  post: {
    id: string;
    content: string;
    createdAt: string;
    author: {
      id: string;
      displayName: string;
      avatarUrl: string | null;
      department: { name: string } | null;
    };
  };
};

type UserProfile = {
  id: string;
  displayName: string;
  email: string;
  avatarUrl: string | null;
  bannerUrl: string | null;
  role: string;
  pointsBalance: number;
  level: number;
  birthday: string | null;
  hireDate: string | null;
  bio: string | null;
  skills: string[];
  department: { id: string; name: string } | null;
  userBadges: UserBadge[];
};

type PointTx = {
  id: string;
  amount: number;
  type: string;
  note: string | null;
  category: string | null;
  activity: string | null;
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

function getTenure(hireDate: string): string {
  const years = Math.floor((Date.now() - new Date(hireDate).getTime()) / (1000 * 60 * 60 * 24 * 365));
  if (years < 1) return "< 1 yr at AGS";
  return `${years} yr${years > 1 ? "s" : ""} at AGS`;
}

const txTypeLabel: Record<string, { label: string; color: string }> = {
  MANUAL_AWARD: { label: "Award",      color: "text-emerald-600" },
  KPI:          { label: "KPI",        color: "text-navy-600" },
  CONTEST:      { label: "Contest",    color: "text-yellow-600" },
  REDEMPTION:   { label: "Redemption", color: "text-rose-500" },
  GAME_WIN:     { label: "Game Win",   color: "text-emerald-500" },
  GAME_SPEND:   { label: "Game",       color: "text-orange-500" },
  REFUND:       { label: "Refund",     color: "text-teal-600" },
  MILESTONE:    { label: "Milestone",  color: "text-amber-600" },
  DEDUCTION:    { label: "Violation Deduction", color: "text-red-600" },
};

const CATEGORY_BADGE: Record<string, { label: string; style: string }> = {
  PERFORMANCE: { label: "Performance", style: "bg-violet-50 text-violet-700" },
  TEAMWORK:    { label: "Teamwork",    style: "bg-blue-50 text-blue-700" },
  INNOVATION:  { label: "Innovation",  style: "bg-amber-50 text-amber-700" },
  LEADERSHIP:  { label: "Leadership",  style: "bg-emerald-50 text-emerald-700" },
};


const BANNER_COLOR_OPTIONS = [
  { key: "default",  gradient: "from-navy-500 to-violet-600" },
  { key: "ocean",    gradient: "from-blue-500 to-cyan-500" },
  { key: "forest",   gradient: "from-emerald-500 to-teal-600" },
  { key: "sunset",   gradient: "from-orange-500 to-rose-500" },
  { key: "midnight", gradient: "from-slate-800 to-zinc-700" },
  { key: "lavender", gradient: "from-violet-500 to-purple-600" },
  { key: "gold",     gradient: "from-amber-400 to-orange-500" },
  { key: "rose",     gradient: "from-rose-400 to-pink-500" },
] as const;

const BANNER_GRADIENTS: Record<string, string> = Object.fromEntries(
  BANNER_COLOR_OPTIONS.map(({ key, gradient }) => [key, gradient])
);

const roleLabel: Record<string, string> = {
  EMPLOYEE:    "Employee",
  MANAGER:     "Manager",
  HR_ADMIN:    "HR Admin",
  SUPER_ADMIN: "Super Admin",
};

const roleBadgeStyle: Record<string, string> = {
  EMPLOYEE:    "bg-zinc-100 text-zinc-700",
  MANAGER:     "bg-blue-50 text-blue-700",
  HR_ADMIN:    "bg-violet-50 text-violet-700",
  SUPER_ADMIN: "bg-red-50 text-red-700",
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
      <p className="text-xs text-zinc-500">
        Complete your profile to unlock features like milestone rewards and birthday bonuses.
      </p>
    </div>
  );
}

function MinigamesStatsCard() {
  const { apiFetch } = useApiClient();
  const router = useRouter();
  const [s, setS] = useState<{ wins: number; losses: number; draws: number; winRate: number; currentStreak: number; total: number } | null>(null);

  useEffect(() => {
    apiFetch<{ data: typeof s }>("/api/minigames/stats").then((r) => setS(r.data)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!s || s.total === 0) return null;

  return (
    <button
      onClick={() => router.push("/minigames/stats")}
      className="w-full text-left bg-white rounded-xl border border-zinc-200 px-5 py-4 hover:border-zinc-300 transition-colors"
    >
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-zinc-800 flex items-center gap-2"><span aria-hidden="true">🎮</span> Minigames</p>
        <span className="text-xs text-indigo-600 font-medium">View stats →</span>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-sm"><span className="font-bold text-emerald-600">{s.wins}</span> <span className="text-zinc-500">W</span></span>
        <span className="text-sm"><span className="font-bold text-rose-500">{s.losses}</span> <span className="text-zinc-500">L</span></span>
        <span className="text-sm"><span className="font-bold text-zinc-500">{s.draws}</span> <span className="text-zinc-500">D</span></span>
        <span className="text-sm"><span className="font-bold text-indigo-600">{s.winRate}%</span> <span className="text-zinc-500">win rate</span></span>
        {s.currentStreak > 0 && (
          <span className="text-xs font-semibold text-orange-600 bg-orange-50 rounded-full px-2 py-0.5"><span aria-hidden="true">🔥</span> {s.currentStreak}-win streak</span>
        )}
      </div>
    </button>
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
  const [activeTab, setActiveTab] = useState<"overview" | "points" | "badges" | "notifications">("overview");
  const [notifPrefs, setNotifPrefs] = useState<Record<string, boolean> | null>(null);
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifSaving, setNotifSaving] = useState<string | null>(null);
  const [notifError, setNotifError] = useState("");
  const [visibleCount, setVisibleCount] = useState(10);
  const [isEditing, setIsEditing] = useState(false);
  const [bioEdit, setBioEdit] = useState("");
  const [skillsEdit, setSkillsEdit] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [deptRank, setDeptRank] = useState<{ rank: number; total: number } | null>(null);
  const [shoutouts, setShoutouts] = useState<ShoutoutEntry[] | null>(null);
  const [bannerPickerOpen, setBannerPickerOpen] = useState(false);

  useEffect(() => {
    if (authLoading || !authUser) return;
    Promise.all([
      apiFetch<{ data: UserProfile }>("/api/me"),
      apiFetch<{ data: PointsData }>("/api/me/points"),
      apiFetch<{ data: ShoutoutEntry[] }>("/api/me/shoutouts").catch(() => ({ data: [] as ShoutoutEntry[] })),
    ]).then(([me, pts, shouts]) => {
      setProfile(me.data);
      setPointsData(pts.data);
      setBioEdit(me.data.bio ?? "");
      setSkillsEdit(me.data.skills ?? []);
      setShoutouts(shouts.data);
    }).catch(() => {
      // intentional: stop loading spinner on fetch failure
    }).finally(() => {
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, authUser]);

  async function handleProfileSave() {
    setProfileSaving(true);
    setProfileError("");
    try {
      await apiFetch("/api/me", {
        method: "PATCH",
        body: JSON.stringify({ bio: bioEdit, skills: skillsEdit }),
      });
      setProfile((p) => p ? { ...p, bio: bioEdit, skills: skillsEdit } : p);
      setIsEditing(false);
      setSkillInput("");
    } catch (err: unknown) {
      setProfileError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setProfileSaving(false);
    }
  }

  function handleCancelEdit() {
    setBioEdit(profile?.bio ?? "");
    setSkillsEdit(profile?.skills ?? []);
    setSkillInput("");
    setProfileError("");
    setIsEditing(false);
  }

  function handleSkillKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      const val = skillInput.trim().replace(/,/g, "");
      if (val && !skillsEdit.includes(val) && skillsEdit.length < 20) {
        setSkillsEdit([...skillsEdit, val]);
      }
      setSkillInput("");
    } else if (e.key === "Backspace" && !skillInput && skillsEdit.length > 0) {
      setSkillsEdit(skillsEdit.slice(0, -1));
    }
  }

  useEffect(() => {
    if (!profile?.department) return;
    apiFetch<{ data: Array<{ rank: number; isCurrentUser: boolean }> }>(
      `/api/leaderboard?departmentId=${profile.department.id}`
    ).then((res) => {
      const me = res.data.find((e) => e.isCurrentUser);
      if (me) setDeptRank({ rank: me.rank, total: res.data.length });
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.department?.id]);

  useEffect(() => {
    if (activeTab !== "notifications" || notifPrefs !== null) return;
    setNotifLoading(true);
    apiFetch<{ data: Record<string, boolean> }>("/api/me/notification-preferences")
      .then((res) => setNotifPrefs(res.data))
      .catch(() => setNotifError("Failed to load preferences"))
      .finally(() => setNotifLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  async function handleNotifToggle(type: string, value: boolean) {
    if (!notifPrefs) return;
    const previous = notifPrefs;
    setNotifPrefs({ ...notifPrefs, [type]: value });
    setNotifSaving(type);
    try {
      const res = await apiFetch<{ data: Record<string, boolean> }>(
        "/api/me/notification-preferences",
        { method: "PUT", body: JSON.stringify({ [type]: value }) }
      );
      setNotifPrefs(res.data);
    } catch {
      setNotifPrefs(previous);
      setNotifError("Failed to save preference");
    } finally {
      setNotifSaving(null);
    }
  }

  if (loading || !profile) {
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-zinc-500 text-sm" role="status" aria-live="polite">
        <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
        Loading profile…
      </div>
    );
  }

  const { pointsIntoLevel, pointsNeededForLevel } = getLevelProgress(profile.pointsBalance);
  const levelPct = Math.min(100, (pointsIntoLevel / pointsNeededForLevel) * 100);

  return (
    <div className="space-y-5">

      {/* ── Profile card ── */}
      <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
        {/* Top accent — color picker */}
        <div className={`h-24 bg-gradient-to-br ${BANNER_GRADIENTS[profile.bannerUrl ?? ""] ?? BANNER_GRADIENTS.default} relative`}>
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)", backgroundSize: "20px 20px" }} />
          <div className="absolute top-2 right-2">
            <button
              aria-label="Change banner color"
              aria-expanded={bannerPickerOpen}
              aria-haspopup="true"
              onClick={() => setBannerPickerOpen((o) => !o)}
              className="w-7 h-7 rounded-full bg-black/20 hover:bg-black/40 flex items-center justify-center text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <Palette className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
            {bannerPickerOpen && (
              <div className="absolute top-9 right-0 z-10 bg-white rounded-xl border border-zinc-200 shadow-lg p-3 w-48">
                <p className="text-xs text-zinc-500 font-medium mb-2">Banner color</p>
                <div className="grid grid-cols-4 gap-2">
                  {BANNER_COLOR_OPTIONS.map(({ key, gradient }) => (
                    <button
                      key={key}
                      onClick={async () => {
                        setBannerPickerOpen(false);
                        await apiFetch("/api/me", { method: "PATCH", body: JSON.stringify({ bannerUrl: key }) });
                        setProfile((p) => p ? { ...p, bannerUrl: key } : p);
                      }}
                      aria-label={`${key} banner color${(profile.bannerUrl === key || (!profile.bannerUrl && key === "default")) ? " (selected)" : ""}`}
                      className={`w-9 h-9 rounded-lg bg-gradient-to-br ${gradient} ring-2 transition-all focus-visible:outline-none focus-visible:ring-zinc-800 ${profile.bannerUrl === key || (!profile.bannerUrl && key === "default") ? "ring-zinc-800" : "ring-transparent hover:ring-zinc-400"}`}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
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
                {profile.hireDate && (
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-teal-50 text-teal-700">
                    {getTenure(profile.hireDate)}
                  </span>
                )}
              </div>
            </div>
            {activeTab === "overview" && !isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-800 border border-zinc-200 hover:border-zinc-300 rounded-lg px-3 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-900"
              >
                <Pencil className="w-3 h-3" aria-hidden="true" /> Edit Profile
              </button>
            )}
          </div>

          {/* Level progress */}
          <div className="mt-5 space-y-1.5">
            <div className="flex justify-between text-xs text-zinc-500 gap-2">
              <span className="font-medium shrink-0">Level {profile.level}</span>
              <span className="text-right shrink-0">{pointsIntoLevel.toLocaleString()} / {pointsNeededForLevel.toLocaleString()} pts to next</span>
            </div>
            <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-navy-500 rounded-full transition-all motion-safe:duration-700 motion-safe:[transition-timing-function:cubic-bezier(0.16,1,0.3,1)]"
                style={{ width: `${levelPct}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Tab bar ── */}
      <div role="tablist" className="flex gap-1 bg-zinc-100 p-1 rounded-xl">
        {(["overview", "points", "badges", "notifications"] as const).map((tab) => (
          <button
            key={tab}
            role="tab"
            aria-selected={activeTab === tab}
            onClick={() => { setActiveTab(tab); setVisibleCount(10); }}
            className={`flex-1 py-1.5 text-sm font-semibold rounded-lg capitalize transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-gray-900 ${
              activeTab === tab
                ? "bg-white text-zinc-900 shadow-sm"
                : "text-zinc-600 hover:text-zinc-800"
            }`}
          >
            {tab === "points" ? "Points" : tab === "badges" ? "Badges" : tab === "notifications" ? "Notifs" : "Overview"}
          </button>
        ))}
      </div>

      {/* ── Two-column layout ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6 items-start">
        {/* ── Left column: tab content ── */}
        <div className="space-y-5 min-w-0">

      {/* ── Overview tab ── */}
      {activeTab === "overview" && (
        <>
          <CompletenessBar profile={profile} />
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { icon: Coins, value: profile.pointsBalance.toLocaleString(), label: "Points Balance", color: "text-navy-600",   bg: "bg-navy-50",   hint: null },
              { icon: Star,  value: profile.level,                          label: "Level",          color: "text-violet-600", bg: "bg-violet-50", hint: null },
              { icon: Medal, value: profile.userBadges.length,              label: "Badges",         color: "text-amber-600",  bg: "bg-amber-50",  hint: null },
            ].map(({ icon: Icon, value, label, color, bg, hint }) => (
              <div key={label} className="bg-white rounded-xl border border-zinc-200 p-4 flex flex-col gap-2">
                <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center`}>
                  <Icon className={`w-4 h-4 ${color}`} />
                </div>
                <p className={`text-2xl font-black leading-none ${color}`}>{value}</p>
                <p className="text-xs text-zinc-500 font-medium">{label}</p>
                {hint && <p className="text-xs text-zinc-500 italic leading-tight">{hint}</p>}
              </div>
            ))}
          </div>

          {/* Minigames stats */}
          <MinigamesStatsCard />

          {/* Birthday */}
          <div className="bg-white rounded-xl border border-zinc-200 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center">
                <CalendarDays className="w-4 h-4 text-rose-500" />
              </div>
              <div>
                <p className="text-xs text-zinc-500 font-medium">Birthday</p>
                <p className="text-sm font-semibold text-zinc-800">
                  {profile.birthday
                    ? new Date(profile.birthday).toLocaleDateString(undefined, { month: "long", day: "numeric" })
                    : "Not set — contact HR to update"}
                </p>
              </div>
            </div>
          </div>
          {profile.hireDate && (
            <div className="bg-white rounded-xl border border-zinc-200 px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                  <Trophy className="w-4 h-4 text-blue-500" />
                </div>
                <div>
                  <p className="text-xs text-zinc-500 font-medium">Hire Date</p>
                  <p className="text-sm font-semibold text-zinc-800">
                    {new Date(profile.hireDate).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Bio */}
          <div className="bg-white rounded-xl border border-zinc-200 px-5 py-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-sky-50 flex items-center justify-center">
                <FileText className="w-4 h-4 text-sky-500" />
              </div>
              <p className="text-sm font-semibold text-zinc-800">About / Bio</p>
            </div>
            {isEditing ? (
              <>
                <label htmlFor="bio-edit" className="sr-only">Bio / About yourself</label>
                <textarea
                  id="bio-edit"
                  value={bioEdit}
                  onChange={(e) => setBioEdit(e.target.value)}
                  maxLength={500}
                  rows={3}
                  placeholder="Tell your colleagues a bit about yourself…"
                  className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 text-zinc-800 focus:outline-none focus:ring-2 focus:ring-navy-500/30 focus:border-navy-400 transition resize-none"
                />
                <p className="text-xs text-zinc-500">{bioEdit.length}/500</p>
              </>
            ) : (
              <p className="text-sm text-zinc-600 leading-relaxed">
                {profile.bio || <span className="text-zinc-500 italic">No bio yet. Click Edit Profile to add one.</span>}
              </p>
            )}
          </div>

          {/* Skills */}
          <div className="bg-white rounded-xl border border-zinc-200 px-5 py-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                <Tag className="w-4 h-4 text-emerald-500" />
              </div>
              <p className="text-sm font-semibold text-zinc-800">Skills</p>
            </div>
            {isEditing ? (
              <>
                {skillsEdit.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {skillsEdit.map((skill) => (
                      <span key={skill} className="inline-flex items-center gap-1 text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100 px-2.5 py-1 rounded-full">
                        {skill}
                        <button
                          aria-label={`Remove ${skill}`}
                          onClick={() => setSkillsEdit(skillsEdit.filter((s) => s !== skill))}
                          className="hover:text-blue-900 transition-colors ml-1 p-0.5 rounded focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500"
                        ><X className="w-3 h-3" aria-hidden="true" /></button>
                      </span>
                    ))}
                  </div>
                )}
                <input
                  type="text"
                  value={skillInput}
                  id="skill-input"
                  onChange={(e) => setSkillInput(e.target.value)}
                  onKeyDown={handleSkillKeyDown}
                  placeholder="Type a skill and press Enter…"
                  aria-label="Add a skill (press Enter to add)"
                  className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 text-zinc-800 focus:outline-none focus:ring-2 focus:ring-navy-500/30 focus:border-navy-400 transition"
                />
                <p className="text-xs text-zinc-500">{skillsEdit.length}/20 skills</p>
              </>
            ) : (
              profile.skills.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {profile.skills.map((skill) => (
                    <span key={skill} className="text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100 px-2.5 py-1 rounded-full">
                      {skill}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-zinc-500 italic">No skills added yet. Click Edit Profile to add some.</p>
              )
            )}
          </div>

          {/* Shoutouts Received */}
          {shoutouts !== null && (
            <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
              <div className="px-5 py-3.5 border-b border-zinc-100 flex items-center justify-between">
                <p className="text-sm font-semibold text-zinc-800"><span aria-hidden="true">💬</span> Shoutouts</p>
                <Link href="/feed" className="text-xs text-navy-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-600 rounded">See all →</Link>
              </div>
              {shoutouts.length === 0 ? (
                <p className="px-5 py-4 text-sm text-zinc-500 italic">No shoutouts yet — keep up the great work!</p>
              ) : (
                <ul className="divide-y divide-zinc-100">
                  {shoutouts.map((s) => (
                    <li key={s.id} className="flex gap-3 px-5 py-3">
                      <div className="w-8 h-8 rounded-full bg-navy-500 flex items-center justify-center text-white font-bold text-xs shrink-0 overflow-hidden">
                        {s.post.author.avatarUrl
                          ? <img src={s.post.author.avatarUrl} alt={s.post.author.displayName} className="w-full h-full object-cover" />
                          : s.post.author.displayName.charAt(0).toUpperCase()
                        }
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-zinc-800">{s.post.author.displayName}</p>
                        <p className="text-xs text-zinc-600 line-clamp-2 leading-relaxed">{s.post.content}</p>
                        <p className="text-xs text-zinc-500 mt-0.5">{new Date(s.post.createdAt).toLocaleDateString()}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Save / Cancel — only in edit mode */}
          {isEditing && (
            <>
              {profileError && (
                <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  {profileError}
                </div>
              )}
              <div className="flex gap-2">
                <button
                  onClick={handleProfileSave}
                  disabled={profileSaving}
                  className="flex-1 bg-[#111827] hover:bg-gray-800 text-white text-sm font-semibold py-2.5 rounded-xl transition disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-900 flex items-center justify-center gap-1.5"
                >
                  {profileSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />}
                  {profileSaving ? "Saving…" : "Save Profile"}
                </button>
                <button
                  onClick={handleCancelEdit}
                  disabled={profileSaving}
                  className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold text-zinc-600 hover:text-zinc-800 border border-zinc-200 hover:border-zinc-300 rounded-xl transition disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-900"
                >
                  <X className="w-3.5 h-3.5" aria-hidden="true" /> Cancel
                </button>
              </div>
            </>
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
                <p className="text-xs text-zinc-500 font-medium uppercase tracking-wide">Current Balance</p>
                <p className="text-4xl font-black text-navy-600 leading-none mt-1">
                  {pointsData.balance.toLocaleString()}
                  <span className="text-lg font-semibold text-zinc-500 ml-1">pts</span>
                </p>
              </div>
              <div className="text-right">
                <span className="inline-block bg-violet-100 text-violet-700 text-xs font-bold px-3 py-1 rounded-full">
                  Level {pointsData.level}
                </span>
                <p className="text-xs text-zinc-500 mt-2">
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
              <History className="w-4 h-4 text-zinc-500" />
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
                    <p className="text-xs text-zinc-500">Earn points through recognition, milestones, or games!</p>
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
                              <p className="text-xs text-zinc-500">
                                <span className={`font-medium ${meta.color}`}>{meta.label}</span>
                                {t.category && CATEGORY_BADGE[t.category] && (
                                  <span className={`ml-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${CATEGORY_BADGE[t.category].style}`}>
                                    {CATEGORY_BADGE[t.category].label}
                                  </span>
                                )}
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
                              <p className="text-xs text-zinc-500">
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
            <span className="text-xs font-normal text-zinc-500">({profile.userBadges.length})</span>
          </h2>
          {profile.userBadges.length === 0 ? (
            <div className="flex flex-col items-center py-8 gap-2 text-center">
              <Award className="w-10 h-10 text-zinc-300" />
              <p className="text-sm text-zinc-500 font-medium">No badges yet</p>
              <p className="text-xs text-zinc-500">Keep earning points to unlock your first badge!</p>
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
                      <p className="text-xs text-zinc-500 line-clamp-2">{ub.badge.description}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Notifications tab ── */}
      {activeTab === "notifications" && (
        <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-zinc-100 flex items-center gap-2">
            <Bell className="w-4 h-4 text-zinc-500" />
            <h2 className="text-sm font-bold text-zinc-800 flex-1">Notification Preferences</h2>
            <span className="text-xs text-zinc-500 w-9 text-center">In-App</span>
            <span className="text-xs text-zinc-500 w-7 text-center">Email</span>
          </div>

          {notifLoading ? (
            <div role="status" aria-live="polite" className="flex items-center justify-center gap-2 p-8 text-zinc-500 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Loading…
            </div>
          ) : notifError ? (
            <div className="p-8 text-center text-red-400 text-sm">{notifError}</div>
          ) : notifPrefs ? (
            <ul className="divide-y divide-zinc-100">
              {[
                { type: "SHOUTOUT_RECEIVED", label: "Shoutout received", description: "When a colleague shouts you out" },
                { type: "POINTS_AWARDED",    label: "Points awarded",   description: "When an admin manually awards you points" },
                { type: "MILESTONE_REWARD",  label: "Milestone reward", description: "On your birthday or work anniversary" },
              ].map(({ type, label, description }) => {
                const enabled = notifPrefs[type] !== false;
                return (
                  <li key={type} className="flex items-center gap-4 px-5 py-4">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-zinc-800">{label}</p>
                      <p className="text-xs text-zinc-500 mt-0.5">{description}</p>
                    </div>
                    {/* In-app toggle */}
                    <button
                      role="switch"
                      aria-label={`${label} in-app notifications`}
                      aria-checked={enabled}
                      disabled={notifSaving === type}
                      onClick={() => handleNotifToggle(type, !enabled)}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-500 focus-visible:ring-offset-2 disabled:opacity-50 ${
                        enabled ? "bg-navy-500" : "bg-zinc-200"
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ${
                          enabled ? "translate-x-4" : "translate-x-0"
                        }`}
                      />
                    </button>
                    {/* Email toggle */}
                    {(() => {
                      const emailKey = `${type}_EMAIL`;
                      const emailEnabled = notifPrefs[emailKey] === true;
                      const emailSaving = notifSaving === emailKey;
                      return (
                        <button
                          role="switch"
                          aria-label={`${label} email notifications`}
                          aria-checked={emailEnabled}
                          disabled={emailSaving}
                          onClick={() => handleNotifToggle(emailKey, !emailEnabled)}
                          className={`relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-500 focus-visible:ring-offset-2 disabled:opacity-50 ${
                            emailEnabled ? "bg-navy-500" : "bg-zinc-200"
                          }`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow ring-0 transition duration-200 ${
                              emailEnabled ? "translate-x-3" : "translate-x-0"
                            }`}
                          />
                        </button>
                      );
                    })()}
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
      )}

        </div>{/* end left column */}

        {/* ── Right sidebar ── */}
        <div className="space-y-4 sticky top-6 self-start">

          {/* Widget 0: Upcoming Milestone */}
          {(() => {
            const items: { emoji: string; label: string; daysUntil: number }[] = [];
            const dayLabel = (d: number) => d === 0 ? "Today!" : `in ${d} day${d === 1 ? "" : "s"}`;
            if (profile.birthday) {
              const d = getDaysUntil(profile.birthday);
              if (d <= 30) items.push({ emoji: "🎂", label: `Birthday ${dayLabel(d)}`, daysUntil: d });
            }
            if (profile.hireDate) {
              const d = getDaysUntil(profile.hireDate);
              if (d <= 30) {
                const yr = getAnniversaryYear(profile.hireDate);
                if (yr > 0) items.push({ emoji: "🎉", label: `${ordinal(yr)} anniversary ${dayLabel(d)}`, daysUntil: d });
              }
            }
            if (items.length === 0) return null;
            return (
              <div className="bg-white rounded-xl border border-zinc-200 px-5 py-4 space-y-2">
                <p className="text-xs text-zinc-500 font-medium">Upcoming</p>
                {items.map((item) => (
                  <p key={item.label} className="text-sm font-semibold text-zinc-800">
                    <span aria-hidden="true">{item.emoji}</span> {item.label}
                  </p>
                ))}
              </div>
            );
          })()}

          {/* Widget 1: Department Rank */}
          {profile.department && deptRank && (
            <Link href="/leaderboard">
              <div className="bg-white rounded-xl border border-zinc-200 px-5 py-4 hover:border-zinc-300 transition-colors">
                <p className="text-xs text-zinc-500 font-medium mb-2">Your Department Rank</p>
                <p className="text-2xl font-black text-navy-600">#{deptRank.rank}</p>
                <p className="text-xs text-zinc-500 mt-0.5">
                  in {profile.department.name} · of {deptRank.total}
                </p>
              </div>
            </Link>
          )}

          {/* Widget 2: Recent Activity */}
          {pointsData && pointsData.transactions.length > 0 && (
            <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-100 flex items-center justify-between">
                <p className="text-xs font-semibold text-zinc-700">Recent Activity</p>
                <button onClick={() => setActiveTab("points")} className="text-xs text-navy-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-600 rounded">
                  View all →
                </button>
              </div>
              <ul className="divide-y divide-zinc-100">
                {pointsData.transactions.slice(0, 3).map((t) => {
                  const positive = t.amount >= 0;
                  const meta = txTypeLabel[t.type] ?? { label: t.type, color: "text-zinc-600" };
                  return (
                    <li key={t.id} className="flex items-center gap-3 px-4 py-2.5">
                      <span className={`text-xs font-bold shrink-0 ${positive ? "text-emerald-600" : "text-rose-500"}`}>
                        {positive ? "+" : ""}{t.amount}
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-zinc-800 truncate">{t.note ?? meta.label}</p>
                        <p className="text-xs text-zinc-500">{new Date(t.createdAt).toLocaleDateString()}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* Widget 3: Quick Actions */}
          <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
            <p className="px-4 py-3 text-xs font-semibold text-zinc-700 border-b border-zinc-100">Quick Actions</p>
            <div className="divide-y divide-zinc-100">
              {[
                { href: "/marketplace", icon: ShoppingBag, label: "Redeem Points",   color: "text-violet-500" },
                { href: "/minigames",   icon: Gamepad2,    label: "Play a Minigame", color: "text-indigo-500" },
                { href: "/feed",        icon: Megaphone,   label: "Send a Shoutout", color: "text-emerald-500" },
              ].map(({ href, icon: Icon, label, color }) => (
                <Link key={href} href={href} className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-50 transition-colors">
                  <Icon className={`w-4 h-4 shrink-0 ${color}`} />
                  <span className="text-sm font-medium text-zinc-700">{label}</span>
                </Link>
              ))}
            </div>
          </div>

          {/* Widget 4: Recent Badges */}
          {profile.userBadges.length > 0 && (
            <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-100 flex items-center justify-between">
                <p className="text-xs font-semibold text-zinc-700">Recent Badges</p>
                <button onClick={() => setActiveTab("badges")} className="text-xs text-navy-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-600 rounded">
                  See all →
                </button>
              </div>
              <ul className="divide-y divide-zinc-100">
                {profile.userBadges.slice(0, 2).map((ub) => (
                  <li key={ub.id} className="flex items-center gap-3 px-4 py-2.5">
                    <Award className="w-4 h-4 text-amber-500 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-zinc-800 truncate">{ub.badge.name}</p>
                      <p className="text-xs text-zinc-500">{new Date(ub.awardedAt).toLocaleDateString()}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

        </div>{/* end right sidebar */}
      </div>{/* end grid */}

    </div>
  );
}
