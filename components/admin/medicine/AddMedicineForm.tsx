"use client";

import { useRef, type Dispatch, type SetStateAction } from "react";
import { Loader2, Plus, X } from "lucide-react";
import { inputClass } from "./shared";
import type { AddMedicineForm as AddMedicineFormState } from "@/lib/types/adminMedicine";

export function AddMedicineForm({
  showAddForm,
  setShowAddForm,
  addForm,
  setAddForm,
  addingMed,
  onAdd,
}: {
  showAddForm: boolean;
  setShowAddForm: Dispatch<SetStateAction<boolean>>;
  addForm: AddMedicineFormState;
  setAddForm: Dispatch<SetStateAction<AddMedicineFormState>>;
  addingMed: boolean;
  onAdd: () => void;
}) {
  const addImageRef = useRef<HTMLInputElement>(null);

  return (
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
                  aria-label="Remove image"
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
              onClick={onAdd}
              disabled={addingMed}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-command-black rounded-xl hover:bg-gray-800 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-gray-900"
            >
               {addingMed ? <><Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Uploading…</> : "Add Medicine"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
