"use client";

import { Loader2 } from "lucide-react";
import { ActivitySelect } from "@/components/admin/points/ActivitySelect";
import { EmployeeSelector } from "@/components/admin/points/EmployeeSelector";
import { inputClass } from "@/components/admin/points/shared";
import type { Department, Employee, Budget } from "@/lib/hooks/useAdminPointsActions";

export function BulkAwardForm({
  departments,
  bulkDeptFilter,
  setBulkDeptFilter,
  filteredForBulk,
  bulkSelected,
  toggleEmployee,
  allFilteredSelected,
  toggleSelectAll,
  bulkActivity,
  onBulkActivityChange,
  bulkAmount,
  setBulkAmount,
  bulkNote,
  setBulkNote,
  bulkSuccess,
  bulkError,
  bulkSubmitting,
  budget,
  onSubmit,
}: {
  departments: Department[];
  bulkDeptFilter: string;
  setBulkDeptFilter: (value: string) => void;
  filteredForBulk: Employee[];
  bulkSelected: Set<string>;
  toggleEmployee: (id: string) => void;
  allFilteredSelected: boolean;
  toggleSelectAll: () => void;
  bulkActivity: string;
  onBulkActivityChange: (key: string) => void;
  bulkAmount: string;
  setBulkAmount: (value: string) => void;
  bulkNote: string;
  setBulkNote: (value: string) => void;
  bulkSuccess: string;
  bulkError: string;
  bulkSubmitting: boolean;
  budget: Budget | null;
  onSubmit: (e: React.FormEvent) => void;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {/* Department filter */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-gray-700">Filter by Department</label>
        <select
          value={bulkDeptFilter}
          onChange={(e) => setBulkDeptFilter(e.target.value)}
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-navy-500/30 bg-white"
        >
          <option value="all">All Departments</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </div>

      {/* Employee checklist */}
      <EmployeeSelector
        employees={filteredForBulk}
        selected={bulkSelected}
        onToggle={toggleEmployee}
        allSelected={allFilteredSelected}
        onToggleAll={toggleSelectAll}
      />

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-gray-700">Activity</label>
        <ActivitySelect value={bulkActivity} onChange={onBulkActivityChange} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-gray-700">Points to Award</label>
          <input
            type="number"
            min={1}
            max={10000}
            placeholder="e.g. 100"
            value={bulkAmount}
            onChange={(e) => setBulkAmount(e.target.value)}
            required
            readOnly={!!bulkActivity}
            className={inputClass + (bulkActivity ? " bg-gray-50 text-gray-500 cursor-not-allowed" : "")}
          />
        </div>
        <div className="col-span-2 space-y-1.5">
          <label className="text-sm font-medium text-gray-700">Reason / Note</label>
          <textarea
            placeholder="e.g. Perfect attendance this month"
            value={bulkNote}
            onChange={(e) => setBulkNote(e.target.value)}
            required
            rows={2}
            className={inputClass + " resize-none"}
          />
        </div>
      </div>

      {bulkSuccess && <p className="text-emerald-600 text-sm">{bulkSuccess}</p>}
      {bulkError && <p className="text-red-500 text-sm">{bulkError}</p>}

      <button
        type="submit"
        disabled={bulkSubmitting || bulkSelected.size === 0 || !bulkAmount || !bulkNote || (budget !== null && !budget.isExempt && budget.remaining === 0)}
        className="bg-command-black text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-gray-800 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-900"
      >
        {bulkSubmitting ? (
          <span className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            Awarding…
          </span>
        ) : bulkSelected.size === 0
          ? "Select employees to award"
          : `Award ${bulkAmount || "—"} pts to ${bulkSelected.size} employee${bulkSelected.size !== 1 ? "s" : ""}`}
      </button>
    </form>
  );
}
