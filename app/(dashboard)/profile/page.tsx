"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useApiClient } from "@/lib/hooks/useApiClient";
import { Award, ShoppingBag, Gamepad2, Megaphone, Loader2, Lock } from "lucide-react";
import { getLevelProgress } from "@/lib/helpers/levelUtils";

import type { UserProfile, PointsData, ShoutoutEntry, PointTx } from "./types";
import { getDaysUntil, getAnniversaryYear, ordinal, txTypeLabel } from "./utils";
import { BioSection } from "./components/BioSection";
import { SkillsSection } from "./components/SkillsSection";
import { BirthdayHireCard } from "./components/BirthdayHireCard";
import { CompletenessBar } from "./components/CompletenessBar";
import { MinigamesStatsCard } from "./components/MinigamesStatsCard";
import { OverviewStatsGrid } from "./components/OverviewStatsGrid";
import { ProfileEditActions } from "./components/ProfileEditActions";
import { PointsTab } from "./components/PointsTab";
import { BadgesTab } from "./components/BadgesTab";
import { NotificationsTab } from "./components/NotificationsTab";
import { ProfileHeaderCard } from "./components/ProfileHeaderCard";
import { ProfileTabBar } from "./components/ProfileTabBar";
import { ShoutoutsCard } from "./components/ShoutoutsCard";

export default function ProfilePage() {
  const { user: authUser, loading: authLoading } = useAuth();
  const { apiFetch } = useApiClient();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [pointsData, setPointsData] = useState<PointsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "points" | "badges" | "notifications">("overview");
  const [visibleCount, setVisibleCount] = useState(10);
  const [isEditing, setIsEditing] = useState(false);
  const [bioEdit, setBioEdit] = useState("");
  const [skillsEdit, setSkillsEdit] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [deptRank, setDeptRank] = useState<{ rank: number; total: number } | null>(null);
  const [shoutouts, setShoutouts] = useState<ShoutoutEntry[] | null>(null);

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

  if (loading || !profile) {
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-gray-500 text-sm" role="status" aria-live="polite">
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
      <ProfileHeaderCard
        profile={profile}
        activeTab={activeTab}
        isEditing={isEditing}
        onEditClick={() => setIsEditing(true)}
        levelPct={levelPct}
        pointsIntoLevel={pointsIntoLevel}
        pointsNeededForLevel={pointsNeededForLevel}
      />

      {/* ── Tab bar ── */}
      <ProfileTabBar activeTab={activeTab} onTabChange={(tab) => { setActiveTab(tab); setVisibleCount(10); }} />

      {/* ── Two-column layout ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6 items-start">
        {/* ── Left column: tab content ── */}
        <div className="space-y-5 min-w-0">

      {/* ── Overview tab ── */}
      {activeTab === "overview" && (
        <div id="panel-overview" role="tabpanel">
        <>
          <CompletenessBar profile={profile} />
          <OverviewStatsGrid profile={profile} />

          {/* Minigames stats */}
          <MinigamesStatsCard />

          {/* Details: Birthday + Hire Date */}
          <BirthdayHireCard profile={profile} />

          {/* Bio */}
          <BioSection bio={profile.bio} isEditing={isEditing} bioEdit={bioEdit} onBioChange={setBioEdit} />

          {/* Skills */}
          <SkillsSection
            skills={profile.skills}
            isEditing={isEditing}
            skillsEdit={skillsEdit}
            skillInput={skillInput}
            onSkillInputChange={setSkillInput}
            onSkillKeyDown={handleSkillKeyDown}
            onRemoveSkill={(skill) => setSkillsEdit((prev) => prev.filter((s) => s !== skill))}
          />

          {/* Shoutouts Received */}
          <ShoutoutsCard shoutouts={shoutouts} />

          {/* Save / Cancel — only in edit mode */}
          {isEditing && (
            <ProfileEditActions
              profileError={profileError}
              profileSaving={profileSaving}
              onSave={handleProfileSave}
              onCancel={handleCancelEdit}
            />
          )}
        </>
        </div>
      )}

      {/* ── Points tab ── */}
      {activeTab === "points" && pointsData && (
        <div id="panel-points" role="tabpanel">
          <PointsTab
            pointsData={pointsData}
            visibleCount={visibleCount}
            onLoadMore={() => setVisibleCount((c) => c + 10)}
          />
        </div>
      )}

      {/* ── Badges tab ── */}
      {activeTab === "badges" && (
        <div id="panel-badges" role="tabpanel">
          <BadgesTab userBadges={profile.userBadges} />
        </div>
      )}

      {/* ── Notifications tab ── */}
      {activeTab === "notifications" && (
        <div id="panel-notifications" role="tabpanel">
          <NotificationsTab />
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
              <div className="bg-white rounded-card border border-table-border px-5 py-4 space-y-2">
                <p className="text-xs text-gray-500 font-medium">Upcoming</p>
                {items.map((item) => (
                  <p key={item.label} className="text-sm font-semibold text-gray-800">
                    <span aria-hidden="true">{item.emoji}</span> {item.label}
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
                <p className="text-xs text-gray-400">No department assigned</p>
              )}
            </div>
          </Link>

          {/* Widget 2: Recent Activity */}
          <div className="bg-white rounded-card border border-table-border overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <p className="text-xs font-semibold text-gray-700">Recent Activity</p>
              <button onClick={() => setActiveTab("points")} className="text-xs text-navy-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-600 rounded">
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
                          <span className="text-[10px] font-semibold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full shrink-0">×{count}</span>
                        )}
                      </li>
                    );
                  });
                })()}
              </ul>
            ) : (
              <p className="text-xs text-gray-400 text-center py-4">No activity yet</p>
            )}
          </div>

          {/* Widget 3: Quick Actions */}
          <div className="bg-white rounded-card border border-table-border overflow-hidden">
            <p className="px-4 py-3 text-xs font-semibold text-gray-700 border-b border-gray-100">Quick Actions</p>
            <div className="divide-y divide-gray-100">
              {[
                { href: "/marketplace", icon: ShoppingBag, label: "Redeem Points",   color: "text-violet-500" },
                { href: "/minigames",   icon: Gamepad2,    label: "Play a Minigame", color: "text-indigo-500" },
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
                <button onClick={() => setActiveTab("badges")} className="text-xs text-navy-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-600 rounded">
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

        </div>{/* end right sidebar */}
      </div>{/* end grid */}

    </div>
  );
}
