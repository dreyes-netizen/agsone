"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useApiClient } from "@/lib/hooks/useApiClient";
import { Loader2 } from "lucide-react";
import { getLevelProgress } from "@/lib/helpers/levelUtils";

import type { UserProfile, PointsData, ShoutoutEntry } from "./types";
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
import { UpcomingMilestoneWidget } from "./components/UpcomingMilestoneWidget";
import { DepartmentRankWidget } from "./components/DepartmentRankWidget";
import { RecentActivityWidget } from "./components/RecentActivityWidget";
import { QuickActionsWidget } from "./components/QuickActionsWidget";
import { RecentBadgesWidget } from "./components/RecentBadgesWidget";
import { useRealtimeChannel } from "@/lib/hooks/useRealtimeChannel";
import { realtimeTopics } from "@/lib/realtime/topics";

export default function ProfilePage() {
  const { user: authUser, dbUser, loading: authLoading } = useAuth();
  const { apiFetch } = useApiClient();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [pointsData, setPointsData] = useState<PointsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
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

  function loadProfile() {
    if (authLoading || !authUser) return;
    setLoading(true);
    setLoadError(null);
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
    }).catch((err) => {
      setLoadError(err instanceof Error ? err.message : "Failed to load profile");
    }).finally(() => {
      setLoading(false);
    });
  }

  useEffect(() => {
    queueMicrotask(loadProfile);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, authUser, dbUser]);

  // Deep-link support (e.g. "View points history" from the Marketplace) —
  // read once on mount, client-only, so the SSR pass never touches `window`.
  // Deferred a microtask so setActiveTab doesn't run synchronously inside the
  // effect body (react-hooks/set-state-in-effect).
  useEffect(() => {
    queueMicrotask(() => {
      const tab = new URLSearchParams(window.location.search).get("tab");
      if (tab === "points" || tab === "badges" || tab === "notifications") {
        setActiveTab(tab);
      }
    });
  }, []);

  useRealtimeChannel(
    realtimeTopics.feed,
    () => {
      apiFetch<{ data: ShoutoutEntry[] }>("/api/me/shoutouts")
        .then((res) => setShoutouts(res.data))
        .catch(() => {});
    },
    { debounceMs: 300 },
  );

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

  useRealtimeChannel(
    realtimeTopics.leaderboard,
    () => {
      if (!profile?.department) return;
      apiFetch<{ data: Array<{ rank: number; isCurrentUser: boolean }> }>(
        `/api/leaderboard?departmentId=${profile.department.id}`,
      ).then((res) => {
        const me = res.data.find((entry) => entry.isCurrentUser);
        if (me) setDeptRank({ rank: me.rank, total: res.data.length });
      }).catch(() => {});
    },
    { debounceMs: 200 },
  );

  if (loadError && !profile) {
    return (
      <div role="alert" className="bg-red-50 border border-red-100 rounded-2xl p-6 text-center">
        <p className="text-red-600 font-medium text-sm">{loadError}</p>
        <button onClick={loadProfile} className="mt-3 text-xs text-red-500 underline hover:text-red-700">Try again</button>
      </div>
    );
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
          <UpcomingMilestoneWidget profile={profile} />

          {/* Widget 1: Department Rank */}
          <DepartmentRankWidget department={profile.department} deptRank={deptRank} />

          {/* Widget 2: Recent Activity */}
          <RecentActivityWidget pointsData={pointsData} onViewAll={() => setActiveTab("points")} />

          {/* Widget 3: Quick Actions */}
          <QuickActionsWidget />

          {/* Widget 4: Recent Badges */}
          <RecentBadgesWidget userBadges={profile.userBadges} onSeeAll={() => setActiveTab("badges")} />

        </div>{/* end right sidebar */}
      </div>{/* end grid */}

    </div>
  );
}
