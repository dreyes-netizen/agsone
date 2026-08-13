"use client";

import { useEffect, useRef, useState } from "react";
import { useApiClient } from "@/lib/hooks/useApiClient";
import { useAuth } from "@/lib/auth/AuthProvider";
import { VIOLATION_TYPES, findActivity } from "@/lib/constants/awardActivities";
import type { Department, Employee, Transaction, Budget, AttendanceResult, EmployeePickerResponse } from "./types";
import { getDepartmentsFromEmployees, filterEmployeesForBulk, inputClass } from "./utils";
import { SingleAwardForm } from "./components/SingleAwardForm";
import { BudgetBar } from "./components/BudgetBar";
import { AttendanceAwardPanel } from "./components/AttendanceAwardPanel";
import { DeductPointsForm } from "./components/DeductPointsForm";
import { BulkAwardForm } from "./components/BulkAwardForm";
import { TransactionHistoryTable } from "./components/TransactionHistoryTable";
import { useRealtimeChannel } from "@/lib/hooks/useRealtimeChannel";
import { realtimeTopics } from "@/lib/realtime/topics";

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

  // The picker endpoint returns only the fields these forms need and skips
  // the management table's pagination/count fan-out. The role check remains
  // in /api/admin/employees and the client still applies award eligibility.
  async function loadAllEmployees() {
    const response = await apiFetch<EmployeePickerResponse>("/api/admin/employees?picker=true");
    const all = response.data;
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

  useRealtimeChannel(
    realtimeTopics.pointsTransactions,
    () => {
      loadHistory(txPage);
      loadBudget();
      loadAllEmployees();
    },
    { debounceMs: 200 },
  );
  useRealtimeChannel(realtimeTopics.employees, loadAllEmployees, { debounceMs: 200 });

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
              budget={budget}
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
              budget={budget}
            />
          )}
        </div>
      </div>

      <TransactionHistoryTable
        transactions={transactions}
        loading={txLoading}
        error={txError}
        page={txPage}
        pages={txPages}
        onRetry={() => loadHistory(txPage)}
        onPageChange={setTxPage}
      />
    </div>
  );
}
