import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Pill } from "lucide-react";
import type { Medicine, EditForm } from "../types";

const inputClass =
  "w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500/30 bg-white";

interface EditMedicineDialogProps {
  medicine: Medicine | null;
  form: EditForm;
  setForm: React.Dispatch<React.SetStateAction<EditForm>>;
  saving: boolean;
  imageInputRef: React.RefObject<HTMLInputElement | null>;
  onClose: () => void;
  onSave: () => void;
}

export function EditMedicineDialog(props: EditMedicineDialogProps) {
  const { medicine, form, setForm, saving, imageInputRef, onClose, onSave } = props;

  return (
    <Dialog open={!!medicine} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-md p-6">
        <DialogHeader>
          <DialogTitle>Edit Medicine</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Generic Name</label>
            <input
              autoFocus
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Caption</label>
            <textarea
              value={form.caption}
              onChange={(e) => setForm((f) => ({ ...f, caption: e.target.value }))}
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
              value={form.stockQuantity}
              onChange={(e) => setForm((f) => ({ ...f, stockQuantity: e.target.value }))}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Photo <span className="normal-case font-normal text-gray-500">(optional)</span></label>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) setForm((f) => ({ ...f, imageFile: file, imagePreview: URL.createObjectURL(file) }));
              }}
            />
            <div className="flex items-center gap-3">
              {(form.imagePreview || form.imageUrl) ? (
                <img
                  src={form.imagePreview || form.imageUrl}
                  alt=""
                  className="w-16 h-16 rounded-lg object-cover border border-gray-200"
                />
              ) : (
                <div className="w-16 h-16 rounded-lg border border-gray-200 bg-gray-100 flex items-center justify-center">
                   <Pill className="w-6 h-6 text-gray-300" aria-hidden="true" />
                </div>
              )}
              <button
                onClick={() => imageInputRef.current?.click()}
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
              aria-checked={form.isActive}
              aria-label="Active status"
              onClick={() => setForm((f) => ({ ...f, isActive: !f.isActive }))}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-gray-900 ${form.isActive ? "bg-emerald-500" : "bg-gray-200"}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${form.isActive ? "translate-x-6" : "translate-x-1"}`} />
            </button>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-gray-900"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-command-black rounded-xl hover:bg-gray-800 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-gray-900"
          >
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Saving…</> : "Save Changes"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
