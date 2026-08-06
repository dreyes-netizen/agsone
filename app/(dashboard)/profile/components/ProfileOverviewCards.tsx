import { Star, Medal, Coins, CalendarDays, Trophy } from "lucide-react";
import type { UserProfile } from "../types";

interface ProfileOverviewCardsProps {
  profile: UserProfile;
}

export function ProfileOverviewCards({ profile }: ProfileOverviewCardsProps) {
  return (
    <>
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { icon: Coins, value: profile.pointsBalance.toLocaleString(), label: "Points Balance", color: "text-navy-600",   bg: "bg-navy-50",   hint: null },
          { icon: Star,  value: profile.level,                          label: "Level",          color: "text-violet-600", bg: "bg-violet-50", hint: null },
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

      {/* Details: Birthday + Hire Date */}
      <div className="bg-white rounded-card border border-table-border px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center">
            <CalendarDays className="w-4 h-4 text-rose-500" aria-hidden="true" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-500 font-medium">Birthday</p>
            <p className="text-sm font-semibold text-gray-800">
              {profile.birthday
                ? new Date(profile.birthday).toLocaleDateString(undefined, { month: "long", day: "numeric" })
                : "Not set"}
            </p>
          </div>
          {profile.hireDate && (
            <div className="flex items-center gap-3 pl-4 border-l border-gray-100">
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                <Trophy className="w-4 h-4 text-blue-500" aria-hidden="true" />
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium">Hire Date</p>
                <p className="text-sm font-semibold text-gray-800">
                  {new Date(profile.hireDate).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
