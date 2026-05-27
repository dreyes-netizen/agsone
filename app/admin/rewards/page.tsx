"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useApiClient } from "@/lib/hooks/useApiClient";
import React from "react";
import { Pencil, Trash2, Plus, Package, Ticket, Star, Monitor } from "lucide-react";

type Reward = {
  id: string;
  name: string;
  description: string | null;
  pointCost: number;
  stockQuantity: number;
  category: string;
  isActive: boolean;
};

const categoryOptions = ["PHYSICAL", "VOUCHER", "PRIVILEGE", "DIGITAL"];
const categoryIcon: Record<string, React.ElementType> = { PHYSICAL: Package, VOUCHER: Ticket, PRIVILEGE: Star, DIGITAL: Monitor };
const categoryIconClass: Record<string, string> = { PHYSICAL: "text-orange-600", VOUCHER: "text-blue-600", PRIVILEGE: "text-violet-600", DIGITAL: "text-emerald-600" };

const emptyForm = { name: "", description: "", pointCost: "", stockQuantity: "-1", category: "PHYSICAL" };

export default function AdminRewardsPage() {
  const { user, loading: authLoading } = useAuth();
  const { apiFetch } = useApiClient();
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (authLoading || !user) return;
    loadRewards();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user]);

  async function loadRewards() {
    const res = await apiFetch<{ data: Reward[] }>("/api/rewards");
    setRewards(res.data);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const payload = {
        name: form.name,
        description: form.description || undefined,
        pointCost: Number(form.pointCost),
        stockQuantity: Number(form.stockQuantity),
        category: form.category,
      };

      if (editingId) {
        await apiFetch(`/api/rewards/${editingId}`, { method: "PATCH", body: JSON.stringify(payload) });
      } else {
        await apiFetch("/api/rewards", { method: "POST", body: JSON.stringify(payload) });
      }

      setForm(emptyForm);
      setEditingId(null);
      setShowForm(false);
      await loadRewards();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSubmitting(false);
    }
  }

  function handleEdit(reward: Reward) {
    setForm({
      name: reward.name,
      description: reward.description ?? "",
      pointCost: String(reward.pointCost),
      stockQuantity: String(reward.stockQuantity),
      category: reward.category,
    });
    setEditingId(reward.id);
    setShowForm(true);
  }

  async function handleDelete(id: string) {
    if (!confirm("Remove this reward from the marketplace?")) return;
    await apiFetch(`/api/rewards/${id}`, { method: "DELETE" });
    await loadRewards();
  }

  const inputClass =
    "w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-navy-500/30 focus:border-navy-400 bg-white";
  const selectClass =
    "w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-navy-500/30 bg-white";
  const thClass =
    "text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide";
  const tdClass = "px-6 py-3";

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Rewards</h1>
          <p className="text-gray-500 text-sm mt-1">Manage the rewards marketplace.</p>
        </div>
        <button
          onClick={() => { setShowForm(true); setEditingId(null); setForm(emptyForm); }}
          className="bg-[#111827] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-gray-800 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Add Reward
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-800">
              {editingId ? "Edit Reward" : "New Reward"}
            </h2>
          </div>
          <div className="px-6 py-5">
            <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Name</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  placeholder="e.g. Tumbler, Extra Break Coupon"
                  className={inputClass}
                />
              </div>
              <div className="col-span-2 space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Optional description"
                  rows={2}
                  className={inputClass + " resize-none"}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Point Cost</label>
                <input
                  type="number"
                  min={1}
                  value={form.pointCost}
                  onChange={(e) => setForm({ ...form, pointCost: e.target.value })}
                  required
                  placeholder="e.g. 500"
                  className={inputClass}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Stock (-1 = unlimited)</label>
                <input
                  type="number"
                  min={-1}
                  value={form.stockQuantity}
                  onChange={(e) => setForm({ ...form, stockQuantity: e.target.value })}
                  required
                  className={inputClass}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Category</label>
                <select
                  value={form.category}
                  onChange={(e) => e.target.value && setForm({ ...form, category: e.target.value })}
                  className={selectClass}
                >
                  {categoryOptions.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              {error && <p className="col-span-2 text-red-500 text-sm">{error}</p>}
              <div className="col-span-2 flex gap-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-[#111827] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-gray-800 disabled:opacity-50"
                >
                  {submitting ? "Saving..." : editingId ? "Save Changes" : "Add Reward"}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setEditingId(null); }}
                  className="border border-gray-200 text-gray-600 px-4 py-2 rounded-xl text-sm font-semibold hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className={thClass}>Reward</th>
              <th className={thClass}>Category</th>
              <th className={thClass}>Cost</th>
              <th className={thClass}>Stock</th>
              <th className={thClass}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rewards.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center text-gray-400 py-8">No rewards yet. Add your first one!</td>
              </tr>
            ) : rewards.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50/60 transition-colors border-b border-gray-50">
                <td className={tdClass}>
                  <p className="font-medium text-gray-900">{r.name}</p>
                  {r.description && <p className="text-xs text-gray-400 truncate max-w-xs">{r.description}</p>}
                </td>
                <td className={tdClass}>
                  <span className="bg-gray-100 text-gray-600 text-xs font-semibold px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                    {(() => { const CI = categoryIcon[r.category]; return CI ? <CI className={`w-3 h-3 ${categoryIconClass[r.category] ?? ""}`} /> : null; })()} {r.category}
                  </span>
                </td>
                <td className={tdClass}>
                  <span className="font-semibold text-navy-600">{r.pointCost.toLocaleString()} pts</span>
                </td>
                <td className={`${tdClass} text-gray-600`}>
                  {r.stockQuantity === -1 ? "Unlimited" : r.stockQuantity}
                </td>
                <td className={tdClass}>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(r)}
                      className="border border-gray-200 text-gray-500 hover:text-gray-700 hover:bg-gray-50 p-1.5 rounded-lg"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => handleDelete(r.id)}
                      className="border border-red-100 text-red-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-lg"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
