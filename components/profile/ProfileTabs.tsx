"use client";

import type { ProfileTab } from "@/lib/hooks/useProfileActions";

export function ProfileTabs({
  activeTab,
  onSelectTab,
}: {
  activeTab: ProfileTab;
  onSelectTab: (tab: ProfileTab) => void;
}) {
  return (
    <div role="tablist" aria-label="Profile sections" className="flex gap-1 bg-gray-100 p-1 rounded-xl">
      {(["overview", "points", "badges", "notifications"] as const).map((tab) => (
        <button
          key={tab}
          role="tab"
          aria-selected={activeTab === tab}
          aria-controls={`panel-${tab}`}
          tabIndex={activeTab === tab ? 0 : -1}
          onClick={() => onSelectTab(tab)}
          className={`flex-1 py-1.5 text-sm font-semibold rounded-lg capitalize transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-gray-900 ${
            activeTab === tab
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-600 hover:text-gray-800"
          }`}
        >
          {tab === "points" ? "Points" : tab === "badges" ? "Badges" : tab === "notifications" ? "Notifs" : "Overview"}
        </button>
      ))}
    </div>
  );
}
