"use client";

import { useEffect, useState } from "react";
import { useApiClient } from "@/lib/hooks/useApiClient";
import { useAuth } from "@/lib/auth/AuthProvider";

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
  createdAt: string;
  toUser?: { displayName: string };
  fromUser: { displayName: string } | null;
};

export default function AwardPointsPage() {
  const { apiFetch } = useApiClient();
  const { user, dbUser, loading: authLoading } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [tab, setTab] = useState<"single" | "bulk">("single");

  // Single award
  const [toUserId, setToUserId] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  // Bulk award
  const [bulkDeptFilter, setBulkDeptFilter] = useState("all");
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set());
  const [bulkAmount, setBulkAmount] = useState("");
  const [bulkNote, setBulkNote] = useState("");
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [bulkSuccess, setBulkSuccess] = useState("");
  const [bulkError, setBulkError] = useState("");

  useEffect(() => {
    if (authLoading || !user) return;
    apiFetch<{ data: Employee[] }>("/api/admin/employees").then((r) =>
      setEmployees(r.data)
    );
    loadHistory();
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

  async function handleSingleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    setSuccess("");
    try {
      await apiFetch("/api/points/award", {
        method: "POST",
        body: JSON.stringify({ toUserId, amount: Number(amount), note }),
      });
      const recipient = employees.find((e) => e.id === toUserId);
      setSuccess(`${amount} points awarded to ${recipient?.displayName}!`);
      setAmount("");
      setNote("");
      setToUserId("");
      loadHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to award points");
    } finally {
      setSubmitting(false);
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
        }),
      });
      const n = res.data.awarded;
      setBulkSuccess(`${bulkAmount} points awarded to ${n} employee${n !== 1 ? "s" : ""}!`);
      setBulkAmount("");
      setBulkNote("");
      setBulkSelected(new Set());
      setBulkDeptFilter("all");
      loadHistory();
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
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Award Points</h1>
        <p className="text-gray-500 text-sm mt-1">
          Manually award points to employees.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {/* Tabs */}
        <div className="flex border-b border-gray-100">
          {(["single", "bulk"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-6 py-3.5 text-sm font-medium transition-colors ${
                tab === t
                  ? "text-gray-900 border-b-2 border-[#111827]"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {t === "single" ? "Single Award" : "Bulk Award"}
            </button>
          ))}
        </div>

        <div className="px-6 py-5">
          {tab === "single" ? (
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
                <label className="text-sm font-medium text-gray-700">Points to Award</label>
                <input
                  type="number"
                  min={1}
                  max={10000}
                  placeholder="e.g. 100"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                  className={inputClass}
                />
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
                className="bg-[#111827] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-gray-800 disabled:opacity-50"
              >
                {submitting ? "Awarding..." : "Award Points"}
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
                    <p className="text-center text-gray-400 text-sm py-6">No employees found</p>
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
                          <span className="text-xs text-gray-400">{e.department.name}</span>
                        )}
                        <span className="text-xs text-gray-400">{e.pointsBalance} pts</span>
                      </label>
                    ))
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
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
                    className={inputClass}
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
                className="bg-[#111827] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-gray-800 disabled:opacity-50"
              >
                {bulkSubmitting
                  ? "Awarding..."
                  : bulkSelected.size === 0
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
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className={thClass}>Recipient</th>
              <th className={thClass}>Awarded By</th>
              <th className={thClass}>Points</th>
              <th className={thClass}>Note</th>
              <th className={thClass}>Date</th>
            </tr>
          </thead>
          <tbody>
            {transactions.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center text-gray-400 py-8">
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
                    <span className="font-semibold text-navy-600">+{t.amount}</span>
                  </td>
                  <td className={`${tdClass} text-gray-500 max-w-xs truncate`}>{t.note}</td>
                  <td className={`${tdClass} text-gray-400`}>
                    {new Date(t.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
