"use client";

import type { UserProfile } from "@/lib/hooks/useProfileActions";

export function CompletenessBar({ profile }: { profile: UserProfile }) {
  const items = [
    { label: "Display name", done: !!profile.displayName },
    { label: "Profile photo", done: !!profile.avatarUrl },
    { label: "Birthday", done: !!profile.birthday, hint: "Set it on this page" },
    { label: "Department", done: !!profile.department, hint: "Contact HR to assign" },
  ];
  const doneCount = items.filter((i) => i.done).length;
  const pct = Math.round((doneCount / items.length) * 100);
  if (pct === 100) return null;

  return (
    <div className="bg-white rounded-card border border-table-border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-700">Profile completeness</p>
        <span className="text-sm font-bold text-navy-600">{pct}%</span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-1.5">
        <div
          className="bg-navy-500 h-1.5 rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <span
            key={item.label}
            className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border font-medium ${
              item.done
                ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                : "bg-gray-50 border-gray-200 text-gray-500"
            }`}
            title={!item.done && item.hint ? item.hint : undefined}
          >
            {item.done ? (
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
            {item.label}
          </span>
        ))}
      </div>
      <p className="text-xs text-gray-500">
        Complete your profile to unlock features like milestone rewards and birthday bonuses.
      </p>
    </div>
  );
}
