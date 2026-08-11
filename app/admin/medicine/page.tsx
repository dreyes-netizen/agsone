"use client";

import { Loader2 } from "lucide-react";
import { useAdminMedicineActions } from "@/lib/hooks/useAdminMedicineActions";
import { MedicineTabs } from "@/components/admin/medicine/MedicineTabs";
import { AddMedicineForm } from "@/components/admin/medicine/AddMedicineForm";
import { MedicineCatalogGrid } from "@/components/admin/medicine/MedicineCatalogGrid";
import { EditMedicineDialog } from "@/components/admin/medicine/EditMedicineDialog";
import { InventoryTable } from "@/components/admin/medicine/InventoryTable";
import { PendingRequestsTable } from "@/components/admin/medicine/PendingRequestsTable";
import { RequestHistoryTable } from "@/components/admin/medicine/RequestHistoryTable";

export default function AdminMedicinePage() {
  const {
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
    handleTabChange,
    clearFilters,
    handleAdd,
    openEdit,
    handleSaveEdit,
    handleStockSave,
    confirmDelete,
    handleAction,
  } = useAdminMedicineActions();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Medicine</h1>
        <p className="text-gray-500 text-sm mt-1">Manage the medicine cabinet and dispense requests.</p>
      </div>

      <MedicineTabs activeTab={activeTab} onTabChange={handleTabChange} pendingCount={pending.length} />

      {activeTab === "catalog" && (
        <div className="space-y-4">
          <AddMedicineForm
            showAddForm={showAddForm}
            setShowAddForm={setShowAddForm}
            addForm={addForm}
            setAddForm={setAddForm}
            addingMed={addingMed}
            onAdd={handleAdd}
          />
          <MedicineCatalogGrid
            medicines={medicines}
            loadingMeds={loadingMeds}
            failedImages={failedImages}
            setFailedImages={setFailedImages}
            deleteConfirmId={deleteConfirmId}
            setDeleteConfirmId={setDeleteConfirmId}
            onEdit={openEdit}
            onConfirmDelete={confirmDelete}
          />
        </div>
      )}

      {activeTab === "inventory" && (
        <InventoryTable
          medicines={medicines}
          loadingMeds={loadingMeds}
          failedImages={failedImages}
          setFailedImages={setFailedImages}
          inventoryEdits={inventoryEdits}
          setInventoryEdits={setInventoryEdits}
          savingStock={savingStock}
          onSave={handleStockSave}
          invPage={invPage}
          invPages={invPages}
          setInvPage={setInvPage}
        />
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
              <PendingRequestsTable pending={pending} actioningId={actioningId} onAction={handleAction} />
              <RequestHistoryTable
                filteredHistory={filteredHistory}
                reqFilter={reqFilter}
                setReqFilter={setReqFilter}
                dateFrom={dateFrom}
                setDateFrom={setDateFrom}
                dateTo={dateTo}
                setDateTo={setDateTo}
                statusFilter={statusFilter}
                setStatusFilter={setStatusFilter}
                onClearFilters={clearFilters}
                reqPage={reqPage}
                reqPages={reqPages}
                setReqPage={setReqPage}
              />
            </>
          )}
        </div>
      )}

      <EditMedicineDialog
        editingMed={editingMed}
        setEditingMed={setEditingMed}
        editForm={editForm}
        setEditForm={setEditForm}
        savingEdit={savingEdit}
        onSave={handleSaveEdit}
      />
    </div>
  );
}
