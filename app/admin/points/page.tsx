"use client";

import { useEffect, useState } from "react";
import { useApiClient } from "@/lib/hooks/useApiClient";
import { useAuth } from "@/lib/auth/AuthProvider";

type Employee = { id: string; displayName: string; email: string; pointsBalance: number };
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
  const { user, loading: authLoading } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [toUserId, setToUserId] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

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

  async function handleSubmit(e: React.FormEvent) {
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
      setSuccess(`✅ ${amount} points awarded to ${recipient?.displayName}!`);
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
          Manually award points to any employee.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-800">Award Points</h2>
        </div>
        <div className="px-6 py-5">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Employee</label>
              <select
                value={toUserId}
                onChange={(e) => e.target.value && setToUserId(e.target.value)}
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
              className="bg-navy-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-navy-700 disabled:opacity-50"
            >
              {submitting ? "Awarding..." : "Award Points"}
            </button>
          </form>
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
            ) : transactions.map((t) => (
              <tr key={t.id} className="hover:bg-gray-50/60 transition-colors border-b border-gray-50">
                <td className={`${tdClass} font-medium text-gray-900`}>
                  {t.toUser?.displayName ?? "—"}
                </td>
                <td className={`${tdClass} text-gray-500`}>
                  {t.fromUser?.displayName ?? "System"}
                </td>
                <td className={tdClass}>
                  <span className="font-semibold text-navy-600">+{t.amount}</span>
                </td>
                <td className={`${tdClass} text-gray-500 max-w-xs truncate`}>
                  {t.note}
                </td>
                <td className={`${tdClass} text-gray-400`}>
                  {new Date(t.createdAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
