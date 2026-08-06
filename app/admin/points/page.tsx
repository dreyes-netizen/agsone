"use client";

import { useEffect, useRef, useState } from "react";
import { useApiClient } from "@/lib/hooks/useApiClient";
import { useAuth } from "@/lib/auth/AuthProvider";
import { VIOLATION_TYPES, findActivity } from "@/lib/constants/awardActivities";
import { Loader2, History } from "lucide-react";
import { Pagination } from "@/components/ui/pagination";
import type { Department, Employee, Transaction, Budget, AttendanceResult, EmployeesPage } from "./types";
import { CATEGORY_BADGE, getDepartmentsFromEmployees, filterEmployeesForBulk, inputClass, thClass, tdClass } from "./utils";
import { SingleAwardForm } from "./components/SingleAwardForm";
import { BudgetBar } from "./components/BudgetBar";
import { AttendanceAwardPanel } from "./components/AttendanceAwardPanel";
import { DeductPointsForm } from "./components/DeductPointsForm";
import { BulkAwardForm } from "./components/BulkAwardForm";

export default function AwardPointsPage() {
  const { apiFetch } = useApiClient();
  const { user, dbUser, loading: authLoading } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [txLoading, setTxLoading] = useState(true);
  const [txError, setTxError] = useState<string | null>(null);
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
  const [attendanceResult, setAttendanceResult] = useState<AttendanceResult | null>(null);
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

  const [txPage, setTxPage] = useState(1);
  const [txPages, setTxPages] = useState(1);

  const isSuperAdmin = dbUser?.role === "SUPER_ADMIN";

  // /api/admin/employees is paginated (100/page max, by design — see
  // lib/api/pagination.ts) but the bulk-award picker and single-award
  // <select> need the FULL active roster, not just page 1. Calling it with
  // no params silently truncated to the first 25 employees alphabetically.
  // Page through it instead of raising the cap.
  async function loadAllEmployees() {
    const first = await apiFetch<EmployeesPage>("/api/admin/employees?limit=100");
    const rest = await Promise.all(
      Array.from({ length: Math.max(0, first.pages - 1) }, (_, i) =>
        apiFetch<EmployeesPage>(`/api/admin/employees?limit=100&page=${i + 2}`)
      )
    );
    const all = [first, ...rest].flatMap((r) => r.data);
    // Only Super Admin can award Managers — filter the list for other roles
    const eligible = isSuperAdmin ? all : all.filter((e) => e.role === "EMPLOYEE");
    setEmployees(eligible);
  }

  useEffect(() => {
    if (authLoading || !user) return;
    queueMicrotask(loadAllEmployees);
    loadHistory(txPage);
    queueMicrotask(loadBudget);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user]);

  const initialTxLoad = useRef(true);
  useEffect(() => {
    if (initialTxLoad.current) { initialTxLoad.current = false; return; }
    loadHistory(txPage);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [txPage]);

  async function loadHistory(page = 1) {
    setTxLoading(true);
    setTxError(null);
    try {
      const res = await apiFetch<{ data: Transaction[]; pages: number }>(`/api/points/history?page=${page}`);
      setTransactions(res.data);
      setTxPages(res.pages);
    } catch (err) {
      // Previously swallowed — a failed fetch silently rendered "No transactions
      // yet" for what is high-trust financial history.
      setTxError(err instanceof Error ? err.message : "Failed to load transaction history.");
    } finally {
      setTxLoading(false);
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
      setTxPage(1);
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
      setTxPage(1);
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
      setTxPage(1);
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
      setTxPage(1);
      loadBudget();
    } catch (err) {
      setBulkError(err instanceof Error ? err.message : "Failed to award points");
    } finally {
      setBulkSubmitting(false);
    }
  }

  // Extract unique departments from loaded employees
  const departments: Department[] = getDepartmentsFromEmployees(employees);
  const { filteredForBulk, allFilteredSelected } = filterEmployeesForBulk(employees, dbUser?.id, bulkDeptFilter, bulkSelected);

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

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Award Points</h1>
        <p className="text-gray-500 text-sm mt-1">
          Manually award points to employees.
        </p>
      </div>

      <div className="bg-white rounded-card border border-table-border overflow-hidden">
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
                    : "text-gray-900 border-b-2 border-command-black"
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
            <AttendanceAwardPanel
              attendanceMonth={attendanceMonth}
              onMonthChange={setAttendanceMonth}
              attendanceUploading={attendanceUploading}
              attendanceResult={attendanceResult}
              attendanceError={attendanceError}
              fileInputRef={attendanceFileRef}
              onFileChange={handleAttendanceFile}
              inputClass={inputClass}
            />
          ) : tab === "deduct" ? (
            <DeductPointsForm
              employees={employees}
              deductUserId={deductUserId}
              onUserChange={setDeductUserId}
              deductViolation={deductViolation}
              onViolationChange={setDeductViolation}
              deductCustomAmount={deductCustomAmount}
              onCustomAmountChange={setDeductCustomAmount}
              deductReason={deductReason}
              onReasonChange={setDeductReason}
              deductSubmitting={deductSubmitting}
              deductSuccess={deductSuccess}
              deductError={deductError}
              onSubmit={handleDeductSubmit}
              inputClass={inputClass}
            />
          ) : tab === "single" ? (
            <SingleAwardForm
              employees={employees}
              currentUserId={dbUser?.id}
              toUserId={toUserId}
              onToUserChange={setToUserId}
              amount={amount}
              onAmountChange={setAmount}
              note={note}
              onNoteChange={setNote}
              activity={activity}
              onActivityChange={(key) => {
                setActivity(key);
                const preset = findActivity(key);
                if (preset) setAmount(String(preset.points));
              }}
              submitting={submitting}
              success={success}
              error={error}
              onSubmit={handleSingleSubmit}
              inputClass={inputClass}
            />
          ) : (
            <BulkAwardForm
              departments={departments}
              filteredForBulk={filteredForBulk}
              bulkSelected={bulkSelected}
              allFilteredSelected={allFilteredSelected}
              bulkDeptFilter={bulkDeptFilter}
              onDeptFilterChange={setBulkDeptFilter}
              bulkAmount={bulkAmount}
              onAmountChange={setBulkAmount}
              bulkNote={bulkNote}
              onNoteChange={setBulkNote}
              bulkActivity={bulkActivity}
              onActivityChange={(key) => {
                setBulkActivity(key);
                const preset = findActivity(key);
                if (preset) setBulkAmount(String(preset.points));
              }}
              bulkSubmitting={bulkSubmitting}
              bulkSuccess={bulkSuccess}
              bulkError={bulkError}
              onToggleEmployee={toggleEmployee}
              onToggleSelectAll={toggleSelectAll}
              onSubmit={handleBulkSubmit}
              inputClass={inputClass}
            />
          )}
        </div>
      </div>

      <div className="bg-white rounded-card border border-table-border overflow-clip">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-800">Recent Transactions</h2>
        </div>
        {txError && (
          <div role="alert" className="mx-6 mt-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700 flex items-center justify-between gap-3">
            <span>{txError}</span>
            <button
              onClick={() => loadHistory(txPage)}
              className="font-medium underline underline-offset-2 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-red-600"
            >
              Retry
            </button>
          </div>
        )}
        <div className="overflow-auto max-h-[70vh] scroll-hint">
        <table className="w-full border-collapse" aria-label="Recent transactions">
          <thead className="sticky top-0 z-10 bg-table-head">
            <tr className="border-b border-table-border">
              <th scope="col" className={thClass}>Recipient</th>
              <th scope="col" className={thClass}>Awarded By</th>
              <th scope="col" className={thClass}>Points</th>
              <th scope="col" className={thClass}>Category</th>
              <th scope="col" className={thClass}>Note</th>
              <th scope="col" className={thClass}>Date</th>
            </tr>
          </thead>
          <tbody>
            {txLoading ? (
              <tr>
                <td colSpan={6} className="text-center py-12"><div role="status" aria-live="polite" className="flex items-center justify-center gap-2 text-gray-500 text-sm"><Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />Loading…</div></td>
              </tr>
            ) : transactions.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <History className="w-8 h-8 text-gray-300" aria-hidden="true" />
                    <p className="text-table-muted text-[13px]">No transactions yet</p>
                  </div>
                </td>
              </tr>
            ) : (
              transactions.map((t, i) => (
                <tr
                  key={t.id}
                  className={`border-b border-row-border transition-colors hover:bg-row-hover ${i % 2 === 1 ? "bg-row-alt" : ""}`}
                >
                  <td className={`${tdClass} font-medium text-gray-900`}>
                    {t.toUser?.displayName ?? "—"}
                  </td>
                  <td className={`${tdClass} text-gray-500`}>
                    {t.fromUser?.displayName ?? "System"}
                  </td>
                  <td className={tdClass}>
                    <span className={`font-semibold ${t.amount < 0 ? "text-rose-500" : "text-navy-600"}`}>
                      {t.amount > 0 ? "+" : ""}{t.amount.toLocaleString()}
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
                    {new Date(t.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>
        <div className="px-6 py-4">
          <Pagination page={txPage} pages={txPages} onPageChange={setTxPage} />
        </div>
      </div>
    </div>
  );
}
