"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useApiClient } from "@/lib/hooks/useApiClient";
import { CheckCircle, XCircle, Package, Loader2 } from "lucide-react";

type Redemption = {
  id: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "FULFILLED";
  pointsSpent: number;
  createdAt: string;
  adminNote: string | null;
  reward: { name: string; pointCost: number; category: string };
  user: { displayName: string; email: string };
  processedBy: { displayName: string } | null;
};

const statusBadgeClass: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-700",
  APPROVED: "bg-emerald-100 text-emerald-700",
  REJECTED: "bg-red-100 text-red-700",
  FULFILLED: "bg-blue-100 text-blue-700",
};

export default function AdminRedemptionsPage() {
  const { user, loading: authLoading } = useAuth();
  const { apiFetch } = useApiClient();
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [noteMap, setNoteMap] = useState<Record<string, string>>({});

  useEffect(() => {
    if (authLoading || !user) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user]);

  async function load() {
    setLoading(true);
    const res = await apiFetch<{ data: Redemption[] }>("/api/redemptions");
    setRedemptions(res.data);
    setLoading(false);
  }

  async function updateStatus(id: string, status: "APPROVED" | "REJECTED" | "FULFILLED") {
    setActionId(id);
    try {
      await apiFetch(`/api/redemptions/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status, adminNote: noteMap[id] || undefined }),
      });
      await load();
    } finally {
      setActionId(null);
    }
  }

  const pending = redemptions.filter((r) => r.status === "PENDING");
  const processed = redemptions.filter((r) => r.status !== "PENDING");

  const thClass = "text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide";
  const tdClass = "px-6 py-3";

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Redemptions</h1>
        <p className="text-gray-500 text-sm mt-1">Review and process employee reward redemptions.</p>
      </div>

      <div>
        <h2 className="text-base font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-400 text-white text-xs font-bold">
            {pending.length}
          </span>
          Pending Approval
        </h2>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className={thClass}>Employee</th>
                <th className={thClass}>Reward</th>
                <th className={thClass}>Points</th>
                <th className={thClass}>Requested</th>
                <th className={thClass}>Admin Note</th>
                <th className={thClass}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8"><div role="status" aria-live="polite" className="flex items-center justify-center gap-2 text-gray-500 text-sm"><Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />Loading…</div></td>
                </tr>
              ) : pending.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-gray-500">No pending redemptions.</td>
                </tr>
              ) : pending.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50/60 transition-colors border-b border-gray-50">
                  <td className={tdClass}>
                    <p className="font-medium">{r.user.displayName}</p>
                    <p className="text-xs text-gray-500">{r.user.email}</p>
                  </td>
                  <td className={tdClass}>
                    <p className="font-medium">{r.reward.name}</p>
                    <p className="text-xs text-gray-500">{r.reward.category}</p>
                  </td>
                  <td className={tdClass}>
                    <span className="font-semibold text-navy-600">{r.pointsSpent.toLocaleString()} pts</span>
                  </td>
                  <td className={`${tdClass} text-gray-500`}>{new Date(r.createdAt).toLocaleDateString()}</td>
                  <td className={tdClass}>
                    <textarea
                      placeholder="Optional note..."
                      rows={1}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-navy-500/30 resize-none"
                      value={noteMap[r.id] ?? ""}
                      onChange={(e) => setNoteMap({ ...noteMap, [r.id]: e.target.value })}
                      aria-label={`Admin note for ${r.user.displayName}`}
                    />
                  </td>
                  <td className={tdClass}>
                    <div className="flex gap-1.5">
                      <button
                        className="bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-emerald-600"
                        disabled={actionId === r.id}
                        onClick={() => updateStatus(r.id, "APPROVED")}
                        aria-label={`Approve ${r.user.displayName}'s redemption of ${r.reward.name}`}
                      >
                        <CheckCircle className="w-3 h-3" /> Approve
                      </button>
                      <button
                        className="bg-red-50 text-red-600 border border-red-200 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-red-100 disabled:opacity-50 flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-red-500"
                        disabled={actionId === r.id}
                        onClick={() => updateStatus(r.id, "REJECTED")}
                        aria-label={`Reject ${r.user.displayName}'s redemption of ${r.reward.name}`}
                      >
                        <XCircle className="w-3 h-3" /> Reject
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-base font-semibold text-gray-700 mb-3">History</h2>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className={thClass}>Employee</th>
                <th className={thClass}>Reward</th>
                <th className={thClass}>Points</th>
                <th className={thClass}>Status</th>
                <th className={thClass}>Processed By</th>
                <th className={thClass}>Note</th>
                <th className={thClass}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {processed.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-gray-500">No processed redemptions yet.</td>
                </tr>
              ) : processed.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50/60 transition-colors border-b border-gray-50">
                  <td className={tdClass}>
                    <p className="font-medium">{r.user.displayName}</p>
                    <p className="text-xs text-gray-500">{r.user.email}</p>
                  </td>
                  <td className={`${tdClass} text-gray-700`}>{r.reward.name}</td>
                  <td className={tdClass}>
                    <span className="font-semibold text-navy-600">{r.pointsSpent.toLocaleString()} pts</span>
                  </td>
                  <td className={tdClass}>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${statusBadgeClass[r.status]}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className={`${tdClass} text-gray-500`}>{r.processedBy?.displayName ?? "—"}</td>
                  <td className={`${tdClass} text-xs text-gray-500 max-w-xs truncate`}>{r.adminNote ?? "—"}</td>
                  <td className={tdClass}>
                    {r.status === "APPROVED" && (
                      <button
                        className="bg-blue-50 text-blue-600 border border-blue-200 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50 flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-600"
                        disabled={actionId === r.id}
                        onClick={() => updateStatus(r.id, "FULFILLED")}
                        aria-label={`Mark ${r.reward.name} as fulfilled for ${r.user.displayName}`}
                      >
                        <Package className="w-3 h-3" /> Mark Fulfilled
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      </div>
    </div>
  );
}
