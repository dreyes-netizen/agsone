import { Loader2 } from "lucide-react";
import type { Employee } from "../types";
import { ActivitySelect } from "./ActivitySelect";

interface SingleAwardFormProps {
  employees: Employee[];
  currentUserId: string | undefined;
  toUserId: string;
  onToUserChange: (value: string) => void;
  amount: string;
  onAmountChange: (value: string) => void;
  note: string;
  onNoteChange: (value: string) => void;
  activity: string;
  onActivityChange: (key: string) => void;
  submitting: boolean;
  success: string;
  error: string;
  onSubmit: (e: React.FormEvent) => void;
  inputClass: string;
}

export function SingleAwardForm(props: SingleAwardFormProps) {
  const {
    employees, currentUserId, toUserId, onToUserChange, amount, onAmountChange,
    note, onNoteChange, activity, onActivityChange, submitting, success, error, onSubmit, inputClass,
  } = props;

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-gray-700">Employee</label>
        <select
          value={toUserId}
          onChange={(e) => e.target.value && onToUserChange(e.target.value)}
          required
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-navy-500/30 bg-white"
        >
          <option value="">Select an employee...</option>
          {employees
            .filter((e) => e.id !== currentUserId)
            .map((e) => (
              <option key={e.id} value={e.id}>
                {e.displayName} — {e.pointsBalance} pts
              </option>
            ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-gray-700">Activity</label>
        <ActivitySelect
          value={activity}
          onChange={onActivityChange}
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-gray-700">Points to Award</label>
        <input
          type="number"
          min={1}
          max={10000}
          placeholder="e.g. 100"
          value={amount}
          onChange={(e) => onAmountChange(e.target.value)}
          required
          readOnly={!!activity}
          className={inputClass + (activity ? " bg-gray-50 text-gray-500 cursor-not-allowed" : "")}
        />
        {activity && (
          <p className="text-xs text-gray-500">Standard amount from the program manual — select &quot;Custom amount…&quot; to enter a different value.</p>
        )}
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-gray-700">Reason / Note</label>
        <textarea
          placeholder="e.g. Perfect attendance this month"
          value={note}
          onChange={(e) => onNoteChange(e.target.value)}
          required
          rows={3}
          className={inputClass + " resize-none"}
        />
      </div>

      {success && <p className="text-emerald-600 text-sm">{success}</p>}
      {error && <p className="text-red-500 text-sm">{error}</p>}

      <button
        type="submit"
        disabled={submitting || !toUserId}
        className="bg-command-black text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-gray-800 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-900"
      >
        {submitting ? (
          <span className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            Awarding…
          </span>
        ) : "Award Points"}
      </button>
    </form>
  );
}
