import { Loader2 } from "lucide-react";
import type { Department, Employee, Budget } from "../types";
import { ActivitySelect } from "./ActivitySelect";

interface BulkAwardFormProps {
  departments: Department[];
  filteredForBulk: Employee[];
  bulkSelected: Set<string>;
  allFilteredSelected: boolean;
  bulkDeptFilter: string;
  onDeptFilterChange: (value: string) => void;
  bulkAmount: string;
  onAmountChange: (value: string) => void;
  bulkNote: string;
  onNoteChange: (value: string) => void;
  bulkActivity: string;
  onActivityChange: (key: string) => void;
  bulkSubmitting: boolean;
  bulkSuccess: string;
  bulkError: string;
  onToggleEmployee: (id: string) => void;
  onToggleSelectAll: () => void;
  onSubmit: (e: React.FormEvent) => void;
  inputClass: string;
  budget: Budget | null;
}

export function BulkAwardForm(props: BulkAwardFormProps) {
  const {
    departments, filteredForBulk, bulkSelected, allFilteredSelected, bulkDeptFilter, onDeptFilterChange,
    bulkAmount, onAmountChange, bulkNote, onNoteChange, bulkActivity, onActivityChange,
    bulkSubmitting, bulkSuccess, bulkError, onToggleEmployee, onToggleSelectAll, onSubmit, inputClass, budget,
  } = props;

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {/* Department filter */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-gray-700">Filter by Department</label>
        <select
          value={bulkDeptFilter}
          onChange={(e) => onDeptFilterChange(e.target.value)}
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
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-gray-700">
            Select Recipients
            {bulkSelected.size > 0 && (
              <span className="ml-2 text-xs font-normal text-navy-600">
                {bulkSelected.size} selected
              </span>
            )}
          </label>
          <button
            type="button"
            onClick={onToggleSelectAll}
            className="text-xs text-navy-600 hover:text-navy-800 font-medium"
          >
            {allFilteredSelected ? "Deselect All" : "Select All"}
          </button>
        </div>

        <div className="border border-gray-200 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
          {filteredForBulk.length === 0 ? (
            <p className="text-center text-gray-500 text-sm py-6">No employees found</p>
          ) : (
            filteredForBulk.map((e, i) => (
              <label
                key={e.id}
                className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-gray-50 transition-colors ${
                  i !== 0 ? "border-t border-gray-100" : ""
                 } ${bulkSelected.has(e.id) ? "bg-navy-50/50" : ""}`}
              >
                <input
                  type="checkbox"
                  checked={bulkSelected.has(e.id)}
                  onChange={() => onToggleEmployee(e.id)}
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

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-gray-700">Activity</label>
        <ActivitySelect
          value={bulkActivity}
          onChange={onActivityChange}
        />
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
            onChange={(e) => onAmountChange(e.target.value)}
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
            onChange={(e) => onNoteChange(e.target.value)}
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
