"use client";

import { useEffect, useRef, useState } from "react";
import { useApiClient } from "@/lib/hooks/useApiClient";
import { useAuth } from "@/lib/auth/AuthProvider";
import { uploadToCloudinary } from "@/lib/cloudinary/upload";
import { Loader2, Pencil, Pill, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Pagination } from "@/components/ui/pagination";
import { LOW_STOCK_THRESHOLD } from "@/lib/constants/stock";
import { MEDICINE_REQUEST_STATUS_BADGE } from "@/lib/constants/medicineRequestStatus";
import type { Medicine, MedicineRequest, AddForm, EditForm } from "./types";

const statusChip = MEDICINE_REQUEST_STATUS_BADGE;

const inputClass =
  "w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500/30 bg-white";

export default function AdminMedicinePage() {
  const { apiFetch } = useApiClient();
  const { user, token, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<"catalog" | "inventory" | "requests">("catalog");

  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());
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
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [invPage, setInvPage] = useState(1);
  const [invPages, setInvPages] = useState(1);
  const [reqPage, setReqPage] = useState(1);
  const [reqPages, setReqPages] = useState(1);
  const [prevReqFilters, setPrevReqFilters] = useState({ dateFrom, dateTo, statusFilter });

  function handleTabChange(tab: "catalog" | "inventory" | "requests") {
    setActiveTab(tab);
    if (tab === "inventory") setInvPage(1);
    if (tab === "requests") setReqPage(1);
  }

  useEffect(() => {
    if (authLoading || !user) return;
    queueMicrotask(() => setLoadingMeds(true));
    apiFetch<{ data: Medicine[]; pages: number }>(`/api/admin/medicine?page=${invPage}`)
      .then((r) => { setMedicines(r.data); setInvPages(r.pages); })
      .catch(console.error)
      .finally(() => setLoadingMeds(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user, invPage]);

  useEffect(() => {
    if (authLoading || !user) return;
    queueMicrotask(() => setLoadingReqs(true));
    const params = new URLSearchParams({ page: String(reqPage) });
    if (dateFrom) params.set("from", dateFrom);
    if (dateTo) params.set("to", dateTo);
    if (statusFilter) params.set("status", statusFilter);
    apiFetch<{ data: MedicineRequest[]; pages: number }>(`/api/admin/medicine/requests?${params}`)
      .then((r) => { setRequests(r.data); setReqPages(r.pages); })
      .catch(console.error)
      .finally(() => setLoadingReqs(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user, reqPage, dateFrom, dateTo, statusFilter]);

  if (
    dateFrom !== prevReqFilters.dateFrom ||
    dateTo !== prevReqFilters.dateTo ||
    statusFilter !== prevReqFilters.statusFilter
  ) {
    setPrevReqFilters({ dateFrom, dateTo, statusFilter });
    setReqPage(1);
  }

  function clearFilters() {
    setDateFrom("");
    setDateTo("");
    setStatusFilter("");
    setReqFilter("");
  }

  async function handleAdd() {
    if (!addForm.name.trim() || !addForm.caption.trim() || !addForm.stockQuantity) {
      toast.error("Please fill in all required fields.");
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
      toast.success("Medicine added successfully.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add medicine");
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
      toast.success("Medicine updated successfully.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleStockSave(med: Medicine) {
    const raw = inventoryEdits[med.id];
    if (raw === undefined) return;
    const qty = parseInt(raw, 10);
    if (isNaN(qty) || qty < 0) { toast.error("Enter a valid stock number."); return; }
    setSavingStock(med.id);
    try {
      const res = await apiFetch<{ data: Medicine }>(`/api/admin/medicine/${med.id}`, {
        method: "PATCH",
        body: JSON.stringify({ stockQuantity: qty }),
      });
      setMedicines((prev) => prev.map((m) => (m.id === med.id ? res.data : m)));
      setInventoryEdits((prev) => { const next = { ...prev }; delete next[med.id]; return next; });
      toast.success("Stock updated.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update stock");
    } finally {
      setSavingStock(null);
    }
  }

  async function confirmDelete(med: Medicine) {
    setDeleteConfirmId(null);
    try {
      await apiFetch(`/api/admin/medicine/${med.id}`, { method: "DELETE" });
      setMedicines((prev) => prev.filter((m) => m.id !== med.id));
      toast.success(`"${med.name}" deleted.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
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
              m.id === req.medicine.id ? { ...m, stockQuantity: Math.max(0, m.stockQuantity - req.quantity) } : m
            )
          );
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
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

      <div role="tablist" aria-label="Medicine views" className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {(["catalog", "inventory", "requests"] as const).map((tab) => (
          <button
            key={tab}
            role="tab"
            aria-selected={activeTab === tab}
            onClick={() => handleTabChange(tab)}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors capitalize focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-gray-900 ${
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
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-command-black text-white rounded-xl hover:bg-gray-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-gray-900"
            >
               <Plus className="w-4 h-4" aria-hidden="true" />
              Add Medicine
            </button>
          </div>

          {showAddForm && (
            <div className="bg-white rounded-card border border-table-border p-5 space-y-4">
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
                     inputMode="numeric"
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
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Photo <span className="normal-case font-normal text-gray-500">(optional)</span></label>
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
                       <X className="w-3 h-3" aria-hidden="true" />
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
                  className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-gray-900"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAdd}
                  disabled={addingMed}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-command-black rounded-xl hover:bg-gray-800 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-gray-900"
                >
                   {addingMed ? <><Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Uploading…</> : "Add Medicine"}
                </button>
              </div>
            </div>
          )}

          {loadingMeds ? (
            <div className="flex items-center justify-center gap-2 text-gray-500 py-12">
              <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
              <span>Loading…</span>
            </div>
          ) : medicines.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12">
              <Pill className="w-8 h-8 text-gray-300" aria-hidden="true" />
              <p className="text-sm text-gray-500">No medicines yet. Add one above.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              {medicines.map((med) => (
                <div
                  key={med.id}
                  className={`bg-white rounded-card border border-table-border overflow-hidden flex flex-col ${!med.isActive ? "opacity-50" : ""}`}
                >
                  <div className="aspect-square bg-gray-50 overflow-hidden relative">
                    {med.imageUrl && !failedImages.has(med.id) ? (
                      <img
                        src={med.imageUrl}
                        alt={med.name}
                        className="w-full h-full object-cover"
                        onError={() => setFailedImages((prev) => new Set(prev).add(med.id))}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gray-100">
                         <Pill className="w-10 h-10 text-gray-300" aria-hidden="true" />
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
                      {med.stockQuantity === 0 ? "Out of stock" : `${med.stockQuantity} in stock`}
                    </p>
                    {deleteConfirmId === med.id ? (
                      <div className="mt-2 flex items-center gap-1.5 text-xs">
                        <span className="text-gray-700 font-medium flex-1">Delete?</span>
                        <button
                          onClick={() => confirmDelete(med)}
                          className="px-2.5 py-1.5 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
                        >
                          Yes
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(null)}
                          className="px-2.5 py-1.5 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900"
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-1 mt-2">
                        <button
                          onClick={() => openEdit(med)}
                          className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs font-medium border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-gray-900"
                        >
                           <Pencil className="w-3 h-3" aria-hidden="true" /> Edit
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(med.id)}
                          className="p-1.5 border border-gray-200 rounded-lg text-red-400 hover:bg-red-50 hover:border-red-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-red-500"
                        >
                           <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "inventory" && (
        loadingMeds ? (
          <div className="flex items-center justify-center gap-2 text-gray-500 py-12">
            <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
            <span>Loading…</span>
          </div>
        ) : medicines.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12">
            <Pill className="w-8 h-8 text-gray-300" aria-hidden="true" />
            <p className="text-sm text-gray-500">No medicines yet.</p>
          </div>
        ) : (
          <>
          {/* Desktop table */}
          <div className="hidden sm:block bg-white rounded-card border border-table-border overflow-clip">
            <div className="overflow-auto max-h-[70vh] scroll-hint">
            <table className="w-full border-collapse" aria-label="Medicine catalog">
              <thead className="sticky top-0 z-10 bg-table-head">
                <tr className="border-b border-table-border">
                  <th scope="col" className="text-left px-3.5 py-2.5 font-mono text-[10px] tracking-[0.09em] uppercase text-table-muted first:pl-5 last:pr-5">Medicine</th>
                  <th scope="col" className="text-left px-3.5 py-2.5 font-mono text-[10px] tracking-[0.09em] uppercase text-table-muted first:pl-5 last:pr-5">Stock</th>
                  <th scope="col" className="text-left px-3.5 py-2.5 font-mono text-[10px] tracking-[0.09em] uppercase text-table-muted first:pl-5 last:pr-5">Status</th>
                  <th scope="col" className="px-3.5 py-2.5 last:pr-5" />
                </tr>
              </thead>
              <tbody>
                {medicines.map((med, i) => {
                  const editVal = inventoryEdits[med.id];
                  const isDirty = editVal !== undefined && editVal !== String(med.stockQuantity);
                  const isSaving = savingStock === med.id;
                  return (
                    <tr key={med.id} className={`border-b border-row-border transition-colors hover:bg-row-hover ${i % 2 === 1 ? "bg-row-alt" : ""}`}>
                      <td className="px-3.5 py-[11px] text-[13px] first:pl-5 last:pr-5">
                        <div className="flex items-center gap-3">
                          {med.imageUrl && !failedImages.has(med.id) ? (
                            <img
                              src={med.imageUrl}
                              alt={med.name}
                              className="w-9 h-9 rounded-lg object-cover border border-gray-100 shrink-0"
                              onError={() => setFailedImages((prev) => new Set(prev).add(med.id))}
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-lg border border-gray-100 bg-gray-100 flex items-center justify-center shrink-0">
                               <Pill className="w-4 h-4 text-gray-300" aria-hidden="true" />
                            </div>
                          )}
                          <span className="font-medium text-gray-900">{med.name}</span>
                        </div>
                      </td>
                      <td className="px-3.5 py-[11px] text-[13px] first:pl-5 last:pr-5">
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            inputMode="numeric"
                            min="0"
                            value={editVal ?? String(med.stockQuantity)}
                            onChange={(e) =>
                              setInventoryEdits((prev) => ({ ...prev, [med.id]: e.target.value }))
                            }
                            className="w-24 px-2 py-1 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500/30"
                          />
                          <span className={`text-xs font-medium ${
                            med.stockQuantity === 0
                              ? "text-red-500"
                              : med.stockQuantity <= LOW_STOCK_THRESHOLD
                              ? "text-amber-500"
                              : "text-emerald-600"
                          }`}>
                            {med.stockQuantity === 0 ? "Out of stock" : med.stockQuantity <= LOW_STOCK_THRESHOLD ? "Low stock" : "in stock"}
                          </span>
                        </div>
                      </td>
                      <td className="px-3.5 py-[11px] text-[13px] first:pl-5 last:pr-5">
                        <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${med.isActive ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                          {med.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-3.5 py-[11px] text-[13px] first:pl-5 last:pr-5 text-right">
                        <button
                          onClick={() => handleStockSave(med)}
                          disabled={!isDirty || isSaving}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-command-black text-white rounded-lg hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-gray-900"
                        >
                           {isSaving ? <><Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" /> Saving…</> : "Save"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          </div>

          {/* Mobile cards */}
          <div className="block sm:hidden space-y-3">
            {medicines.map((med) => {
              const editVal = inventoryEdits[med.id];
              const isDirty = editVal !== undefined && editVal !== String(med.stockQuantity);
              const isSaving = savingStock === med.id;
              return (
                <div key={med.id} className="bg-white rounded-card border border-table-border p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    {med.imageUrl && !failedImages.has(med.id) ? (
                      <img
                        src={med.imageUrl}
                        alt={med.name}
                        className="w-10 h-10 rounded-lg object-cover border border-gray-100 shrink-0"
                        onError={() => setFailedImages((prev) => new Set(prev).add(med.id))}
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-lg border border-gray-100 bg-gray-100 flex items-center justify-center shrink-0">
                        <Pill className="w-5 h-5 text-gray-300" aria-hidden="true" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 text-sm truncate">{med.name}</p>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${med.isActive ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                        {med.isActive ? "Active" : "Inactive"}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-gray-500 shrink-0">Stock</label>
                    <input
                      type="number"
                      inputMode="numeric"
                      min="0"
                      value={editVal ?? String(med.stockQuantity)}
                      onChange={(e) =>
                        setInventoryEdits((prev) => ({ ...prev, [med.id]: e.target.value }))
                      }
                      className="flex-1 w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500/30"
                    />
                    <span className={`text-xs font-medium shrink-0 ${
                      med.stockQuantity === 0
                        ? "text-red-500"
                        : med.stockQuantity <= LOW_STOCK_THRESHOLD
                        ? "text-amber-500"
                        : "text-emerald-600"
                    }`}>
                      {med.stockQuantity === 0 ? "Out" : med.stockQuantity <= LOW_STOCK_THRESHOLD ? "Low" : "OK"}
                    </span>
                    <button
                      onClick={() => handleStockSave(med)}
                      disabled={!isDirty || isSaving}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-command-black text-white rounded-lg hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-gray-900 shrink-0"
                    >
                      {isSaving ? <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" /> : "Save"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="pt-3">
            <Pagination page={invPage} pages={invPages} onPageChange={setInvPage} />
          </div>
          </>
        )
      )}

      {activeTab === "requests" && (
        <div className="space-y-6">
          {loadingReqs ? (
            <div className="flex items-center justify-center gap-2 text-gray-500 py-12">
              <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
              <span>Loading…</span>
            </div>
          ) : (
            <>
              {pending.length > 0 && (
                <div>
                  <h2 className="text-base font-semibold text-gray-900 mb-3">
                    Pending ({pending.length})
                  </h2>
                   {/* Desktop table */}
                   <div className="hidden sm:block bg-white rounded-card border border-table-border overflow-clip">
                     <div className="overflow-auto max-h-[70vh] scroll-hint">
                     <table className="w-full border-collapse" aria-label="Pending medicine requests">
                       <thead className="sticky top-0 z-10 bg-table-head">
                          <tr className="border-b border-table-border">
                            <th scope="col" className="text-left px-3.5 py-2.5 font-mono text-[10px] tracking-[0.09em] uppercase text-table-muted first:pl-5 last:pr-5">Employee</th>
                            <th scope="col" className="text-left px-3.5 py-2.5 font-mono text-[10px] tracking-[0.09em] uppercase text-table-muted first:pl-5 last:pr-5">Medicine</th>
                            <th scope="col" className="text-left px-3.5 py-2.5 font-mono text-[10px] tracking-[0.09em] uppercase text-table-muted first:pl-5 last:pr-5">Qty</th>
                            <th scope="col" className="text-left px-3.5 py-2.5 font-mono text-[10px] tracking-[0.09em] uppercase text-table-muted first:pl-5 last:pr-5">Requested</th>
                            <th scope="col" className="px-3.5 py-2.5 last:pr-5" />
                          </tr>
                       </thead>
                      <tbody>
                        {pending.map((r, i) => (
                          <tr key={r.id} className={`border-b border-row-border transition-colors hover:bg-row-hover ${i % 2 === 1 ? "bg-row-alt" : ""}`}>
                            <td className="px-3.5 py-[11px] text-[13px] first:pl-5 last:pr-5 font-medium text-gray-900">{r.user.displayName}</td>
                            <td className="px-3.5 py-[11px] text-[13px] first:pl-5 last:pr-5 text-gray-700">{r.medicine.name}</td>
                            <td className="px-3.5 py-[11px] text-[13px] first:pl-5 last:pr-5 text-gray-700">{r.quantity}</td>
                            <td className="px-3.5 py-[11px] text-[13px] first:pl-5 last:pr-5 text-gray-500">
                              {new Date(r.createdAt).toLocaleDateString("en-US", {
                                month: "short", day: "numeric", year: "numeric",
                              })}
                            </td>
                            <td className="px-3.5 py-[11px] text-[13px] first:pl-5 last:pr-5">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => handleAction(r.id, "approve")}
                                  disabled={actioningId === r.id}
                                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-emerald-700"
                                >
                                  {actioningId === r.id ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                                  Approve
                                </button>
                                <button
                                  onClick={() => handleAction(r.id, "reject")}
                                  disabled={actioningId === r.id}
                                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold border border-red-200 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-red-500"
                                >
                                  {actioningId === r.id ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
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

                  {/* Mobile cards */}
                  <div className="block sm:hidden space-y-3">
                    {pending.map((r) => (
                      <div key={r.id} className="bg-white rounded-card border border-table-border p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="font-semibold text-gray-900 text-sm">{r.user.displayName}</p>
                          <span className="text-xs text-gray-500">
                            {new Date(r.createdAt).toLocaleDateString("en-US", {
                              month: "short", day: "numeric", year: "numeric",
                            })}
                          </span>
                        </div>
                          <p className="text-gray-700 text-sm">{r.medicine.name} × {r.quantity}</p>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleAction(r.id, "approve")}
                            disabled={actioningId === r.id}
                            className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-xs font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-emerald-700"
                          >
                            {actioningId === r.id ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                            Approve
                          </button>
                          <button
                            onClick={() => handleAction(r.id, "reject")}
                            disabled={actioningId === r.id}
                            className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-xs font-semibold border border-red-200 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-red-500"
                          >
                            {actioningId === r.id ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                            Reject
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <div className="mb-3 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 className="text-base font-semibold text-gray-900">History</h2>
                    {(dateFrom || dateTo || statusFilter || reqFilter) && (
                      <button
                        onClick={clearFilters}
                        className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 transition-colors"
                      >
                        <X className="w-3 h-3" /> Clear filters
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap items-end gap-2">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">From</label>
                      <input
                        type="date"
                        value={dateFrom}
                        onChange={(e) => setDateFrom(e.target.value)}
                        className="px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500/30"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">To</label>
                      <input
                        type="date"
                        value={dateTo}
                        onChange={(e) => setDateTo(e.target.value)}
                        className="px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500/30"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Status</label>
                      <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500/30 bg-white"
                      >
                        <option value="">All</option>
                        <option value="PENDING">Pending</option>
                        <option value="APPROVED">Approved</option>
                        <option value="REJECTED">Rejected</option>
                      </select>
                    </div>
                    <div className="flex flex-col gap-1 flex-1 min-w-[160px]">
                      <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Search</label>
                      <input
                        placeholder="Employee or medicine…"
                        value={reqFilter}
                        onChange={(e) => setReqFilter(e.target.value)}
                        className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500/30"
                      />
                    </div>
                  </div>
                </div>
                {filteredHistory.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-2 py-8">
                    <Pill className="w-8 h-8 text-gray-300" aria-hidden="true" />
                    <p className="text-sm text-gray-500">No history yet.</p>
                  </div>
                ) : (
                  <>
                    {/* Desktop table */}
                    <div className="hidden sm:block bg-white rounded-card border border-table-border overflow-clip">
                      <div className="overflow-auto max-h-[70vh] scroll-hint">
                      <table className="w-full border-collapse" aria-label="Medicine request history">
                        <thead className="sticky top-0 z-10 bg-table-head">
                          <tr className="border-b border-table-border">
                            <th scope="col" className="text-left px-3.5 py-2.5 font-mono text-[10px] tracking-[0.09em] uppercase text-table-muted first:pl-5 last:pr-5">Employee</th>
                            <th scope="col" className="text-left px-3.5 py-2.5 font-mono text-[10px] tracking-[0.09em] uppercase text-table-muted first:pl-5 last:pr-5">Medicine</th>
                            <th scope="col" className="text-left px-3.5 py-2.5 font-mono text-[10px] tracking-[0.09em] uppercase text-table-muted first:pl-5 last:pr-5">Qty</th>
                            <th scope="col" className="text-left px-3.5 py-2.5 font-mono text-[10px] tracking-[0.09em] uppercase text-table-muted first:pl-5 last:pr-5">Requested</th>
                            <th scope="col" className="text-left px-3.5 py-2.5 font-mono text-[10px] tracking-[0.09em] uppercase text-table-muted first:pl-5 last:pr-5">Status</th>
                            <th scope="col" className="text-left px-3.5 py-2.5 font-mono text-[10px] tracking-[0.09em] uppercase text-table-muted first:pl-5 last:pr-5">Actioned by</th>
                          </tr>
                        </thead>
                       <tbody>
                         {filteredHistory.map((r, i) => (
                           <tr
                             key={r.id}
                             className={`border-b border-row-border transition-colors hover:bg-row-hover ${i % 2 === 1 ? "bg-row-alt" : ""}`}
                           >
                              <td className="px-3.5 py-[11px] text-[13px] first:pl-5 last:pr-5 font-medium text-gray-900">{r.user.displayName}</td>
                              <td className="px-3.5 py-[11px] text-[13px] first:pl-5 last:pr-5 text-gray-700">{r.medicine.name}</td>
                              <td className="px-3.5 py-[11px] text-[13px] first:pl-5 last:pr-5 text-gray-700">{r.quantity}</td>
                              <td className="px-3.5 py-[11px] text-[13px] first:pl-5 last:pr-5 text-gray-500">
                               {new Date(r.createdAt).toLocaleDateString("en-US", {
                                 month: "short", day: "numeric", year: "numeric",
                               })}
                             </td>
                             <td className="px-3.5 py-[11px] text-[13px] first:pl-5 last:pr-5">
                               <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusChip[r.status]}`}>
                                 {r.status.charAt(0) + r.status.slice(1).toLowerCase()}
                               </span>
                             </td>
                             <td className="px-3.5 py-[11px] text-[13px] first:pl-5 last:pr-5 text-gray-500">
                               {r.approvedBy?.displayName ?? "—"}
                             </td>
                           </tr>
                         ))}
                       </tbody>
                     </table>
                     </div>
                    </div>

                    {/* Mobile cards */}
                    <div className="block sm:hidden space-y-3">
                      {filteredHistory.map((r) => (
                        <div key={r.id} className="bg-white rounded-card border border-table-border p-4 space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="font-semibold text-gray-900 text-sm">{r.user.displayName}</p>
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusChip[r.status]}`}>
                              {r.status.charAt(0) + r.status.slice(1).toLowerCase()}
                            </span>
                          </div>
                        <p className="text-gray-700 text-sm">{r.medicine.name} × {r.quantity}</p>
                          <div className="flex items-center justify-between text-xs text-gray-500">
                            <span>
                              {new Date(r.createdAt).toLocaleDateString("en-US", {
                                month: "short", day: "numeric", year: "numeric",
                              })}
                            </span>
                            <span>by {r.approvedBy?.displayName ?? "—"}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
                <div className="pt-3">
                  <Pagination page={reqPage} pages={reqPages} onPageChange={setReqPage} />
                </div>
              </div>
            </>
          )}
        </div>
      )}

      <Dialog open={!!editingMed} onOpenChange={(open) => { if (!open) setEditingMed(null); }}>
        <DialogContent className="max-w-md p-6">
          <DialogHeader>
            <DialogTitle>Edit Medicine</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Generic Name</label>
              <input
                autoFocus
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
                inputMode="numeric"
                min="0"
                value={editForm.stockQuantity}
                onChange={(e) => setEditForm((f) => ({ ...f, stockQuantity: e.target.value }))}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Photo <span className="normal-case font-normal text-gray-500">(optional)</span></label>
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
                     <Pill className="w-6 h-6 text-gray-300" aria-hidden="true" />
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
                role="switch"
                aria-checked={editForm.isActive}
                aria-label="Active status"
                onClick={() => setEditForm((f) => ({ ...f, isActive: !f.isActive }))}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-gray-900 ${editForm.isActive ? "bg-emerald-500" : "bg-gray-200"}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${editForm.isActive ? "translate-x-6" : "translate-x-1"}`} />
              </button>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setEditingMed(null)}
              className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-gray-900"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveEdit}
              disabled={savingEdit}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-command-black rounded-xl hover:bg-gray-800 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-gray-900"
            >
               {savingEdit ? <><Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Saving…</> : "Save Changes"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
