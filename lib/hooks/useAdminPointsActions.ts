"use client";

import { useEffect, useRef, useState } from "react";
import { useApiClient } from "@/lib/hooks/useApiClient";
import { useAuth } from "@/lib/auth/AuthProvider";
import { VIOLATION_TYPES, findActivity } from "@/lib/constants/awardActivities";

export type Department = { id: string; name: string };
export type Employee = {
  id: string;
  displayName: string;
  email: string;
  pointsBalance: number;
  department?: { id: string; name: string } | null;
};
export type Transaction = {
  id: string;
  amount: number;
  note: string | null;
  category: string | null;
  createdAt: string;
  toUser?: { displayName: string };
  fromUser: { displayName: string } | null;
};
export type Budget = { isExempt: boolean; used: number; remaining: number; total: number };
export type AttendanceResult = {
  awarded: number;
  awardedNames?: string[];
  skipped: { notFound: string[]; alreadyAwarded: string[] };
} | null;

export function useAdminPointsActions() {
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
  const [attendanceResult, setAttendanceResult] = useState<AttendanceResult>(null);
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
    type Page = { data: (Employee & { role: string })[]; page: number; pages: number };
    const first = await apiFetch<Page>("/api/admin/employees?limit=100");
    const rest = await Promise.all(
      Array.from({ length: Math.max(0, first.pages - 1) }, (_, i) =>
        apiFetch<Page>(`/api/admin/employees?limit=100&page=${i + 2}`)
      )
    );
    const all = [first, ...rest].flatMap((r) => r.data);
    // Only Super Admin can award Managers — filter the list for other roles
    const eligible = isSuperAdmin ? all : all.filter((e) => e.role === "EMPLOYEE");
    setEmployees(eligible);
  }

  useEffect(() => {
    if (authLoading || !user) return;
    loadAllEmployees();
    loadHistory(txPage);
    loadBudget();
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
      const res = await apiFetch<{ data: AttendanceResult }>(
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

  // Activity → amount presets, shared by Single and Bulk forms
  function handleActivityChange(key: string) {
    setActivity(key);
    const preset = findActivity(key);
    if (preset) setAmount(String(preset.points));
  }

  function handleBulkActivityChange(key: string) {
    setBulkActivity(key);
    const preset = findActivity(key);
    if (preset) setBulkAmount(String(preset.points));
  }

  return {
    // state
    employees,
    transactions,
    txLoading,
    txError,
    tab, setTab,
    budget,

    toUserId, setToUserId,
    amount, setAmount,
    note, setNote,
    activity,
    submitting,
    success,
    error,

    bulkDeptFilter, setBulkDeptFilter,
    bulkSelected,
    bulkAmount, setBulkAmount,
    bulkNote, setBulkNote,
    bulkActivity,
    bulkSubmitting,
    bulkSuccess,
    bulkError,

    attendanceMonth, setAttendanceMonth,
    attendanceUploading,
    attendanceResult,
    attendanceError,
    attendanceFileRef,

    deductUserId, setDeductUserId,
    deductViolation, setDeductViolation,
    deductCustomAmount, setDeductCustomAmount,
    deductReason, setDeductReason,
    deductSubmitting,
    deductSuccess,
    deductError,

    txPage, setTxPage,
    txPages,

    // derived
    departments,
    selectableEmployees,
    filteredForBulk,
    allFilteredSelected,

    // handlers
    loadHistory,
    handleAttendanceFile,
    handleSingleSubmit,
    handleDeductSubmit,
    handleBulkSubmit,
    toggleEmployee,
    toggleSelectAll,
    handleActivityChange,
    handleBulkActivityChange,
  };
}
