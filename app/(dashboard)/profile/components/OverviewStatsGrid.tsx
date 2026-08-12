import { Star, Medal, Coins } from "lucide-react";
import type { UserProfile } from "../types";

interface OverviewStatsGridProps {
  profile: UserProfile;
}

export function OverviewStatsGrid({ profile }: OverviewStatsGridProps) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {[
        { icon: Coins, value: profile.pointsBalance.toLocaleString(), label: "Points Balance", color: "text-navy-600",   bg: "bg-navy-50",   hint: null },
        { icon: Star,  value: profile.level,                          label: "Level",          color: "text-navy-600",   bg: "bg-navy-50",   hint: null },
        { icon: Medal, value: profile.userBadges.length,              label: "Badges",         color: "text-amber-600",  bg: "bg-amber-50",  hint: null },
      ].map(({ icon: Icon, value, label, color, bg, hint }) => (
        <div key={label} className="bg-white rounded-card border border-table-border p-3 sm:p-4 flex flex-col gap-2">
          <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center`}>
            <Icon className={`w-4 h-4 ${color}`} aria-hidden="true" />
          </div>
          <p className={`text-2xl font-black leading-none ${color}`}>{value}</p>
          <p className="text-xs text-gray-500 font-medium">{label}</p>
          {hint && <p className="text-xs text-gray-500 italic leading-tight">{hint}</p>}
        </div>
      ))}
    </div>
  );
}
