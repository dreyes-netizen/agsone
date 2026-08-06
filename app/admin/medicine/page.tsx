"use client";

import { useEffect, useRef, useState } from "react";
import { useApiClient } from "@/lib/hooks/useApiClient";
import { useAuth } from "@/lib/auth/AuthProvider";
import { uploadToCloudinary } from "@/lib/cloudinary/upload";
import { Loader2, Pill, X } from "lucide-react";
import { toast } from "sonner";
import { Pagination } from "@/components/ui/pagination";
import { LOW_STOCK_THRESHOLD } from "@/lib/constants/stock";
import { MEDICINE_REQUEST_STATUS_BADGE } from "@/lib/constants/medicineRequestStatus";
import type { Medicine, MedicineRequest, EditForm } from "./types";
import { AddMedicineForm } from "./components/AddMedicineForm";
import { EditMedicineDialog } from "./components/EditMedicineDialog";
import { MedicineCatalogGrid } from "./components/MedicineCatalogGrid";

const statusChip = MEDICINE_REQUEST_STATUS_BADGE;

export default function AdminMedicinePage() {
  const { apiFetch } = useApiClient();
  const { user, token, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<"catalog" | "inventory" | "requests">("catalog");

  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());
  const [loadingMeds, setLoadingMeds] = useState(true);
  const [editingMed, setEditingMed] = useState<Medicine | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({
    name: "", caption: "", stockQuantity: "", imageUrl: "", imageFile: null, imagePreview: "", isActive: true,
  });
  const [savingEdit, setSavingEdit] = useState(false);
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
          <AddMedicineForm onAdded={(newMed) => setMedicines((prev) => [...prev, newMed].sort((a, b) => a.name.localeCompare(b.name)))} />

          <MedicineCatalogGrid
            medicines={medicines}
            loading={loadingMeds}
            failedImages={failedImages}
            setFailedImages={setFailedImages}
            deleteConfirmId={deleteConfirmId}
            setDeleteConfirmId={setDeleteConfirmId}
            onConfirmDelete={confirmDelete}
            onEdit={openEdit}
          />
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

      <EditMedicineDialog
        medicine={editingMed}
        form={editForm}
        setForm={setEditForm}
        saving={savingEdit}
        imageInputRef={editImageRef}
        onClose={() => setEditingMed(null)}
        onSave={handleSaveEdit}
      />
    </div>
  );
}
