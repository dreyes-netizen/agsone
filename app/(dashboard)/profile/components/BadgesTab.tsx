import { Medal, Award } from "lucide-react";
import type { UserBadge } from "../types";

interface BadgesTabProps {
  userBadges: UserBadge[];
}

export function BadgesTab({ userBadges }: BadgesTabProps) {
  return (
    <div className="bg-white rounded-card border border-table-border p-5">
      <h2 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
        <Medal className="w-4 h-4 text-amber-500" aria-hidden="true" />
        Badges
        <span className="text-xs font-normal text-gray-500">({userBadges.length})</span>
      </h2>
      {userBadges.length === 0 ? (
        <div className="flex flex-col items-center py-8 gap-2 text-center">
          <Award className="w-10 h-10 text-gray-300" aria-hidden="true" />
          <p className="text-sm text-gray-500 font-medium">No badges yet</p>
          <p className="text-xs text-gray-500">Keep earning points to unlock your first badge!</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {userBadges.map((ub) => {
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
  );
}
