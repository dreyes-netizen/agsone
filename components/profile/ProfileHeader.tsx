"use client";

import { Pencil } from "lucide-react";
import { getLevelProgress } from "@/lib/helpers/levelUtils";
import { RoleBadge } from "@/components/RoleBadge";
import { PlayerAvatar } from "@/components/profile/PlayerAvatar";
import { BannerColorPicker, BANNER_GRADIENTS } from "@/components/profile/BannerColorPicker";
import type { UserProfile, ProfileTab } from "@/lib/hooks/useProfileActions";

function getTenure(hireDate: string): string {
  const years = Math.floor((Date.now() - new Date(hireDate).getTime()) / (1000 * 60 * 60 * 24 * 365));
  if (years < 1) return "< 1 yr at AGS";
  return `${years} yr${years > 1 ? "s" : ""} at AGS`;
}

export function ProfileHeader({
  profile,
  activeTab,
  isEditing,
  onStartEdit,
  bannerPickerOpen,
  onToggleBannerPicker,
  onBannerSelect,
}: {
  profile: UserProfile;
  activeTab: ProfileTab;
  isEditing: boolean;
  onStartEdit: () => void;
  bannerPickerOpen: boolean;
  onToggleBannerPicker: () => void;
  onBannerSelect: (key: string) => void;
}) {
  const { pointsIntoLevel, pointsNeededForLevel } = getLevelProgress(profile.pointsBalance);
  const levelPct = Math.min(100, (pointsIntoLevel / pointsNeededForLevel) * 100);

  return (
    <div className="bg-white rounded-card border border-table-border overflow-hidden">
      {/* Top accent — color picker */}
      <div className={`h-20 bg-gradient-to-br ${BANNER_GRADIENTS[profile.bannerUrl ?? ""] ?? BANNER_GRADIENTS.default} relative`}>
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)", backgroundSize: "20px 20px" }} />
        <BannerColorPicker
          bannerUrl={profile.bannerUrl}
          open={bannerPickerOpen}
          onToggle={onToggleBannerPicker}
          onSelect={onBannerSelect}
        />
      </div>

      <div className="px-6 pb-6 relative">
        {/* Avatar */}
        <div className="-mt-10 mb-3">
          <PlayerAvatar name={profile.displayName} url={profile.avatarUrl} />
        </div>

        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900">{profile.displayName}</h1>
            <p className="text-sm text-gray-500 mt-0.5">{profile.email}</p>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <RoleBadge role={profile.role} />
              {profile.department && (
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-600">
                  {profile.department.name}
                </span>
              )}
              {profile.hireDate && (
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-navy-50 text-navy-700">
                  {getTenure(profile.hireDate)}
                </span>
              )}
            </div>
          </div>
          {activeTab === "overview" && !isEditing && (
            <button
              onClick={onStartEdit}
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 border border-gray-200 hover:border-gray-300 rounded-lg px-3 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-900"
            >
              <Pencil className="w-3 h-3" aria-hidden="true" /> Edit Profile
            </button>
          )}
        </div>

        {/* Level progress */}
        <div className="mt-5 space-y-1.5">
          <div className="flex justify-between text-xs text-gray-500 gap-2">
            <span className="font-medium shrink-0">Level {profile.level}</span>
            <span className="text-right shrink-0">{pointsIntoLevel.toLocaleString()} / {pointsNeededForLevel.toLocaleString()} pts to next</span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-navy-500 rounded-full transition-all motion-safe:duration-700 motion-safe:[transition-timing-function:cubic-bezier(0.16,1,0.3,1)]"
              style={{ width: `${levelPct}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
