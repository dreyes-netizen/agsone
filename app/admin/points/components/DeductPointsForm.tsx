import { Loader2 } from "lucide-react";
import { VIOLATION_TYPES } from "@/lib/constants/awardActivities";
import type { Employee } from "../types";

interface DeductPointsFormProps {
  employees: Employee[];
  deductUserId: string;
  onUserChange: (value: string) => void;
  deductViolation: string;
  onViolationChange: (value: string) => void;
  deductCustomAmount: string;
  onCustomAmountChange: (value: string) => void;
  deductReason: string;
  onReasonChange: (value: string) => void;
  deductSubmitting: boolean;
  deductSuccess: string;
  deductError: string;
  onSubmit: (e: React.FormEvent) => void;
  inputClass: string;
}

export function DeductPointsForm(props: DeductPointsFormProps) {
  const {
    employees, deductUserId, onUserChange, deductViolation, onViolationChange,
    deductCustomAmount, onCustomAmountChange, deductReason, onReasonChange,
    deductSubmitting, deductSuccess, deductError, onSubmit, inputClass,
  } = props;

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-gray-700">Employee</label>
        <select
          value={deductUserId}
          onChange={(e) => onUserChange(e.target.value)}
          required
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-navy-500/30 bg-white"
        >
          <option value="">Select an employee...</option>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>
              {e.displayName} — {e.pointsBalance} pts
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-gray-700">Violation</label>
        <select
          value={deductViolation}
          onChange={(e) => onViolationChange(e.target.value)}
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-navy-500/30 bg-white"
        >
          {VIOLATION_TYPES.map((v) => (
            <option key={v.key} value={v.key}>
              {v.label} (−{v.points} pts)
            </option>
          ))}
          <option value="CUSTOM">Custom amount…</option>
        </select>
      </div>

      {deductViolation === "CUSTOM" && (
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-gray-700">Points to Deduct</label>
          <input
            type="number"
            min={1}
            max={1000}
            placeholder="e.g. 50"
            value={deductCustomAmount}
            onChange={(e) => onCustomAmountChange(e.target.value)}
            required
            className={inputClass}
          />
        </div>
      )}

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-gray-700">Reason</label>
        <textarea
          placeholder="Describe the violation — the employee will see this"
          value={deductReason}
          onChange={(e) => onReasonChange(e.target.value)}
          required
          rows={3}
          className={inputClass + " resize-none"}
        />
      </div>

      {deductUserId && (
        <p className="text-sm text-red-600 font-medium">
          This will deduct {deductViolation === "CUSTOM" ? (deductCustomAmount || "—") : VIOLATION_TYPES.find((v) => v.key === deductViolation)?.points} pts from {employees.find((e) => e.id === deductUserId)?.displayName}.
        </p>
      )}

      <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
        <p className="text-xs text-amber-700">
          The employee will be notified and this action will be logged for audit.
        </p>
      </div>

      {deductSuccess && <p className="text-emerald-600 text-sm">{deductSuccess}</p>}
      {deductError && <p className="text-red-500 text-sm">{deductError}</p>}

      <button
        type="submit"
        disabled={deductSubmitting || !deductUserId || !deductReason.trim()}
        className="bg-red-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-red-700 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-red-600"
      >
        {deductSubmitting ? (
          <span className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            Deducting…
          </span>
        ) : "Deduct Points"}
      </button>
    </form>
  );
}
