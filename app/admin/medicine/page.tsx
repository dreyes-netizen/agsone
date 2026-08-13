"use client";

import { useEffect, useRef, useState } from "react";
import { useApiClient } from "@/lib/hooks/useApiClient";
import { useAuth } from "@/lib/auth/AuthProvider";
import { uploadToCloudinary } from "@/lib/cloudinary/upload";
import { toast } from "sonner";
import type { Medicine, MedicineRequest, EditForm } from "./types";
import { AddMedicineForm } from "./components/AddMedicineForm";
import { EditMedicineDialog } from "./components/EditMedicineDialog";
import { MedicineCatalogGrid } from "./components/MedicineCatalogGrid";
import { MedicineInventoryTable } from "./components/MedicineInventoryTable";
import { MedicineRequestsPanel } from "./components/MedicineRequestsPanel";
import { useRealtimeChannels } from "@/lib/hooks/useRealtimeChannel";
import { realtimeTopics } from "@/lib/realtime/topics";

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

  async function loadMedicines() {
    setLoadingMeds(true);
    try {
      const r = await apiFetch<{ data: Medicine[]; pages: number }>(`/api/admin/medicine?page=${invPage}`);
      setMedicines(r.data);
      setInvPages(r.pages);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingMeds(false);
    }
  }

  async function loadRequests() {
    setLoadingReqs(true);
    const params = new URLSearchParams({ page: String(reqPage) });
    if (dateFrom) params.set("from", dateFrom);
    if (dateTo) params.set("to", dateTo);
    if (statusFilter) params.set("status", statusFilter);
    try {
      const r = await apiFetch<{ data: MedicineRequest[]; pages: number }>(`/api/admin/medicine/requests?${params}`);
      setRequests(r.data);
      setReqPages(r.pages);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingReqs(false);
    }
  }

  useEffect(() => {
    if (authLoading || !user) return;
    queueMicrotask(loadMedicines);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user, invPage]);

  useEffect(() => {
    if (authLoading || !user) return;
    queueMicrotask(loadRequests);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user, reqPage, dateFrom, dateTo, statusFilter]);

  useRealtimeChannels(
    [realtimeTopics.medicine, realtimeTopics.medicineRequests],
    () => {
      loadMedicines();
      loadRequests();
    },
    { debounceMs: 200 },
  );

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
        <MedicineInventoryTable
          medicines={medicines}
          loading={loadingMeds}
          failedImages={failedImages}
          setFailedImages={setFailedImages}
          inventoryEdits={inventoryEdits}
          setInventoryEdits={setInventoryEdits}
          savingStock={savingStock}
          onSaveStock={handleStockSave}
          page={invPage}
          pages={invPages}
          onPageChange={setInvPage}
        />
      )}

      {activeTab === "requests" && (
        <MedicineRequestsPanel
          loading={loadingReqs}
          pending={pending}
          filteredHistory={filteredHistory}
          actioningId={actioningId}
          onAction={handleAction}
          reqFilter={reqFilter}
          setReqFilter={setReqFilter}
          dateFrom={dateFrom}
          setDateFrom={setDateFrom}
          dateTo={dateTo}
          setDateTo={setDateTo}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          onClearFilters={clearFilters}
          page={reqPage}
          pages={reqPages}
          onPageChange={setReqPage}
        />
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
