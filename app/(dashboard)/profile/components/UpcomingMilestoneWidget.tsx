import type { UserProfile } from "../types";
import { getDaysUntil, getAnniversaryYear, ordinal } from "../utils";

interface UpcomingMilestoneWidgetProps {
  profile: UserProfile;
}

export function UpcomingMilestoneWidget({ profile }: UpcomingMilestoneWidgetProps) {
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
}
