"use client";

import { Loader2 } from "lucide-react";
import { useProfileActions } from "@/lib/hooks/useProfileActions";
import { ProfileHeader } from "@/components/profile/ProfileHeader";
import { ProfileTabs } from "@/components/profile/ProfileTabs";
import { OverviewTab } from "@/components/profile/OverviewTab";
import { PointsTab } from "@/components/profile/PointsTab";
import { BadgesTab } from "@/components/profile/BadgesTab";
import { NotificationsTab } from "@/components/profile/NotificationsTab";
import { ProfileSidebar } from "@/components/profile/ProfileSidebar";

export default function ProfilePage() {
  const {
    profile,
    pointsData,
    loading,
    loadError,
    activeTab, setActiveTab,
    notifPrefs,
    notifLoading,
    notifSaving,
    notifError,
    visibleCount, setVisibleCount,
    isEditing, setIsEditing,
    bioEdit, setBioEdit,
    skillsEdit, setSkillsEdit,
    skillInput, setSkillInput,
    profileSaving,
    profileError,
    deptRank,
    shoutouts,
    bannerPickerOpen, setBannerPickerOpen,
    loadProfile,
    handleProfileSave,
    handleCancelEdit,
    handleSkillKeyDown,
    handleNotifToggle,
    selectTab,
    handleBannerSelect,
  } = useProfileActions();

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

  return (
    <div className="space-y-5">

      {/* ── Profile card ── */}
      <ProfileHeader
        profile={profile}
        activeTab={activeTab}
        isEditing={isEditing}
        onStartEdit={() => setIsEditing(true)}
        bannerPickerOpen={bannerPickerOpen}
        onToggleBannerPicker={() => setBannerPickerOpen((o) => !o)}
        onBannerSelect={handleBannerSelect}
      />

      {/* ── Tab bar ── */}
      <ProfileTabs activeTab={activeTab} onSelectTab={selectTab} />

      {/* ── Two-column layout ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6 items-start">
        {/* ── Left column: tab content ── */}
        <div className="space-y-5 min-w-0">

          {/* ── Overview tab ── */}
          {activeTab === "overview" && (
            <div id="panel-overview" role="tabpanel">
              <OverviewTab
                profile={profile}
                isEditing={isEditing}
                bioEdit={bioEdit}
                setBioEdit={setBioEdit}
                skillsEdit={skillsEdit}
                setSkillsEdit={setSkillsEdit}
                skillInput={skillInput}
                setSkillInput={setSkillInput}
                onSkillKeyDown={handleSkillKeyDown}
                shoutouts={shoutouts}
                profileSaving={profileSaving}
                profileError={profileError}
                onSave={handleProfileSave}
                onCancel={handleCancelEdit}
              />
            </div>
          )}

          {/* ── Points tab ── */}
          {activeTab === "points" && pointsData && (
            <div id="panel-points" role="tabpanel">
              <PointsTab pointsData={pointsData} visibleCount={visibleCount} setVisibleCount={setVisibleCount} />
            </div>
          )}

          {/* ── Badges tab ── */}
          {activeTab === "badges" && (
            <div id="panel-badges" role="tabpanel">
              <BadgesTab badges={profile.userBadges} />
            </div>
          )}

          {/* ── Notifications tab ── */}
          {activeTab === "notifications" && (
            <div id="panel-notifications" role="tabpanel">
              <NotificationsTab
                notifLoading={notifLoading}
                notifError={notifError}
                notifPrefs={notifPrefs}
                notifSaving={notifSaving}
                onToggle={handleNotifToggle}
              />
            </div>
          )}

        </div>{/* end left column */}

        {/* ── Right sidebar ── */}
        <ProfileSidebar
          profile={profile}
          deptRank={deptRank}
          pointsData={pointsData}
          onViewPoints={() => setActiveTab("points")}
          onViewBadges={() => setActiveTab("badges")}
        />
      </div>{/* end grid */}

    </div>
  );
}
