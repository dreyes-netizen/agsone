import { CalendarDays, Trophy } from "lucide-react";
import type { UserProfile } from "../types";

interface BirthdayHireCardProps {
  profile: UserProfile;
}

export function BirthdayHireCard({ profile }: BirthdayHireCardProps) {
  return (
    <div className="bg-white rounded-card border border-table-border px-5 py-4">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center">
          <CalendarDays className="w-4 h-4 text-rose-500" aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-500 font-medium">Birthday</p>
          <p className="text-sm font-semibold text-gray-800">
            {profile.birthday
              ? new Date(profile.birthday).toLocaleDateString(undefined, { month: "long", day: "numeric", timeZone: "UTC" })
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
                {new Date(profile.hireDate).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" })}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
