"use client";

import { useRef, useState } from "react";
import { useApiClient } from "@/lib/hooks/useApiClient";
import { useAuth } from "@/lib/auth/AuthProvider";
import { uploadToCloudinary } from "@/lib/cloudinary/upload";
import { Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";
import type { Medicine, AddForm } from "../types";

const inputClass =
  "w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500/30 bg-white";

interface AddMedicineFormProps {
  onAdded: (medicine: Medicine) => void;
}

export function AddMedicineForm({ onAdded }: AddMedicineFormProps) {
  const { apiFetch } = useApiClient();
  const { token } = useAuth();
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState<AddForm>({
    name: "", caption: "", stockQuantity: "", imageFile: null, imagePreview: "",
  });
  const [addingMed, setAddingMed] = useState(false);
  const addImageRef = useRef<HTMLInputElement>(null);

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
      onAdded(res.data);
      setAddForm({ name: "", caption: "", stockQuantity: "", imageFile: null, imagePreview: "" });
      setShowAddForm(false);
      toast.success("Medicine added successfully.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add medicine");
    } finally {
      setAddingMed(false);
    }
  }

  return (
    <>
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
    </>
  );
}
