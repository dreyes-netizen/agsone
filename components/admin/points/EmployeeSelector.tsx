"use client";

import type { Employee } from "@/lib/hooks/useAdminPointsActions";

// Recipient checklist for the Bulk Award form
export function EmployeeSelector({
  employees,
  selected,
  onToggle,
  allSelected,
  onToggleAll,
}: {
  employees: Employee[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  allSelected: boolean;
  onToggleAll: () => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-700">
          Select Recipients
          {selected.size > 0 && (
            <span className="ml-2 text-xs font-normal text-navy-600">
              {selected.size} selected
            </span>
          )}
        </label>
        <button
          type="button"
          onClick={onToggleAll}
          className="text-xs text-navy-600 hover:text-navy-800 font-medium"
        >
          {allSelected ? "Deselect All" : "Select All"}
        </button>
      </div>

      <div className="border border-gray-200 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
        {employees.length === 0 ? (
          <p className="text-center text-gray-500 text-sm py-6">No employees found</p>
        ) : (
          employees.map((e, i) => (
            <label
              key={e.id}
              className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-gray-50 transition-colors ${
                i !== 0 ? "border-t border-gray-100" : ""
               } ${selected.has(e.id) ? "bg-navy-50/50" : ""}`}
            >
              <input
                type="checkbox"
                checked={selected.has(e.id)}
                onChange={() => onToggle(e.id)}
                 className="rounded border-gray-300 text-navy-600 focus:ring-navy-500/30"
              />
              <span className="flex-1 text-sm text-gray-800">{e.displayName}</span>
              {e.department && (
                <span className="text-xs text-gray-500">{e.department.name}</span>
              )}
              <span className="text-xs text-gray-500">{e.pointsBalance} pts</span>
            </label>
          ))
        )}
      </div>
    </div>
  );
}
