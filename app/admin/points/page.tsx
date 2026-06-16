"use client";

import { useEffect, useRef, useState } from "react";
import { useApiClient } from "@/lib/hooks/useApiClient";
import { useAuth } from "@/lib/auth/AuthProvider";
import { AWARD_ACTIVITIES, AWARD_CATEGORIES, VIOLATION_TYPES, findActivity, type AwardCategory } from "@/lib/constants/awardActivities";
import { Upload, Loader2, CheckCircle, AlertCircle, XCircle } from "lucide-react";

type Department = { id: string; name: string };
type Employee = {
  id: string;
  displayName: string;
  email: string;
  pointsBalance: number;
  department?: { id: string; name: string } | null;
};
type Transaction = {
  id: string;
  amount: number;
  note: string | null;
  category: string | null;
  createdAt: string;
  toUser?: { displayName: string };
  fromUser: { displayName: string } | null;
};
type Budget = { isExempt: boolean; used: number; remaining: number; total: number };

const CATEGORY_BADGE: Record<string, { label: string; style: string }> = {
  PERFORMANCE: { label: "Performance", style: "bg-violet-50 text-violet-700" },
  TEAMWORK:    { label: "Teamwork",    style: "bg-blue-50 text-blue-700" },
  INNOVATION:  { label: "Innovation",  style: "bg-amber-50 text-amber-700" },
  LEADERSHIP:  { label: "Leadership",  style: "bg-emerald-50 text-emerald-700" },
};

// Activity dropdown grouped by category, shared by Single and Bulk forms
function ActivitySelect({ value, onChange }: { value: string; onChange: (key: string) => void }) {
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

function BudgetBar({ budget }: { budget: Budget | null }) {
  if (!budget || budget.isExempt) return null;
  const pct = Math.min(100, (budget.used / budget.total) * 100);
  const barColor = budget.remaining === 0 ? "bg-red-500" : budget.remaining < 100 ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div className="mb-4 bg-gray-50 border border-gray-100 rounded-xl px-4 py-3">
      <div className="flex items-center justify-between text-xs mb-1.5">
        <span className="font-medium text-gray-600">Monthly recognition budget</span>
        <span className={`font-semibold ${budget.remaining === 0 ? "text-red-600" : "text-gray-700"}`}>
          {budget.used} / {budget.total} pts used — {budget.remaining} remaining
        </span>
      </div>
      <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function AwardPointsPage() {
  const { apiFetch } = useApiClient();
  const { user, dbUser, loading: authLoading } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [tab, setTab] = useState<"single" | "bulk" | "deduct" | "attendance">("single");
  const [budget, setBudget] = useState<Budget | null>(null);

  // Single award
  const [toUserId, setToUserId] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [activity, setActivity] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  // Bulk award
  const [bulkDeptFilter, setBulkDeptFilter] = useState("all");
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set());
  const [bulkAmount, setBulkAmount] = useState("");
  const [bulkNote, setBulkNote] = useState("");
  const [bulkActivity, setBulkActivity] = useState("");
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [bulkSuccess, setBulkSuccess] = useState("");
  const [bulkError, setBulkError] = useState("");

  // Attendance award
  const [attendanceMonth, setAttendanceMonth] = useState(() => {
    const now = new Date();
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return prev.toISOString().slice(0, 7);
  });
  const [attendanceUploading, setAttendanceUploading] = useState(false);
  const [attendanceResult, setAttendanceResult] = useState<{
    awarded: number;
    awardedNames?: string[];
    skipped: { notFound: string[]; alreadyAwarded: string[] };
  } | null>(null);
  const [attendanceError, setAttendanceError] = useState("");
  const attendanceFileRef = useRef<HTMLInputElement>(null);

  // Deduct
  const [deductUserId, setDeductUserId] = useState("");
  const [deductViolation, setDeductViolation] = useState(VIOLATION_TYPES[0].key as string);
  const [deductCustomAmount, setDeductCustomAmount] = useState("");
  const [deductReason, setDeductReason] = useState("");
  const [deductSubmitting, setDeductSubmitting] = useState(false);
  const [deductSuccess, setDeductSuccess] = useState("");
  const [deductError, setDeductError] = useState("");

  async function loadBudget() {
    try {
      const res = await apiFetch<{ data: Budget }>("/api/points/budget");
      setBudget(res.data);
    } catch {
      // ignore — budget bar simply won't render
    }
  }

  const [toast, setToast] = useState<{type:"success"|"error";msg:string}|null>(null);
  function showToast(t:"success"|"error",m:string){setToast({type:t,msg:m});setTimeout(()=>setToast(null),4000);}

  const isSuperAdmin = dbUser?.role === "SUPER_ADMIN";

  useEffect(() => {
    if (authLoading || !user) return;
    apiFetch<{ data: (Employee & { role: string })[] }>("/api/admin/employees").then((r) => {
      // Only Super Admin can award Managers — filter the list for other roles
      const eligible = isSuperAdmin ? r.data : r.data.filter((e) => e.role === "EMPLOYEE");
      setEmployees(eligible);
    });
    loadHistory();
    loadBudget();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user]);

  async function loadHistory() {
    try {
      const res = await apiFetch<{ data: Transaction[] }>("/api/points/history");
      setTransactions(res.data);
    } catch {
      // ignore
    }
  }

  async function handleAttendanceFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setAttendanceUploading(true);
    setAttendanceResult(null);
    setAttendanceError("");
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("attendanceMonth", `${attendanceMonth}-01`);
      const res = await apiFetch<{ data: typeof attendanceResult }>(
        "/api/admin/attendance/award",
        { method: "POST", body: form }
      );
      setAttendanceResult(res.data);
      loadHistory();
    } catch (err) {
      setAttendanceError(err instanceof Error ? err.message : "Failed to process attendance file");
    } finally {
      setAttendanceUploading(false);
    }
  }

  async function handleSingleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    setSuccess("");
    try {
      await apiFetch("/api/points/award", {
        method: "POST",
        body: JSON.stringify({ toUserId, amount: Number(amount), note, activity: activity || undefined }),
      });
      const recipient = employees.find((e) => e.id === toUserId);
      setSuccess(`${amount} points awarded to ${recipient?.displayName}!`);
      setAmount("");
      setNote("");
      setToUserId("");
      setActivity("");
      loadHistory();
      loadBudget();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to award points");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeductSubmit(e: React.FormEvent) {
    e.preventDefault();
    setDeductSubmitting(true);
    setDeductError("");
    setDeductSuccess("");
    try {
      const res = await apiFetch<{ data: { requested: number; deducted: number; newBalance: number } }>("/api/points/deduct", {
        method: "POST",
        body: JSON.stringify({
          toUserId: deductUserId,
          violationType: deductViolation,
          customAmount: deductViolation === "CUSTOM" ? Number(deductCustomAmount) : undefined,
          reason: deductReason,
        }),
      });
      const recipient = employees.find((emp) => emp.id === deductUserId);
      const floored = res.data.deducted < res.data.requested
        ? ` (requested ${res.data.requested}, balance floored at 0)`
        : "";
      setDeductSuccess(`${res.data.deducted} points deducted from ${recipient?.displayName}${floored}. New balance: ${res.data.newBalance}.`);
      setDeductUserId("");
      setDeductCustomAmount("");
      setDeductReason("");
      setDeductViolation(VIOLATION_TYPES[0].key);
      loadHistory();
    } catch (err) {
      setDeductError(err instanceof Error ? err.message : "Failed to deduct points");
    } finally {
      setDeductSubmitting(false);
    }
  }

  async function handleBulkSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBulkSubmitting(true);
    setBulkError("");
    setBulkSuccess("");
    try {
      const res = await apiFetch<{ data: { awarded: number } }>("/api/points/award/bulk", {
        method: "POST",
        body: JSON.stringify({
          userIds: Array.from(bulkSelected),
          amount: Number(bulkAmount),
          note: bulkNote,
          activity: bulkActivity || undefined,
        }),
      });
      const n = res.data.awarded;
      setBulkSuccess(`${bulkAmount} points awarded to ${n} employee${n !== 1 ? "s" : ""}!`);
      setBulkAmount("");
      setBulkNote("");
      setBulkActivity("");
      setBulkSelected(new Set());
      setBulkDeptFilter("all");
      loadHistory();
      loadBudget();
    } catch (err) {
      setBulkError(err instanceof Error ? err.message : "Failed to award points");
    } finally {
      setBulkSubmitting(false);
    }
  }

  // Extract unique departments from loaded employees
  const departments: Department[] = Array.from(
    new Map(
      employees
        .filter((e) => e.department)
        .map((e) => [e.department!.id, e.department!])
    ).values()
  ).sort((a, b) => a.name.localeCompare(b.name));

  // Selectable employees (exclude self)
  const selectableEmployees = employees.filter((e) => e.id !== dbUser?.id);
  const filteredForBulk =
    bulkDeptFilter === "all"
      ? selectableEmployees
      : selectableEmployees.filter((e) => e.department?.id === bulkDeptFilter);

  const allFilteredSelected =
    filteredForBulk.length > 0 &&
    filteredForBulk.every((e) => bulkSelected.has(e.id));

  function toggleEmployee(id: string) {
    setBulkSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (allFilteredSelected) {
      setBulkSelected((prev) => {
        const next = new Set(prev);
        filteredForBulk.forEach((e) => next.delete(e.id));
        return next;
      });
    } else {
      setBulkSelected((prev) => {
        const next = new Set(prev);
        filteredForBulk.forEach((e) => next.add(e.id));
        return next;
      });
    }
  }

  const inputClass =
    "w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-navy-500/30 focus:border-navy-400 bg-white";
  const thClass =
    "text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide";
  const tdClass = "px-6 py-3";

  return (
    <div className="space-y-6 max-w-4xl">
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium motion-safe:animate-in motion-safe:slide-in-from-top-2 motion-safe:fade-in-0 motion-safe:duration-300 ${
            toast.type === "success"
              ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
              : "bg-red-50 border border-red-200 text-red-800"
          }`}
        >
          {toast.type === "success"
            ? <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden="true" />
            : <XCircle className="w-4 h-4 text-red-500 shrink-0" aria-hidden="true" />}
          {toast.msg}
        </div>
      )}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Award Points</h1>
        <p className="text-gray-500 text-sm mt-1">
          Manually award points to employees.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {/* Tabs */}
        <div role="tablist" aria-label="Award type" className="flex border-b border-gray-100 overflow-x-auto">
          {(["single", "bulk", "deduct", "attendance"] as const).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`px-6 py-3.5 text-sm font-medium transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-gray-900 ${
                tab === t
                  ? t === "deduct"
                    ? "text-red-600 border-b-2 border-red-600"
                    : "text-gray-900 border-b-2 border-[#111827]"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {t === "single" ? "Single Award" : t === "bulk" ? "Bulk Award" : t === "deduct" ? "Deduct Points" : "Attendance"}
            </button>
          ))}
        </div>

        <div className="px-6 py-5">
          {tab !== "deduct" && tab !== "attendance" && <BudgetBar budget={budget} />}
          {tab === "attendance" ? (
            <div className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Attendance Month</label>
                <input
                  type="month"
                  value={attendanceMonth}
                  onChange={(e) => setAttendanceMonth(e.target.value)}
                  className={inputClass}
                />
                <p className="text-xs text-gray-500">Select the month this attendance data covers — not today&apos;s date.</p>
              </div>

              <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 space-y-0.5">
                <p className="text-sm font-semibold text-blue-800">Perfect Attendance = 50 pts</p>
                <p className="text-xs text-blue-600">Days Present &gt; 20, Days Absent = 0, Undertime = 0</p>
              </div>

              <div>
                <input
                  ref={attendanceFileRef}
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={handleAttendanceFile}
                />
                <button
                  type="button"
                  onClick={() => attendanceFileRef.current?.click()}
                  disabled={attendanceUploading}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold bg-[#111827] text-white rounded-xl hover:bg-gray-800 disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-900"
                >
                  {attendanceUploading ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Upload className="w-4 h-4" aria-hidden="true" />}
                  {attendanceUploading ? "Processing…" : "Upload Attendance File (.xlsx)"}
                </button>
              </div>

              {attendanceError && <p className="text-red-500 text-sm">{attendanceError}</p>}

              {attendanceResult && (
                <div className="space-y-3">
                  {attendanceResult.awarded > 0 ? (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-2">
                      <p className="text-sm font-semibold text-emerald-800 flex items-center gap-1.5">
                        <CheckCircle className="w-4 h-4 text-emerald-600" aria-hidden="true" />
                        {attendanceResult.awarded} employee{attendanceResult.awarded !== 1 ? "s" : ""} awarded 50 pts for perfect attendance
                      </p>
                      {attendanceResult.awardedNames && attendanceResult.awardedNames.length > 0 && (
                        <p className="text-xs text-emerald-700">{attendanceResult.awardedNames.join(", ")}</p>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">No employees with perfect attendance found in this file.</p>
                  )}
                  {attendanceResult.skipped.alreadyAwarded.length > 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-1">
                      <p className="text-sm font-semibold text-amber-800 flex items-center gap-1.5">
                        <AlertCircle className="w-4 h-4 text-amber-500" aria-hidden="true" />
                        Already awarded this month ({attendanceResult.skipped.alreadyAwarded.length})
                      </p>
                      <p className="text-xs text-amber-700">{attendanceResult.skipped.alreadyAwarded.join(", ")}</p>
                    </div>
                  )}
                  {attendanceResult.skipped.notFound.length > 0 && (
                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-1">
                      <p className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                        <XCircle className="w-4 h-4 text-gray-500" aria-hidden="true" />
                        Employee IDs not found in system ({attendanceResult.skipped.notFound.length})
                      </p>
                      <p className="text-xs text-gray-500 font-mono">{attendanceResult.skipped.notFound.join(", ")}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : tab === "deduct" ? (
            <form onSubmit={handleDeductSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Employee</label>
                <select
                  value={deductUserId}
                  onChange={(e) => setDeductUserId(e.target.value)}
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
                  onChange={(e) => setDeductViolation(e.target.value)}
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
                    onChange={(e) => setDeductCustomAmount(e.target.value)}
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
                  onChange={(e) => setDeductReason(e.target.value)}
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
          ) : tab === "single" ? (
            <form onSubmit={handleSingleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Employee</label>
                <select
                  value={toUserId}
                  onChange={(e) => e.target.value && setToUserId(e.target.value)}
                  required
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-navy-500/30 bg-white"
                >
                  <option value="">Select an employee...</option>
                  {employees
                    .filter((e) => e.id !== dbUser?.id)
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
                  onChange={(key) => {
                    setActivity(key);
                    const preset = findActivity(key);
                    if (preset) setAmount(String(preset.points));
                  }}
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
                  onChange={(e) => setAmount(e.target.value)}
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
                  onChange={(e) => setNote(e.target.value)}
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
                className="bg-[#111827] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-gray-800 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-900"
              >
                {submitting ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                    Awarding…
                  </span>
                ) : "Award Points"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleBulkSubmit} className="space-y-5">
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
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-700">
                    Select Recipients
                    {bulkSelected.size > 0 && (
                      <span className="ml-2 text-xs font-normal text-indigo-600">
                        {bulkSelected.size} selected
                      </span>
                    )}
                  </label>
                  <button
                    type="button"
                    onClick={toggleSelectAll}
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
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
                        } ${bulkSelected.has(e.id) ? "bg-indigo-50/50" : ""}`}
                      >
                        <input
                          type="checkbox"
                          checked={bulkSelected.has(e.id)}
                          onChange={() => toggleEmployee(e.id)}
                          className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
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
                  onChange={(key) => {
                    setBulkActivity(key);
                    const preset = findActivity(key);
                    if (preset) setBulkAmount(String(preset.points));
                  }}
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
                disabled={bulkSubmitting || bulkSelected.size === 0 || !bulkAmount || !bulkNote}
                className="bg-[#111827] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-gray-800 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-900"
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
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-800">Recent Transactions</h2>
        </div>
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className={thClass}>Recipient</th>
              <th className={thClass}>Awarded By</th>
              <th className={thClass}>Points</th>
              <th className={thClass}>Category</th>
              <th className={thClass}>Note</th>
              <th className={thClass}>Date</th>
            </tr>
          </thead>
          <tbody>
            {transactions.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center text-gray-500 py-8">
                  No transactions yet
                </td>
              </tr>
            ) : (
              transactions.map((t) => (
                <tr
                  key={t.id}
                  className="hover:bg-gray-50/60 transition-colors border-b border-gray-50"
                >
                  <td className={`${tdClass} font-medium text-gray-900`}>
                    {t.toUser?.displayName ?? "—"}
                  </td>
                  <td className={`${tdClass} text-gray-500`}>
                    {t.fromUser?.displayName ?? "System"}
                  </td>
                  <td className={tdClass}>
                    <span className={`font-semibold ${t.amount < 0 ? "text-rose-500" : "text-navy-600"}`}>
                      {t.amount > 0 ? "+" : ""}{t.amount}
                    </span>
                  </td>
                  <td className={tdClass}>
                    {t.category && CATEGORY_BADGE[t.category] ? (
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${CATEGORY_BADGE[t.category].style}`}>
                        {CATEGORY_BADGE[t.category].label}
                      </span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className={`${tdClass} text-gray-500 max-w-xs truncate`}>{t.note}</td>
                  <td className={`${tdClass} text-gray-500`}>
                    {new Date(t.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
