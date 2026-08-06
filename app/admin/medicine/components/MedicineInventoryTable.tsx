import { Loader2, Pill } from "lucide-react";
import { Pagination } from "@/components/ui/pagination";
import { LOW_STOCK_THRESHOLD } from "@/lib/constants/stock";
import type { Medicine } from "../types";

interface MedicineInventoryTableProps {
  medicines: Medicine[];
  loading: boolean;
  failedImages: Set<string>;
  setFailedImages: React.Dispatch<React.SetStateAction<Set<string>>>;
  inventoryEdits: Record<string, string>;
  setInventoryEdits: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  savingStock: string | null;
  onSaveStock: (medicine: Medicine) => void;
  page: number;
  pages: number;
  onPageChange: (page: number) => void;
}

export function MedicineInventoryTable(props: MedicineInventoryTableProps) {
  const {
    medicines, loading, failedImages, setFailedImages, inventoryEdits, setInventoryEdits,
    savingStock, onSaveStock, page, pages, onPageChange,
  } = props;

  return loading ? (
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
                        onClick={() => onSaveStock(med)}
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
                  onClick={() => onSaveStock(med)}
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
        <Pagination page={page} pages={pages} onPageChange={onPageChange} />
      </div>
    </>
  );
}
