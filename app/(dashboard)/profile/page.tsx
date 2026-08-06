"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useApiClient } from "@/lib/hooks/useApiClient";
import { History, Medal, Trophy, Award, Bell, FileText, Tag, X, ShoppingBag, Gamepad2, Megaphone, Loader2, AlertCircle, Lock } from "lucide-react";
import { getLevelProgress } from "@/lib/helpers/levelUtils";

import type { UserProfile, PointsData, ShoutoutEntry, TimelineEntry, PointTx } from "./types";
import { getDaysUntil, getAnniversaryYear, ordinal, txTypeLabel, CATEGORY_BADGE } from "./utils";
import { CompletenessBar } from "./components/CompletenessBar";
import { MinigamesStatsCard } from "./components/MinigamesStatsCard";
import { ProfileHeaderCard } from "./components/ProfileHeaderCard";
import { ProfileOverviewCards } from "./components/ProfileOverviewCards";
import { ProfileTabBar } from "./components/ProfileTabBar";
import { ShoutoutsCard } from "./components/ShoutoutsCard";

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
    queueMicrotask(() => setNotifLoading(true));
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
          <ProfileOverviewCards profile={profile} />

          {/* Minigames stats */}
          <MinigamesStatsCard />

          {/* Bio */}
          <div className="bg-white rounded-card border border-table-border px-5 py-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-sky-50 flex items-center justify-center">
                <FileText className="w-4 h-4 text-sky-500" aria-hidden="true" />
              </div>
              <p className="text-sm font-semibold text-gray-800">About / Bio</p>
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
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-500/30 focus-visible:border-navy-400 transition resize-none"
                />
                <p className="text-xs text-gray-500">{bioEdit.length}/500</p>
              </>
            ) : (
              <p className="text-sm text-gray-600 leading-relaxed">
                {profile.bio || <span className="text-gray-500 italic">No bio yet. Click Edit Profile to add one.</span>}
              </p>
            )}
          </div>

          {/* Skills */}
          <div className="bg-white rounded-card border border-table-border px-5 py-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                <Tag className="w-4 h-4 text-emerald-500" aria-hidden="true" />
              </div>
              <p className="text-sm font-semibold text-gray-800">Skills</p>
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
                  placeholder="e.g. Leadership, Excel, Python…"
                  aria-label="Add a skill (press Enter to add)"
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-500/30 focus-visible:border-navy-400 transition"
                />
                <p className="text-xs text-gray-500">{skillsEdit.length}/20 skills</p>
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
                <div className="flex flex-col items-center gap-1 py-3 px-4 text-center bg-gray-50 rounded-lg">
                  <Tag className="w-4 h-4 text-gray-300" aria-hidden="true" />
                  <p className="text-xs font-medium text-gray-600">No skills added yet</p>
                  <p className="text-[10px] text-gray-400">Click <span className="font-medium text-gray-500">Edit Profile</span> to add some</p>
                </div>
              )
            )}
          </div>

          {/* Shoutouts Received */}
          <ShoutoutsCard shoutouts={shoutouts} />

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
                   className="flex-1 bg-command-black hover:bg-gray-800 text-white text-sm font-semibold py-2.5 rounded-xl transition disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-900 flex items-center justify-center gap-1.5"
                >
                  {profileSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />}
                  {profileSaving ? "Saving…" : "Save Profile"}
                </button>
                <button
                  onClick={handleCancelEdit}
                  disabled={profileSaving}
                  className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold text-gray-600 hover:text-gray-800 border border-gray-200 hover:border-gray-300 rounded-xl transition disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-900"
                >
                  <X className="w-3.5 h-3.5" aria-hidden="true" /> Cancel
                </button>
              </div>
            </>
          )}
        </>
        </div>
      )}

      {/* ── Points tab ── */}
      {activeTab === "points" && pointsData && (
        <div id="panel-points" role="tabpanel">
        <>
          {/* Balance card */}
          <div className="bg-white rounded-card border border-table-border p-5">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Current Balance</p>
                <p className="text-4xl font-black text-navy-600 leading-none mt-1">
                  {pointsData.balance.toLocaleString()}
                  <span className="text-lg font-semibold text-gray-500 ml-1">pts</span>
                </p>
              </div>
              <div className="text-right">
                <span className="inline-block bg-violet-100 text-violet-700 text-xs font-bold px-3 py-1 rounded-full">
                  Level {pointsData.level}
                </span>
                <p className="text-xs text-gray-500 mt-2">
                  Total earned:{" "}
                  <span className="font-semibold text-gray-700">
                    {pointsData.totalEarned.toLocaleString()} pts
                  </span>
                </p>
              </div>
            </div>
          </div>

          {/* Unified timeline */}
          <div className="bg-white rounded-card border border-table-border overflow-hidden">
            <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-2">
              <History className="w-4 h-4 text-gray-500" aria-hidden="true" />
              <h2 className="text-sm font-bold text-gray-800">Transaction History</h2>
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
                    <Trophy className="w-8 h-8 text-gray-300" aria-hidden="true" />
                    <p className="text-sm font-medium text-gray-500">No points yet</p>
                    <p className="text-xs text-gray-500">Earn points through recognition, milestones, or games!</p>
                  </div>
                );
              }

              const visible = entries.slice(0, visibleCount);
              return (
                <>
                  <ul className="divide-y divide-gray-100">
                    {visible.map((entry) => {
                      if (entry.kind === "earn") {
                        const t = entry.data;
                        const meta = txTypeLabel[t.type] ?? { label: t.type, color: "text-gray-600" };
                        const positive = t.amount >= 0;
                        return (
                          <li key={`earn-${t.id}`} className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50 transition-colors">
                            <span className={`shrink-0 text-xs font-bold px-2 py-0.5 rounded-full ${positive ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-500"}`}>
                              {positive ? "+" : ""}{t.amount.toLocaleString()} pts
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">{t.note ?? meta.label}</p>
                              <p className="text-xs text-gray-500">
                                <span className={`font-medium ${meta.color}`}>{meta.label}</span>
                                {t.category && CATEGORY_BADGE[t.category] && (
                                  <span className={`ml-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${CATEGORY_BADGE[t.category].style}`}>
                                    {CATEGORY_BADGE[t.category].label}
                                  </span>
                                )}
                                {t.fromUser ? ` · from ${t.fromUser.displayName}` : ""}
                                {" · "}{new Date(t.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                              </p>
                            </div>
                          </li>
                        );
                      } else {
                        const r = entry.data;
                        return (
                          <li key={`redeem-${r.id}`} className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50 transition-colors">
                            <span className="shrink-0 text-xs font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-500">
                              -{r.pointsSpent.toLocaleString()} pts
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">{r.reward.name}</p>
                              <p className="text-xs text-gray-500">
                                <span className="font-medium text-rose-500">Redemption</span>
                                {" · "}{new Date(r.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                              </p>
                            </div>
                          </li>
                        );
                      }
                    })}
                  </ul>
                  {entries.length > visibleCount && (
                    <div className="px-5 py-3 border-t border-gray-100">
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
        </div>
      )}

      {/* ── Badges tab ── */}
      {activeTab === "badges" && (
        <div id="panel-badges" role="tabpanel">
        <div className="bg-white rounded-card border border-table-border p-5">
          <h2 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Medal className="w-4 h-4 text-amber-500" aria-hidden="true" />
            Badges
            <span className="text-xs font-normal text-gray-500">({profile.userBadges.length})</span>
          </h2>
          {profile.userBadges.length === 0 ? (
            <div className="flex flex-col items-center py-8 gap-2 text-center">
              <Award className="w-10 h-10 text-gray-300" aria-hidden="true" />
              <p className="text-sm text-gray-500 font-medium">No badges yet</p>
              <p className="text-xs text-gray-500">Keep earning points to unlock your first badge!</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {profile.userBadges.map((ub) => {
                return (
                  <div
                    key={ub.id}
                    className="flex flex-col items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-xl p-3 text-center"
                  >
                    <Award className="w-6 h-6 text-amber-500" aria-hidden="true" />
                    <p className="text-xs font-semibold text-gray-800">{ub.badge.name}</p>
                    {ub.badge.description && (
                      <p className="text-xs text-gray-500 line-clamp-2">{ub.badge.description}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
        </div>
      )}

      {/* ── Notifications tab ── */}
      {activeTab === "notifications" && (
        <div id="panel-notifications" role="tabpanel">
        <div className="bg-white rounded-card border border-table-border overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-2">
            <Bell className="w-4 h-4 text-gray-500" aria-hidden="true" />
            <h2 className="text-sm font-bold text-gray-800 flex-1">Notification Preferences</h2>
            <span className="text-xs text-gray-500 w-9 text-center">In-App</span>
            <span className="text-xs text-gray-500 w-7 text-center">Email</span>
          </div>

          {notifLoading ? (
            <div role="status" aria-live="polite" className="flex items-center justify-center gap-2 p-8 text-gray-500 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Loading…
            </div>
          ) : notifError ? (
            <div className="p-8 text-center text-red-400 text-sm">{notifError}</div>
          ) : notifPrefs ? (
            <ul className="divide-y divide-gray-100">
              {[
                { type: "SHOUTOUT_RECEIVED", label: "Shoutout received", description: "When a colleague shouts you out" },
                { type: "POINTS_AWARDED",    label: "Points awarded",   description: "When an admin manually awards you points" },
                { type: "MILESTONE_REWARD",  label: "Milestone reward", description: "On your birthday or work anniversary" },
              ].map(({ type, label, description }) => {
                const enabled = notifPrefs[type] !== false;
                return (
                  <li key={type} className="flex items-center gap-4 px-5 py-4">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-800">{label}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{description}</p>
                    </div>
                    {/* In-app toggle */}
                    <button
                      role="switch"
                      aria-label={`${label} in-app notifications`}
                      aria-checked={enabled}
                      disabled={notifSaving === type}
                      onClick={() => handleNotifToggle(type, !enabled)}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-500 focus-visible:ring-offset-2 disabled:opacity-50 ${
                        enabled ? "bg-navy-500" : "bg-gray-200"
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
                            emailEnabled ? "bg-navy-500" : "bg-gray-200"
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
