"use client";

import { useEffect, useRef, useState } from "react";
import { useApiClient } from "@/lib/hooks/useApiClient";
import { useAuth } from "@/lib/auth/AuthProvider";
import { uploadToCloudinary } from "@/lib/cloudinary/upload";
import { Pencil, Pill, Plus, Trash2, X } from "lucide-react";

type Medicine = {
  id: string;
  name: string;
  imageUrl: string;
  caption: string;
  stockQuantity: number;
  isActive: boolean;
};

type MedicineRequest = {
  id: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: string;
  approvedAt: string | null;
  medicine: { id: string; name: string; imageUrl: string };
  user: { id: string; displayName: string; avatarUrl: string | null };
  approvedBy: { id: string; displayName: string } | null;
};

type AddForm = {
  name: string;
  caption: string;
  stockQuantity: string;
  imageFile: File | null;
  imagePreview: string;
};

type EditForm = {
  name: string;
  caption: string;
  stockQuantity: string;
  imageUrl: string;
  imageFile: File | null;
  imagePreview: string;
  isActive: boolean;
};

const statusChip: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-700",
  APPROVED: "bg-emerald-100 text-emerald-700",
  REJECTED: "bg-red-100 text-red-600",
};

const inputClass =
  "w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500/30 bg-white";

export default function AdminMedicinePage() {
  const { apiFetch } = useApiClient();
  const { user, token, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<"catalog" | "inventory" | "requests">("catalog");

  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [loadingMeds, setLoadingMeds] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState<AddForm>({
    name: "", caption: "", stockQuantity: "", imageFile: null, imagePreview: "",
  });
  const [addingMed, setAddingMed] = useState(false);
  const [editingMed, setEditingMed] = useState<Medicine | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({
    name: "", caption: "", stockQuantity: "", imageUrl: "", imageFile: null, imagePreview: "", isActive: true,
  });
  const [savingEdit, setSavingEdit] = useState(false);
  const addImageRef = useRef<HTMLInputElement>(null);
  const editImageRef = useRef<HTMLInputElement>(null);

  const [inventoryEdits, setInventoryEdits] = useState<Record<string, string>>({});
  const [savingStock, setSavingStock] = useState<string | null>(null);

  const [requests, setRequests] = useState<MedicineRequest[]>([]);
  const [loadingReqs, setLoadingReqs] = useState(true);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [reqFilter, setReqFilter] = useState("");

  useEffect(() => {
    if (authLoading || !user) return;
    Promise.all([
      apiFetch<{ data: Medicine[] }>("/api/admin/medicine").then((r) => setMedicines(r.data)),
      apiFetch<{ data: MedicineRequest[] }>("/api/admin/medicine/requests").then((r) => setRequests(r.data)),
    ])
      .catch(console.error)
      .finally(() => { setLoadingMeds(false); setLoadingReqs(false); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user]);

  async function handleAdd() {
    if (!addForm.name.trim() || !addForm.caption.trim() || !addForm.stockQuantity) {
      alert("Please fill in all required fields.");
      return;
    }
    setAddingMed(true);
    try {
      const imageUrl = addForm.imageFile ? await uploadToCloudinary(addForm.imageFile, token!) : "";
      const res = await apiFetch<{ data: Medicine }>("/api/admin/medicine", {
        method: "POST",
        body: JSON.stringify({
          name: addForm.name.trim(),
          caption: addForm.caption.trim(),
          stockQuantity: parseInt(addForm.stockQuantity, 10),
          imageUrl,
        }),
      });
      setMedicines((prev) => [...prev, res.data].sort((a, b) => a.name.localeCompare(b.name)));
      setAddForm({ name: "", caption: "", stockQuantity: "", imageFile: null, imagePreview: "" });
      setShowAddForm(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to add medicine");
    } finally {
      setAddingMed(false);
    }
  }

  function openEdit(med: Medicine) {
    setEditingMed(med);
    setEditForm({
      name: med.name,
      caption: med.caption,
      stockQuantity: String(med.stockQuantity),
      imageUrl: med.imageUrl,
      imageFile: null,
      imagePreview: "",
      isActive: med.isActive,
    });
  }

  async function handleSaveEdit() {
    if (!editingMed) return;
    setSavingEdit(true);
    try {
      let imageUrl = editForm.imageUrl;
      if (editForm.imageFile) {
        imageUrl = await uploadToCloudinary(editForm.imageFile, token!);
      }
      const res = await apiFetch<{ data: Medicine }>(`/api/admin/medicine/${editingMed.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: editForm.name.trim(),
          caption: editForm.caption.trim(),
          stockQuantity: parseInt(editForm.stockQuantity, 10),
          imageUrl,
          isActive: editForm.isActive,
        }),
      });
      setMedicines((prev) => prev.map((m) => (m.id === editingMed.id ? res.data : m)));
      setEditingMed(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleStockSave(med: Medicine) {
    const raw = inventoryEdits[med.id];
    if (raw === undefined) return;
    const qty = parseInt(raw, 10);
    if (isNaN(qty) || qty < 0) { alert("Enter a valid stock number."); return; }
    setSavingStock(med.id);
    try {
      const res = await apiFetch<{ data: Medicine }>(`/api/admin/medicine/${med.id}`, {
        method: "PATCH",
        body: JSON.stringify({ stockQuantity: qty }),
      });
      setMedicines((prev) => prev.map((m) => (m.id === med.id ? res.data : m)));
      setInventoryEdits((prev) => { const next = { ...prev }; delete next[med.id]; return next; });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update stock");
    } finally {
      setSavingStock(null);
    }
  }

  async function handleDelete(med: Medicine) {
    if (!confirm(`Delete "${med.name}"? This cannot be undone.`)) return;
    try {
      await apiFetch(`/api/admin/medicine/${med.id}`, { method: "DELETE" });
      setMedicines((prev) => prev.filter((m) => m.id !== med.id));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete");
    }
  }

  async function handleAction(requestId: string, action: "approve" | "reject") {
    setActioningId(requestId);
    try {
      const res = await apiFetch<{ data: { id: string; status: string; approvedAt: string } }>(
        `/api/admin/medicine/requests/${requestId}`,
        { method: "PATCH", body: JSON.stringify({ action }) }
      );
      const updated = res.data;
      setRequests((prev) =>
        prev.map((r) =>
          r.id === requestId
            ? { ...r, status: updated.status as MedicineRequest["status"], approvedAt: updated.approvedAt }
            : r
        )
      );
      if (action === "approve") {
        const req = requests.find((r) => r.id === requestId);
        if (req) {
          setMedicines((prev) =>
            prev.map((m) =>
              m.id === req.medicine.id ? { ...m, stockQuantity: Math.max(0, m.stockQuantity - 1) } : m
            )
          );
        }
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed");
    } finally {
      setActioningId(null);
    }
  }

  const pending = requests.filter((r) => r.status === "PENDING");
  const history = requests.filter((r) => r.status !== "PENDING");
  const filteredHistory = reqFilter
    ? history.filter(
        (r) =>
          r.medicine.name.toLowerCase().includes(reqFilter.toLowerCase()) ||
          r.user.displayName.toLowerCase().includes(reqFilter.toLowerCase())
      )
    : history;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Medicine</h1>
        <p className="text-gray-500 text-sm mt-1">Manage the medicine cabinet and dispense requests.</p>
      </div>

      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {(["catalog", "inventory", "requests"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-1.5 text-sm font-semibold rounded-lg transition-colors capitalize ${
              activeTab === tab ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab === "catalog" ? "Catalog" : tab === "inventory" ? "Inventory" : "Requests"}
            {tab === "requests" && pending.length > 0 && (
              <span className="ml-1.5 bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {pending.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {activeTab === "catalog" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-[#111827] text-white rounded-xl hover:bg-gray-800 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Medicine
            </button>
          </div>

          {showAddForm && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
              <h3 className="font-semibold text-gray-900">New Medicine</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Generic Name</label>
                  <input
                    value={addForm.name}
                    onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
                    className={inputClass}
                    placeholder="e.g. Paracetamol"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Starting Stock</label>
                  <input
                    type="number"
                    min="0"
                    value={addForm.stockQuantity}
                    onChange={(e) => setAddForm((f) => ({ ...f, stockQuantity: e.target.value }))}
                    className={inputClass}
                    placeholder="0"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Caption</label>
                <textarea
                  value={addForm.caption}
                  onChange={(e) => setAddForm((f) => ({ ...f, caption: e.target.value }))}
                  className={inputClass + " resize-none"}
                  placeholder="Short description of the medicine"
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Photo <span className="normal-case font-normal text-gray-400">(optional)</span></label>
                <input
                  ref={addImageRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) setAddForm((f) => ({ ...f, imageFile: file, imagePreview: URL.createObjectURL(file) }));
                  }}
                />
                {addForm.imagePreview ? (
                  <div className="relative w-24 h-24">
                    <img src={addForm.imagePreview} className="w-24 h-24 rounded-lg object-cover border border-gray-200" alt="" />
                    <button
                      onClick={() => setAddForm((f) => ({ ...f, imageFile: null, imagePreview: "" }))}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-gray-800 text-white rounded-full flex items-center justify-center"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => addImageRef.current?.click()}
                    className="px-4 py-2 text-sm border border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-gray-400 transition-colors"
                  >
                    Choose photo
                  </button>
                )}
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAdd}
                  disabled={addingMed}
                  className="px-4 py-2 text-sm font-semibold text-white bg-[#111827] rounded-xl hover:bg-gray-800 disabled:opacity-50"
                >
                  {addingMed ? "Uploading…" : "Add Medicine"}
                </button>
              </div>
            </div>
          )}

          {loadingMeds ? (
            <div className="text-center text-gray-400 py-12">Loading…</div>
          ) : medicines.length === 0 ? (
            <div className="text-center text-gray-400 py-12">No medicines yet. Add one above.</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {medicines.map((med) => (
                <div
                  key={med.id}
                  className={`bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col ${!med.isActive ? "opacity-50" : ""}`}
                >
                  <div className="aspect-square bg-gray-50 overflow-hidden relative">
                    {med.imageUrl ? (
                      <img src={med.imageUrl} alt={med.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gray-100">
                        <Pill className="w-10 h-10 text-gray-300" />
                      </div>
                    )}
                    {!med.isActive && (
                      <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                        <span className="text-white text-xs font-semibold bg-gray-800/80 px-2 py-0.5 rounded-full">
                          Inactive
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="p-3 flex flex-col gap-1 flex-1">
                    <p className="font-semibold text-gray-900 text-sm">{med.name}</p>
                    <p className="text-gray-500 text-xs line-clamp-2">{med.caption}</p>
                    <p className={`text-xs font-medium mt-1 ${med.stockQuantity === 0 ? "text-red-500" : "text-emerald-600"}`}>
                      {med.stockQuantity} in stock
                    </p>
                    <div className="flex gap-1 mt-2">
                      <button
                        onClick={() => openEdit(med)}
                        className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs font-medium border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
                      >
                        <Pencil className="w-3 h-3" /> Edit
                      </button>
                      <button
                        onClick={() => handleDelete(med)}
                        className="p-1.5 border border-gray-200 rounded-lg text-red-400 hover:bg-red-50 hover:border-red-200 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "inventory" && (
        loadingMeds ? (
          <div className="text-center text-gray-400 py-12">Loading…</div>
        ) : medicines.length === 0 ? (
          <div className="text-center text-gray-400 py-12">No medicines yet.</div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Medicine</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Stock</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {medicines.map((med) => {
                  const editVal = inventoryEdits[med.id];
                  const isDirty = editVal !== undefined && editVal !== String(med.stockQuantity);
                  const isSaving = savingStock === med.id;
                  return (
                    <tr key={med.id} className="border-t border-gray-50 hover:bg-gray-50/50 transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          {med.imageUrl ? (
                            <img src={med.imageUrl} alt={med.name} className="w-9 h-9 rounded-lg object-cover border border-gray-100 shrink-0" />
                          ) : (
                            <div className="w-9 h-9 rounded-lg border border-gray-100 bg-gray-100 flex items-center justify-center shrink-0">
                              <Pill className="w-4 h-4 text-gray-300" />
                            </div>
                          )}
                          <span className="font-medium text-gray-900">{med.name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="0"
                            value={editVal ?? String(med.stockQuantity)}
                            onChange={(e) =>
                              setInventoryEdits((prev) => ({ ...prev, [med.id]: e.target.value }))
                            }
                            className="w-20 px-2 py-1 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500/30"
                          />
                          <span className={`text-xs font-medium ${
                            med.stockQuantity === 0
                              ? "text-red-500"
                              : med.stockQuantity <= 3
                              ? "text-amber-500"
                              : "text-emerald-600"
                          }`}>
                            {med.stockQuantity === 0 ? "Out of stock" : med.stockQuantity <= 3 ? "Low stock" : "in stock"}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${med.isActive ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                          {med.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <button
                          onClick={() => handleStockSave(med)}
                          disabled={!isDirty || isSaving}
                          className="px-3 py-1.5 text-xs font-semibold bg-[#111827] text-white rounded-lg hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                          {isSaving ? "Saving…" : "Save"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          </div>
        )
      )}

      {activeTab === "requests" && (
        <div className="space-y-6">
          {loadingReqs ? (
            <div className="text-center text-gray-400 py-12">Loading…</div>
          ) : (
            <>
              {pending.length > 0 && (
                <div>
                  <h2 className="text-base font-semibold text-gray-900 mb-3">
                    Pending ({pending.length})
                  </h2>
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Employee</th>
                          <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Medicine</th>
                          <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Requested</th>
                          <th className="px-5 py-3" />
                        </tr>
                      </thead>
                      <tbody>
                        {pending.map((r) => (
                          <tr key={r.id} className="border-t border-gray-50">
                            <td className="px-5 py-3 font-medium text-gray-900">{r.user.displayName}</td>
                            <td className="px-5 py-3 text-gray-700">{r.medicine.name}</td>
                            <td className="px-5 py-3 text-gray-500 text-xs">
                              {new Date(r.createdAt).toLocaleDateString("en-US", {
                                month: "short", day: "numeric", year: "numeric",
                              })}
                            </td>
                            <td className="px-5 py-3">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => handleAction(r.id, "approve")}
                                  disabled={actioningId === r.id}
                                  className="px-3 py-1.5 text-xs font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                                >
                                  Approve
                                </button>
                                <button
                                  onClick={() => handleAction(r.id, "reject")}
                                  disabled={actioningId === r.id}
                                  className="px-3 py-1.5 text-xs font-semibold border border-red-200 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors"
                                >
                                  Reject
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
              )}

              <div>
                <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                  <h2 className="text-base font-semibold text-gray-900">History</h2>
                  <input
                    placeholder="Filter by employee or medicine…"
                    value={reqFilter}
                    onChange={(e) => setReqFilter(e.target.value)}
                    className="w-full sm:w-60 px-3 py-1.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-navy-500/30"
                  />
                </div>
                {filteredHistory.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-8">No history yet.</p>
                ) : (
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Employee</th>
                          <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Medicine</th>
                          <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Requested</th>
                          <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                          <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Actioned by</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredHistory.map((r) => (
                          <tr
                            key={r.id}
                            className="border-t border-gray-50 hover:bg-gray-50/60 transition-colors"
                          >
                            <td className="px-5 py-3 font-medium text-gray-900">{r.user.displayName}</td>
                            <td className="px-5 py-3 text-gray-700">{r.medicine.name}</td>
                            <td className="px-5 py-3 text-gray-500 text-sm">
                              {new Date(r.createdAt).toLocaleDateString("en-US", {
                                month: "short", day: "numeric", year: "numeric",
                              })}
                            </td>
                            <td className="px-5 py-3">
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusChip[r.status]}`}>
                                {r.status.charAt(0) + r.status.slice(1).toLowerCase()}
                              </span>
                            </td>
                            <td className="px-5 py-3 text-gray-500 text-sm">
                              {r.approvedBy?.displayName ?? "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {editingMed && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Edit Medicine</h2>
              <button onClick={() => setEditingMed(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Generic Name</label>
                <input
                  value={editForm.name}
                  onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Caption</label>
                <textarea
                  value={editForm.caption}
                  onChange={(e) => setEditForm((f) => ({ ...f, caption: e.target.value }))}
                  className={inputClass + " resize-none"}
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Stock Quantity</label>
                <input
                  type="number"
                  min="0"
                  value={editForm.stockQuantity}
                  onChange={(e) => setEditForm((f) => ({ ...f, stockQuantity: e.target.value }))}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Photo <span className="normal-case font-normal text-gray-400">(optional)</span></label>
                <input
                  ref={editImageRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) setEditForm((f) => ({ ...f, imageFile: file, imagePreview: URL.createObjectURL(file) }));
                  }}
                />
                <div className="flex items-center gap-3">
                  {(editForm.imagePreview || editForm.imageUrl) ? (
                    <img
                      src={editForm.imagePreview || editForm.imageUrl}
                      alt=""
                      className="w-16 h-16 rounded-lg object-cover border border-gray-200"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-lg border border-gray-200 bg-gray-100 flex items-center justify-center">
                      <Pill className="w-6 h-6 text-gray-300" />
                    </div>
                  )}
                  <button
                    onClick={() => editImageRef.current?.click()}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    Change photo
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Active</label>
                <button
                  type="button"
                  onClick={() => setEditForm((f) => ({ ...f, isActive: !f.isActive }))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${editForm.isActive ? "bg-emerald-500" : "bg-gray-200"}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${editForm.isActive ? "translate-x-6" : "translate-x-1"}`} />
                </button>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setEditingMed(null)}
                className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={savingEdit}
                className="px-4 py-2 text-sm font-semibold text-white bg-[#111827] rounded-xl hover:bg-gray-800 disabled:opacity-50"
              >
                {savingEdit ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
