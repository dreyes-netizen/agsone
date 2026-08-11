"use client";

import type { Dispatch, SetStateAction } from "react";
import { Loader2, Pencil, Pill, Trash2 } from "lucide-react";
import type { Medicine } from "@/lib/types/adminMedicine";

function MedicineCard({
  med,
  imageFailed,
  onImageError,
  isConfirmingDelete,
  onEdit,
  onDeleteClick,
  onCancelDelete,
  onConfirmDelete,
}: {
  med: Medicine;
  imageFailed: boolean;
  onImageError: () => void;
  isConfirmingDelete: boolean;
  onEdit: () => void;
  onDeleteClick: () => void;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
}) {
  return (
    <div
      className={`bg-white rounded-card border border-table-border overflow-hidden flex flex-col ${!med.isActive ? "opacity-50" : ""}`}
    >
      <div className="aspect-square bg-gray-50 overflow-hidden relative">
        {med.imageUrl && !imageFailed ? (
          <img
            src={med.imageUrl}
            alt={med.name}
            className="w-full h-full object-cover"
            onError={onImageError}
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
        {isConfirmingDelete ? (
          <div className="mt-2 flex items-center gap-1.5 text-xs">
            <span className="text-gray-700 font-medium flex-1">Delete?</span>
            <button
              onClick={onConfirmDelete}
              className="px-2.5 py-1.5 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
            >
              Yes
            </button>
            <button
              onClick={onCancelDelete}
              className="px-2.5 py-1.5 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900"
            >
              No
            </button>
          </div>
        ) : (
          <div className="flex gap-1 mt-2">
            <button
              onClick={onEdit}
              className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs font-medium border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-gray-900"
            >
               <Pencil className="w-3 h-3" aria-hidden="true" /> Edit
            </button>
            <button
              onClick={onDeleteClick}
              className="p-1.5 border border-gray-200 rounded-lg text-red-400 hover:bg-red-50 hover:border-red-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-red-500"
            >
               <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function MedicineCatalogGrid({
  medicines,
  loadingMeds,
  failedImages,
  setFailedImages,
  deleteConfirmId,
  setDeleteConfirmId,
  onEdit,
  onConfirmDelete,
}: {
  medicines: Medicine[];
  loadingMeds: boolean;
  failedImages: Set<string>;
  setFailedImages: Dispatch<SetStateAction<Set<string>>>;
  deleteConfirmId: string | null;
  setDeleteConfirmId: Dispatch<SetStateAction<string | null>>;
  onEdit: (med: Medicine) => void;
  onConfirmDelete: (med: Medicine) => void;
}) {
  if (loadingMeds) {
    return (
      <div className="flex items-center justify-center gap-2 text-gray-500 py-12">
        <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
        <span>Loading…</span>
      </div>
    );
  }

  if (medicines.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-12">
        <Pill className="w-8 h-8 text-gray-300" aria-hidden="true" />
        <p className="text-sm text-gray-500">No medicines yet. Add one above.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
      {medicines.map((med) => (
        <MedicineCard
          key={med.id}
          med={med}
          imageFailed={failedImages.has(med.id)}
          onImageError={() => setFailedImages((prev) => new Set(prev).add(med.id))}
          isConfirmingDelete={deleteConfirmId === med.id}
          onEdit={() => onEdit(med)}
          onDeleteClick={() => setDeleteConfirmId(med.id)}
          onCancelDelete={() => setDeleteConfirmId(null)}
          onConfirmDelete={() => onConfirmDelete(med)}
        />
      ))}
    </div>
  );
}
