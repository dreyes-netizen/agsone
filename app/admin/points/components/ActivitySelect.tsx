import { AWARD_ACTIVITIES, AWARD_CATEGORIES, type AwardCategory } from "@/lib/constants/awardActivities";

export function ActivitySelect({ value, onChange }: { value: string; onChange: (key: string) => void }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-navy-500/30 bg-white"
    >
      <option value="">Custom amount…</option>
      {(Object.keys(AWARD_CATEGORIES) as AwardCategory[]).map((cat) => (
        <optgroup key={cat} label={AWARD_CATEGORIES[cat]}>
          {AWARD_ACTIVITIES.filter((a) => a.category === cat).map((a) => (
            <option key={a.key} value={a.key}>
              {a.label} ({a.points} pts)
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
