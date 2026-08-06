import { Award } from "lucide-react";
import type { UserBadge } from "../types";

interface RecentBadgesWidgetProps {
  userBadges: UserBadge[];
  onSeeAll: () => void;
}

export function RecentBadgesWidget({ userBadges, onSeeAll }: RecentBadgesWidgetProps) {
  if (userBadges.length === 0) return null;
  return (
    <div className="bg-white rounded-card border border-table-border overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-700">Recent Badges</p>
        <button onClick={onSeeAll} className="text-xs text-navy-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-600 rounded">
          See all →
        </button>
      </div>
      <ul className="divide-y divide-gray-100">
        {userBadges.slice(0, 2).map((ub) => (
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
  );
}
