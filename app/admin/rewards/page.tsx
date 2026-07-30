"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useApiClient } from "@/lib/hooks/useApiClient";
import { uploadToCloudinary } from "@/lib/cloudinary/upload";
import React from "react";
import { Pencil, Trash2, Plus, Package, Ticket, Star, Monitor, ImagePlus, X, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { Pagination } from "@/components/ui/pagination";
import { LOW_STOCK_THRESHOLD } from "@/lib/constants/stock";

type Reward = {
  id: string;
  name: string;
  description: string | null;
  imageUrls: string[];
  pointCost: number;
  stockQuantity: number;
  category: string;
  isActive: boolean;
};

const categoryOptions = ["PHYSICAL", "VOUCHER", "PRIVILEGE", "DIGITAL"];
const categoryIcon: Record<string, React.ElementType> = { PHYSICAL: Package, VOUCHER: Ticket, PRIVILEGE: Star, DIGITAL: Monitor };
// Colors match the employee marketplace's categoryConfig so a reward's category reads the same everywhere.
const categoryIconClass: Record<string, string> = { PHYSICAL: "text-orange-600", VOUCHER: "text-blue-600", PRIVILEGE: "text-indigo-600", DIGITAL: "text-emerald-600" };
const categoryLabel: Record<string, string> = { PHYSICAL: "Physical", VOUCHER: "Voucher", PRIVILEGE: "Privilege", DIGITAL: "Digital" };
const categoryBadgeClass: Record<string, string> = {
  PHYSICAL: "bg-orange-50 text-orange-700",
  VOUCHER: "bg-blue-50 text-blue-700",
  PRIVILEGE: "bg-indigo-50 text-indigo-700",
  DIGITAL: "bg-emerald-50 text-emerald-700",
};

const emptyForm = { name: "", description: "", pointCost: "", stockQuantity: "-1", category: "PHYSICAL" };

export default function AdminRewardsPage() {
  const { user, token, loading: authLoading } = useAuth();
  const { apiFetch } = useApiClient();
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const descriptionRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = descriptionRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 240)}px`;
  }, [form.description]);

  function showToast(t: "success" | "error", m: string) {
    setToast({ type: t, msg: m });
    setTimeout(() => setToast(null), 4000);
  }

  // Multi-image state
  const [existingImageUrls, setExistingImageUrls] = useState<string[]>([]);
  const [newImages, setNewImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  const totalImages = existingImageUrls.length + newImages.length;

  useEffect(() => {
    if (authLoading || !user) return;
    loadRewards();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user, page]);

  async function loadRewards() {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await apiFetch<{ data: Reward[]; pages: number }>(`/api/rewards?includeInactive=true&page=${page}`);
      setRewards(res.data);
      setPages(res.pages);
    } catch (err) {
      // Without this, a failed fetch silently rendered "No rewards yet" —
      // an admin could read that as an empty catalog and recreate rewards
      // that already exist.
      setLoadError(err instanceof Error ? err.message : "Failed to load rewards.");
    } finally {
      setLoading(false);
    }
  }

  function handleImagePick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    const remaining = 3 - existingImageUrls.length;
    const combined = [...newImages, ...files].slice(0, remaining);
    imagePreviews.forEach((url) => URL.revokeObjectURL(url));
    setNewImages(combined);
    setImagePreviews(combined.map((f) => URL.createObjectURL(f)));
    e.target.value = "";
  }

  function removeNewImage(idx: number) {
    URL.revokeObjectURL(imagePreviews[idx]);
    const updated = newImages.filter((_, i) => i !== idx);
    setNewImages(updated);
    setImagePreviews(updated.map((f) => URL.createObjectURL(f)));
  }

  function removeExistingImage(idx: number) {
    setExistingImageUrls((prev) => prev.filter((_, i) => i !== idx));
  }

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(false);
    setExistingImageUrls([]);
    imagePreviews.forEach((url) => URL.revokeObjectURL(url));
    setNewImages([]);
    setImagePreviews([]);
    setError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      setUploading(true);
      const uploadedUrls = await Promise.all(newImages.map((f) => uploadToCloudinary(f, token!)));
      setUploading(false);
      const imageUrls = [...existingImageUrls, ...uploadedUrls];

      const payload = {
        name: form.name,
        description: form.description || undefined,
        imageUrls,
        pointCost: Number(form.pointCost),
        stockQuantity: Number(form.stockQuantity),
        category: form.category,
      };

      if (editingId) {
        await apiFetch(`/api/rewards/${editingId}`, { method: "PATCH", body: JSON.stringify(payload) });
      } else {
        await apiFetch("/api/rewards", { method: "POST", body: JSON.stringify(payload) });
      }

      resetForm();
      await loadRewards();
    } catch (err) {
      setUploading(false);
      const msg = err instanceof Error ? err.message : "Failed to save";
      setError(msg);
      showToast("error", msg);
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
    setExistingImageUrls(reward.imageUrls ?? []);
    imagePreviews.forEach((url) => URL.revokeObjectURL(url));
    setNewImages([]);
    setImagePreviews([]);
    setEditingId(reward.id);
    setShowForm(true);
  }

  async function confirmDelete(id: string) {
    try {
      await apiFetch(`/api/rewards/${id}`, { method: "DELETE" });
      setDeleteConfirmId(null);
      showToast("success", "Reward deleted.");
      await loadRewards();
    } catch (err) {
      setDeleteConfirmId(null);
      showToast("error", err instanceof Error ? err.message : "Failed to delete reward.");
    }
  }

  async function toggleActive(r: Reward) {
    setTogglingId(r.id);
    try {
      await apiFetch(`/api/rewards/${r.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !r.isActive }),
      });
      showToast("success", r.isActive ? "Reward hidden." : "Reward is now visible.");
      await loadRewards();
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Failed to update.");
    } finally {
      setTogglingId(null);
    }
  }

  const inputClass =
    "w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-navy-500/30 focus:border-navy-400 bg-white";
  const selectClass =
    "w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-navy-500/30 bg-white";
  const thClass =
    "text-left px-3.5 py-2.5 font-mono text-[10px] tracking-[0.09em] uppercase text-table-muted first:pl-5 last:pr-5";
  const tdClass = "px-3.5 py-[11px] text-[13px] first:pl-5 last:pr-5";

  return (
    <div className="space-y-6 max-w-5xl">
      {loadError && (
        <div role="alert" className="px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700 flex items-center justify-between gap-3">
          <span>{loadError}</span>
          <button
            onClick={loadRewards}
            className="font-medium underline underline-offset-2 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-red-600"
          >
            Retry
          </button>
        </div>
      )}
      {toast && (
        <div
          role="alert"
          className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium shadow-sm border ${
            toast.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-red-50 border-red-200 text-red-800"
          }`}
        >
          {toast.type === "success" ? (
            <CheckCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
          )}
          {toast.msg}
        </div>
      )}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Rewards</h1>
          <p className="text-gray-500 text-sm mt-1">Manage the rewards marketplace.</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
           className="bg-command-black text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-gray-800 flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-900"
        >
          <Plus className="w-4 h-4" aria-hidden="true" /> Add Reward
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-card border border-table-border overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-800">
              {editingId ? "Edit Reward" : "New Reward"}
            </h2>
          </div>
          <div className="px-6 py-5">
            <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                  ref={descriptionRef}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Optional description"
                  className={inputClass + " resize-none"}
                  style={{ minHeight: "4.5rem", overflowY: "auto", scrollbarGutter: "stable" }}
                />
              </div>

              {/* Photos — up to 3 */}
              <div className="col-span-2 space-y-1.5">
                <label className="text-sm font-medium text-gray-700">
                  Photos <span className="text-gray-500 font-normal">(up to 3, optional)</span>
                </label>
                <div className="flex items-center gap-2 flex-wrap">
                  {existingImageUrls.map((src, i) => (
                    <div key={src} className="relative w-20 h-20 rounded-xl overflow-hidden border border-gray-200">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={src} alt="" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removeExistingImage(i)}
                        className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-gray-800/70 text-white flex items-center justify-center hover:bg-red-600 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  {imagePreviews.map((src, i) => (
                    <div key={i} className="relative w-20 h-20 rounded-xl overflow-hidden border border-gray-200">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={src} alt="" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removeNewImage(i)}
                        className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-gray-800/70 text-white flex items-center justify-center hover:bg-red-600 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  {totalImages < 3 && (
                    <label className={`flex flex-col items-center justify-center w-20 h-20 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-navy-400 transition-colors ${uploading ? "opacity-50 pointer-events-none" : ""}`}>
                      <ImagePlus className="w-5 h-5 text-gray-500" aria-hidden="true" />
                      <span className="text-[10px] text-gray-500 mt-0.5">{uploading ? "Uploading…" : "Add"}</span>
                      <input type="file" accept="image/*" multiple className="hidden" onChange={handleImagePick} disabled={uploading} />
                    </label>
                  )}
                </div>
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
                  disabled={submitting || uploading}
                   className="bg-command-black text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-gray-800 disabled:opacity-50 flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-900"
                >
                  {(uploading || submitting) && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {uploading ? "Uploading…" : submitting ? "Saving…" : editingId ? "Save Changes" : "Add Reward"}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="border border-gray-200 text-gray-600 px-4 py-2 rounded-xl text-sm font-semibold hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-900"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="bg-white rounded-card border border-table-border overflow-clip">
        {/* Mobile card layout */}
        <div className="md:hidden">
          {loading ? (
            <div className="py-8"><div role="status" aria-live="polite" className="flex items-center justify-center gap-2 text-gray-500 text-sm"><Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />Loading…</div></div>
          ) : rewards.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-8">
              <Package className="w-8 h-8 text-gray-300" aria-hidden="true" />
              <p className="text-sm text-gray-500">No rewards yet. Add your first one!</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {rewards.map((r) => (
                <div key={r.id} className={`px-4 py-4 space-y-3 ${!r.isActive ? "opacity-60" : ""}`}>
                  <div className="flex items-start gap-3">
                    {r.imageUrls?.[0] && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.imageUrls[0]} alt={`${r.name} reward image`} className="w-14 h-14 rounded-lg object-cover border border-gray-100 shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900 truncate">{r.name}</p>
                        {!r.isActive && (
                          <span className="text-[10px] font-semibold bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full shrink-0">Hidden</span>
                        )}
                      </div>
                      {r.description && <p className="text-xs text-gray-500 truncate">{r.description}</p>}
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                        <span className={`font-semibold px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${categoryBadgeClass[r.category] ?? "bg-gray-100 text-gray-600"}`}>
                          {(() => { const CI = categoryIcon[r.category]; return CI ? <CI className={`w-3 h-3 ${categoryIconClass[r.category] ?? ""}`} aria-hidden="true" /> : null; })()} {categoryLabel[r.category] ?? r.category}
                        </span>
                        <span className="font-semibold text-navy-600">{r.pointCost.toLocaleString()} pts</span>
                        <span className={
                          r.stockQuantity === -1 ? "" : r.stockQuantity === 0 ? "text-red-500 font-medium" : r.stockQuantity <= LOW_STOCK_THRESHOLD ? "text-amber-600 font-medium" : ""
                        }>
                          {r.stockQuantity === -1 ? "Unlimited" : r.stockQuantity === 0 ? "Out of stock" : `Stock: ${r.stockQuantity}`}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                    <button
                      role="switch"
                      aria-checked={r.isActive}
                      aria-label={r.isActive ? `Hide ${r.name}` : `Show ${r.name}`}
                      disabled={togglingId === r.id}
                      onClick={() => toggleActive(r)}
                      className={`relative inline-flex h-5 w-10 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-900 disabled:opacity-50 disabled:cursor-not-allowed ${r.isActive ? "bg-emerald-500" : "bg-gray-300"}`}
                    >
                      <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${r.isActive ? "translate-x-5" : "translate-x-0.5"}`} />
                    </button>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEdit(r)}
                        className="border border-gray-200 text-gray-500 hover:text-gray-700 hover:bg-gray-50 p-1.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-900"
                        aria-label={`Edit ${r.name}`}
                      >
                        <Pencil className="w-3 h-3" aria-hidden="true" />
                      </button>
                      {deleteConfirmId === r.id ? (
                        <div className="flex items-center gap-1 text-xs">
                          <span className="text-gray-600 font-medium">Delete?</span>
                          <button onClick={() => confirmDelete(r.id)} className="px-2 py-1 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-900">Yes</button>
                          <button onClick={() => setDeleteConfirmId(null)} className="px-2 py-1 rounded-lg border border-gray-200 text-gray-600 font-semibold hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-900">No</button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirmId(r.id)}
                          className="border border-red-100 text-red-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-900"
                          aria-label={`Delete ${r.name}`}
                        >
                          <Trash2 className="w-3 h-3" aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Desktop table layout */}
        <div className="hidden md:block overflow-auto max-h-[70vh] scroll-hint">
        <table className="w-full border-collapse" aria-label="Rewards">
          <thead className="sticky top-0 z-10 bg-table-head">
            <tr className="border-b border-table-border">
              <th scope="col" className={thClass}>Reward</th>
              <th scope="col" className={thClass}>Category</th>
              <th scope="col" className={thClass}>Cost</th>
              <th scope="col" className={thClass}>Stock</th>
              <th scope="col" className={thClass}>Status</th>
              <th scope="col" className={thClass}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="text-center py-12"><div role="status" aria-live="polite" className="flex items-center justify-center gap-2 text-gray-500 text-sm"><Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />Loading…</div></td>
              </tr>
            ) : rewards.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Package className="w-8 h-8 text-gray-300" aria-hidden="true" />
                    <p className="text-table-muted text-[13px]">No rewards yet. Add your first one!</p>
                  </div>
                </td>
              </tr>
            ) : rewards.map((r, i) => (
              <tr key={r.id} className={`border-b border-row-border transition-colors hover:bg-row-hover ${i % 2 === 1 ? "bg-row-alt" : ""} ${!r.isActive ? "opacity-60" : ""}`}>
                <td className={tdClass}>
                  <div className="flex items-center gap-3">
                    {(r.imageUrls?.[0]) && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.imageUrls[0]} alt={`${r.name} reward image`} className="w-10 h-10 rounded-lg object-cover border border-gray-100 shrink-0" />
                    )}
                    <div>
                      <p className="font-medium text-gray-900 flex items-center gap-2">
                        {r.name}
                        {!r.isActive && (
                          <span className="text-[10px] font-semibold bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">
                            Hidden
                          </span>
                        )}
                      </p>
                      {r.description && <p className="text-xs text-gray-500 truncate max-w-xs">{r.description}</p>}
                    </div>
                  </div>
                </td>
                <td className={tdClass}>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${categoryBadgeClass[r.category] ?? "bg-gray-100 text-gray-600"}`}>
                    {(() => { const CI = categoryIcon[r.category]; return CI ? <CI className={`w-3 h-3 ${categoryIconClass[r.category] ?? ""}`} /> : null; })()} {categoryLabel[r.category] ?? r.category}
                  </span>
                </td>
                <td className={tdClass}>
                  <span className="font-semibold text-navy-600">{r.pointCost.toLocaleString()} pts</span>
                </td>
                <td className={tdClass}>
                  <span className={
                    r.stockQuantity === -1 ? "text-gray-600" : r.stockQuantity === 0 ? "text-red-500 font-medium" : r.stockQuantity <= LOW_STOCK_THRESHOLD ? "text-amber-600 font-medium" : "text-gray-600"
                  }>
                    {r.stockQuantity === -1 ? "Unlimited" : r.stockQuantity === 0 ? "Out of stock" : r.stockQuantity}
                  </span>
                </td>
                <td className={tdClass}>
                  <button
                    role="switch"
                    aria-checked={r.isActive}
                    aria-label={r.isActive ? `Hide ${r.name}` : `Show ${r.name}`}
                    disabled={togglingId === r.id}
                    onClick={() => toggleActive(r)}
                    className={`relative inline-flex h-5 w-10 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-900 disabled:opacity-50 disabled:cursor-not-allowed ${r.isActive ? "bg-emerald-500" : "bg-gray-300"}`}
                  >
                    <span
                      className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${r.isActive ? "translate-x-5" : "translate-x-0.5"}`}
                    />
                  </button>
                </td>
                <td className={tdClass}>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleEdit(r)}
                      className="border border-gray-200 text-gray-500 hover:text-gray-700 hover:bg-gray-50 p-1.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-900"
                      aria-label={`Edit ${r.name}`}
                    >
                      <Pencil className="w-3 h-3" aria-hidden="true" />
                    </button>
                    {deleteConfirmId === r.id ? (
                      <div className="flex items-center gap-1 text-xs">
                        <span className="text-gray-600 font-medium">Delete?</span>
                        <button
                          onClick={() => confirmDelete(r.id)}
                          className="px-2 py-1 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-900"
                        >
                          Yes
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(null)}
                          className="px-2 py-1 rounded-lg border border-gray-200 text-gray-600 font-semibold hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-900"
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirmId(r.id)}
                        className="border border-red-100 text-red-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-900"
                        aria-label={`Delete ${r.name}`}
                      >
                        <Trash2 className="w-3 h-3" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
      <Pagination page={page} pages={pages} onPageChange={setPage} />
    </div>
  );
}
