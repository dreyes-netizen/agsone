"use client";

import {
  HR_REQUEST_CATEGORIES,
  HR_QUICK_PICKS,
  findHrCategory,
} from "@/lib/constants/hrRequests";

const SELECT_CLASS =
  "w-full border border-gray-300 bg-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-400";

/**
 * Quick-pick chips for the handful of requests HR receives most, with the full
 * catalog behind two dropdowns. The chips keep the one-tap feel of the old
 * subject presets; the dropdowns are what let ~40 request types exist without
 * a wall of buttons.
 */
export function HrRequestPicker({
  categoryId,
  typeId,
  onPick,
  onCategoryChange,
}: {
  categoryId: string;
  typeId: string;
  onPick: (categoryId: string, typeId: string) => void;
  onCategoryChange: (categoryId: string) => void;
}) {
  const category = findHrCategory(categoryId);

  return (
    <div className="space-y-4">
      <div>
        <p className="block text-sm font-medium text-gray-700 mb-2">Common requests</p>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Common requests">
          {HR_QUICK_PICKS.map(({ type, category: quickCategory }) => {
            const active = typeId === type.id;
            return (
              <button
                key={type.id}
                type="button"
                aria-pressed={active}
                onClick={() => onPick(quickCategory.id, type.id)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 ${
                  active
                    ? "border-command-black bg-command-black text-white"
                    : "border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
              >
                {type.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label htmlFor="hr-category" className="block text-sm font-medium text-gray-700 mb-1">
            Category
          </label>
          <select
            id="hr-category"
            value={categoryId}
            onChange={(e) => onCategoryChange(e.target.value)}
            className={SELECT_CLASS}
          >
            <option value="">Select a category…</option>
            {HR_REQUEST_CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="hr-type" className="block text-sm font-medium text-gray-700 mb-1">
            Request type
          </label>
          <select
            id="hr-type"
            value={typeId}
            disabled={!category}
            onChange={(e) => onPick(categoryId, e.target.value)}
            className={`${SELECT_CLASS} disabled:bg-gray-50 disabled:text-gray-400`}
          >
            <option value="">{category ? "Select a request…" : "Pick a category first"}</option>
            {category?.types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
