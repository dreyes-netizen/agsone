"use client";

import { useEffect, useState } from "react";
import { useApiClient } from "@/lib/hooks/useApiClient";
import { useAuth } from "@/lib/auth/AuthProvider";
import { uploadToCloudinary } from "@/lib/cloudinary/upload";
import { toast } from "sonner";
import type { Medicine, MedicineRequest, AddMedicineForm, EditMedicineForm } from "@/lib/types/adminMedicine";

export function useAdminMedicineActions() {
  const { apiFetch } = useApiClient();
  const { user, token, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<"catalog" | "inventory" | "requests">("catalog");

  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());
  const [loadingMeds, setLoadingMeds] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState<AddMedicineForm>({
    name: "", caption: "", stockQuantity: "", imageFile: null, imagePreview: "",
  });
  const [addingMed, setAddingMed] = useState(false);
  const [editingMed, setEditingMed] = useState<Medicine | null>(null);
  const [editForm, setEditForm] = useState<EditMedicineForm>({
    name: "", caption: "", stockQuantity: "", imageUrl: "", imageFile: null, imagePreview: "", isActive: true,
  });
  const [savingEdit, setSavingEdit] = useState(false);

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

  function handleTabChange(tab: "catalog" | "inventory" | "requests") {
    setActiveTab(tab);
    if (tab === "inventory") setInvPage(1);
    if (tab === "requests") setReqPage(1);
  }

  useEffect(() => {
    if (authLoading || !user) return;
    setLoadingMeds(true);
    apiFetch<{ data: Medicine[]; pages: number }>(`/api/admin/medicine?page=${invPage}`)
      .then((r) => { setMedicines(r.data); setInvPages(r.pages); })
      .catch(console.error)
      .finally(() => setLoadingMeds(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user, invPage]);

  useEffect(() => {
    if (authLoading || !user) return;
    setLoadingReqs(true);
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

  useEffect(() => {
    setReqPage(1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFrom, dateTo, statusFilter]);

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

  return {
    // state
    activeTab,
    medicines,
    failedImages, setFailedImages,
    loadingMeds,
    showAddForm, setShowAddForm,
    addForm, setAddForm,
    addingMed,
    editingMed, setEditingMed,
    editForm, setEditForm,
    savingEdit,
    inventoryEdits, setInventoryEdits,
    savingStock,
    requests,
    loadingReqs,
    actioningId,
    reqFilter, setReqFilter,
    dateFrom, setDateFrom,
    dateTo, setDateTo,
    statusFilter, setStatusFilter,
    deleteConfirmId, setDeleteConfirmId,
    invPage, setInvPage,
    invPages,
    reqPage, setReqPage,
    reqPages,
    pending,
    filteredHistory,

    // handlers
    handleTabChange,
    clearFilters,
    handleAdd,
    openEdit,
    handleSaveEdit,
    handleStockSave,
    confirmDelete,
    handleAction,
  };
}
