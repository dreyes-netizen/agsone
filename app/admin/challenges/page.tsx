"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useApiClient } from "@/lib/hooks/useApiClient";
import { Plus, Swords } from "lucide-react";

type Challenge = {
  id: string;
  title: string;
  description: string | null;
  metric: "TOTAL_POINTS" | "MISSIONS_COMPLETED" | "SHOUTOUTS_SENT";
  targetValue: number;
  startDate: string;
  endDate: string;
  isActive: boolean;
  createdAt: string;
};

const metricLabel: Record<Challenge["metric"], string> = {
  TOTAL_POINTS: "Total Points",
  MISSIONS_COMPLETED: "Missions Completed",
  SHOUTOUTS_SENT: "Shoutouts Sent",
};

const inputClass = "w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-navy-500/30 bg-white";

export default function AdminChallengesPage() {
  const { user, loading: authLoading } = useAuth();
  const { apiFetch } = useApiClient();
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", metric: "MISSIONS_COMPLETED" as Challenge["metric"], targetValue: "", startDate: "", endDate: "" });

  useEffect(() => {
    if (authLoading || !user) return;
    apiFetch<{ data: Challenge[] }>("/api/admin/challenges")
      .then((res) => setChallenges(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user]);

  async function handleToggleActive(challenge: Challenge) {
    setTogglingId(challenge.id);
    try {
      await apiFetch(`/api/admin/challenges/${challenge.id}`, { method: "PATCH", body: JSON.stringify({ isActive: !challenge.isActive }) });
      setChallenges((prev) => prev.map((c) => c.id === challenge.id ? { ...c, isActive: !c.isActive } : c));
    } catch { alert("Failed to update challenge"); }
    finally { setTogglingId(null); }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title || !form.metric || !form.targetValue || !form.startDate || !form.endDate) { alert("All fields except description are required."); return; }
    setSaving(true);
    try {
      const res = await apiFetch<{ data: Challenge }>("/api/admin/challenges", { method: "POST", body: JSON.stringify({ title: form.title, description: form.description || null, metric: form.metric, targetValue: Number(form.targetValue), startDate: form.startDate, endDate: form.endDate }) });
      setChallenges((prev) => [res.data, ...prev]);
      setForm({ title: "", description: "", metric: "MISSIONS_COMPLETED", targetValue: "", startDate: "", endDate: "" });
      setShowForm(false);
    } catch (err) { alert(err instanceof Error ? err.message : "Failed to create challenge"); }
    finally { setSaving(false); }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Department Challenges</h1>
          <p className="text-gray-500 text-sm mt-1">Create time-boxed collaborative goals for departments.</p>
        </div>
        <button onClick={() => setShowForm((v) => !v)} className="flex items-center gap-2 bg-[#111827] text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-gray-800 transition-colors">
          <Plus className="w-4 h-4" />New Challenge
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-sm font-bold text-gray-800 mb-4">New Challenge</h2>
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-gray-500 mb-1">Title *</label>
                <input className={inputClass} value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. Mission Month" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-gray-500 mb-1">Description</label>
                <input className={inputClass} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Optional description" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Metric *</label>
                <select className={inputClass} value={form.metric} onChange={(e) => setForm((f) => ({ ...f, metric: e.target.value as Challenge["metric"] }))}>
                  <option value="MISSIONS_COMPLETED">Missions Completed</option>
                  <option value="TOTAL_POINTS">Total Points Earned</option>
                  <option value="SHOUTOUTS_SENT">Shoutouts Sent</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Target *</label>
                <input type="number" min="1" className={inputClass} value={form.targetValue} onChange={(e) => setForm((f) => ({ ...f, targetValue: e.target.value }))} placeholder="e.g. 50" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Start Date *</label>
                <input type="date" className={inputClass} value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">End Date *</label>
                <input type="date" className={inputClass} value={form.endDate} onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button type="submit" disabled={saving} className="bg-[#111827] text-white text-sm font-semibold px-5 py-2 rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-50">{saving ? "Creating…" : "Create Challenge"}</button>
              <button type="button" onClick={() => setShowForm(false)} className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2 rounded-xl border border-gray-200 transition-colors">Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Loading…</div>
        ) : challenges.length === 0 ? (
          <div className="flex flex-col items-center py-16 gap-3"><Swords className="w-8 h-8 text-gray-300" /><p className="text-gray-400 text-sm">No challenges yet. Create one above.</p></div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Title</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Metric</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Target</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Period</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
              </tr>
            </thead>
            <tbody>
              {challenges.map((c) => (
                <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors">
                  <td className="px-6 py-3"><p className="font-medium text-gray-900">{c.title}</p>{c.description && <p className="text-xs text-gray-400 truncate max-w-xs">{c.description}</p>}</td>
                  <td className="px-6 py-3 text-gray-600">{metricLabel[c.metric]}</td>
                  <td className="px-6 py-3 font-semibold text-gray-800">{c.targetValue.toLocaleString()}</td>
                  <td className="px-6 py-3 text-gray-500 text-xs">{new Date(c.startDate).toLocaleDateString()} — {new Date(c.endDate).toLocaleDateString()}</td>
                  <td className="px-6 py-3">
                    <button onClick={() => handleToggleActive(c)} disabled={togglingId === c.id} className={`text-xs font-semibold px-3 py-1 rounded-full border transition-colors disabled:opacity-50 ${c.isActive ? "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100" : "bg-gray-100 border-gray-200 text-gray-500 hover:bg-gray-200"}`}>
                      {togglingId === c.id ? "…" : c.isActive ? "Active" : "Inactive"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
