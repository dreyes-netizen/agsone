"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { MEDICINE_REQUEST_STATUS_BADGE } from "@/lib/constants/medicineRequestStatus";
import {
  Pill,
  Search,
  Loader2,
  Minus,
  Plus,
} from "lucide-react";
import { useApiClient } from "@/lib/hooks/useApiClient";
import { useAuth } from "@/lib/auth/AuthProvider";
import { Pagination } from "@/components/ui/pagination";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useRealtimeChannels } from "@/lib/hooks/useRealtimeChannel";
import { realtimeTopics } from "@/lib/realtime/topics";

// Closed by default — split into its own chunk instead of shipping with the
// page bundle.
const ImageLightbox = dynamic(
  () => import("@/components/ImageLightbox").then((m) => m.ImageLightbox),
  { ssr: false },
);

type Medicine = {
  id: string;
  name: string;
  imageUrl: string;
  caption: string;
  stockQuantity: number;
};

type MyRequest = {
  id: string;
  medicineId: string;
  quantity: number;
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: string;
  medicine: { name: string };
};

const statusChip = MEDICINE_REQUEST_STATUS_BADGE;

export default function MedicinePage() {
  const { apiFetch } = useApiClient();
  const { user, dbUser, loading: authLoading } = useAuth();
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [myRequests, setMyRequests] = useState<MyRequest[]>([]);
  const [pendingMedicineIds, setPendingMedicineIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"catalog" | "requests">("catalog");
  const [selectedMed, setSelectedMed] = useState<Medicine | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmMed, setConfirmMed] = useState<Medicine | null>(null);
  const [lightbox, setLightbox] = useState<{ images: string[]; index: number } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());
  const [reqPage, setReqPage] = useState(1);
  const [reqPages, setReqPages] = useState(1);

  async function load() {
    try {
      const res = await apiFetch<{
      data: { medicines: Medicine[]; pendingMedicineIds: string[]; myRequests: MyRequest[] };
      total: number;
      page: number;
      pages: number;
      }>(`/api/medicine?page=${reqPage}`);
      setMedicines(res.data.medicines);
      setMyRequests(res.data.myRequests);
      setPendingMedicineIds(new Set(res.data.pendingMedicineIds));
      setReqPages(res.pages);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (authLoading || !user) return;
    queueMicrotask(load);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user, reqPage]);

  useRealtimeChannels(
    [realtimeTopics.medicine, dbUser ? realtimeTopics.medicineUser(dbUser.id) : null],
    load,
    { debounceMs: 200 },
  );

  async function handleRequest(medicineId: string, qty: number) {
    setRequesting(medicineId);
    try {
      const res = await apiFetch<{ data: MyRequest }>(
        `/api/medicine/${medicineId}/request`,
        { method: "POST", body: JSON.stringify({ quantity: qty }) }
      );
      const medicineName = medicines.find((m) => m.id === medicineId)?.name ?? "";
      setMyRequests((prev) => [
        { ...res.data, medicine: { name: medicineName } },
        ...prev,
      ]);
      setPendingMedicineIds((prev) => new Set(prev).add(medicineId));
      toast.success(`${qty}× "${medicineName}" requested. Pending HR approval.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to submit request");
    } finally {
      setRequesting(null);
    }
  }

  function openConfirm(med: Medicine) {
    setConfirmMed(med);
    setQuantity(1);
    setConfirmOpen(true);
  }

  const visibleMedicines = searchQuery.trim()
    ? medicines.filter((m) => m.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : medicines;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Medicine</h1>
          <p className="text-gray-500 text-sm mt-1">Request a medicine from the company cabinet.</p>
        </div>
      </div>

      {/* Tabs */}
      <div role="tablist" aria-label="Medicine views" className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {(["catalog", "requests"] as const).map((tab) => (
          <button
            key={tab}
            role="tab"
            aria-selected={activeTab === tab}
            aria-controls={`panel-${tab}`}
            tabIndex={activeTab === tab ? 0 : -1}
            onClick={() => { setActiveTab(tab); if (tab !== "catalog") setSearchQuery(""); }}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-gray-900 ${
              activeTab === tab ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-800"
            }`}
          >
            {tab === "catalog" ? "Catalog" : "My Requests"}
            {tab === "requests" && myRequests.length > 0 && (
              <span className="ml-1.5 bg-gray-800 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full" aria-label={`${myRequests.length} requests`}>
                {myRequests.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Catalog tab */}
      {activeTab === "catalog" && (
        <div id="panel-catalog" role="tabpanel">
        {loading ? (
          <div role="status" aria-live="polite" className="flex flex-col items-center justify-center py-16 gap-3 text-gray-500">
            <Loader2 className="w-6 h-6 animate-spin text-gray-500" aria-hidden="true" />
            <span className="text-sm">Loading medicines…</span>
          </div>
        ) : medicines.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center bg-white rounded-card border border-table-border">
            <Pill className="w-10 h-10 text-gray-300 mb-3" aria-hidden="true" />
            <p className="text-gray-700 font-medium">No medicines available</p>
            <p className="text-gray-500 text-sm mt-1">Check back later or contact HR.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
              <input
                type="text"
                aria-label="Search medicines"
                placeholder="Search medicines…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                enterKeyHint="search"
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-200 bg-white"
              />
            </div>
            {visibleMedicines.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center bg-white rounded-card border border-table-border">
                <Search className="w-8 h-8 text-gray-300 mb-3" aria-hidden="true" />
                <p className="text-gray-700 font-medium">No results for &ldquo;{searchQuery}&rdquo;</p>
                <p className="text-gray-500 text-sm mt-1">Try a different name.</p>
              </div>
            ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {visibleMedicines.map((med) => {
              const outOfStock = med.stockQuantity <= 0;
              const isRequesting = requesting === med.id;
              const isPending = pendingMedicineIds.has(med.id);
              const disabled = outOfStock || isRequesting || isPending;
              return (
                <div
                  key={med.id}
                  role="button"
                  tabIndex={0}
                  aria-label={med.name}
                  onClick={() => setSelectedMed(med)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelectedMed(med);
                    }
                  }}
                  className="bg-white rounded-card border border-table-border overflow-hidden flex flex-col cursor-pointer hover:shadow-md transition-shadow sm:hover:-translate-y-0.5 sm:transition-transform sm:[transition-timing-function:cubic-bezier(0.25,1,0.5,1)]"
                >
                  <div
                    className="aspect-square bg-gray-50 overflow-hidden w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-gray-900"
                  >
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
                  </div>
                  <div className="p-3 flex flex-col gap-2 flex-1">
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">{med.name}</p>
                      <p className="text-gray-500 text-xs mt-0.5 line-clamp-2">{med.caption}</p>
                    </div>
                    <p className={`text-xs font-medium ${outOfStock ? "text-gray-500" : "text-emerald-600"}`}>
                      {outOfStock ? "Out of stock" : `${med.stockQuantity} in stock`}
                    </p>
                    <button
                      onClick={(e) => { e.stopPropagation(); openConfirm(med); }}
                      disabled={disabled}
                      aria-label={
                        outOfStock
                          ? `${med.name} — out of stock`
                          : isPending
                          ? `${med.name} — request pending`
                          : `Request ${med.name}`
                      }
                      className={`w-full py-2 rounded-lg text-xs font-semibold transition-colors mt-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-900 flex items-center justify-center gap-1.5 ${
                        outOfStock || isPending
                          ? "bg-gray-100 text-gray-500 cursor-not-allowed"
                          : "bg-command-black text-white hover:bg-gray-800"
                      }`}
                    >
                      {isRequesting && <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />}
                      {isRequesting ? "Submitting…" : isPending ? "Request Pending" : "Request"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
            )}
          </div>
        )}
        </div>
      )}

      {/* My Requests tab */}
      {activeTab === "requests" && (
        <div id="panel-requests" role="tabpanel">
        {myRequests.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center bg-white rounded-card border border-table-border">
            <Pill className="w-10 h-10 text-gray-300 mb-3" aria-hidden="true" />
            <p className="text-gray-700 font-medium">No requests yet</p>
            <p className="text-gray-500 text-sm mt-1">Go to the Catalog tab to request a medicine.</p>
          </div>
        ) : (
          <div className="bg-white rounded-card border border-table-border overflow-clip">
            <div className="overflow-auto max-h-[70vh] scroll-hint">
            <table className="w-full border-collapse min-w-[360px]">
              <thead className="sticky top-0 z-10 bg-table-head">
                <tr className="border-b border-table-border">
                  <th className="text-left px-3.5 py-2.5 font-mono text-[10px] tracking-[0.09em] uppercase text-table-muted first:pl-5 last:pr-5">Medicine</th>
                  <th className="text-left px-3.5 py-2.5 font-mono text-[10px] tracking-[0.09em] uppercase text-table-muted first:pl-5 last:pr-5">Qty</th>
                  <th className="text-left px-3.5 py-2.5 font-mono text-[10px] tracking-[0.09em] uppercase text-table-muted first:pl-5 last:pr-5">Requested</th>
                  <th className="text-left px-3.5 py-2.5 font-mono text-[10px] tracking-[0.09em] uppercase text-table-muted first:pl-5 last:pr-5">Status</th>
                </tr>
              </thead>
              <tbody>
                {myRequests.map((r, i) => (
                  <tr key={r.id} className={`border-b border-row-border transition-colors hover:bg-row-hover ${i % 2 === 1 ? "bg-row-alt" : ""}`}>
                    <td className="px-3.5 py-[11px] text-[13px] first:pl-5 last:pr-5 font-medium text-gray-900">{r.medicine.name}</td>
                    <td className="px-3.5 py-[11px] text-[13px] first:pl-5 last:pr-5 text-gray-700">{r.quantity}</td>
                    <td className="px-3.5 py-[11px] text-[13px] first:pl-5 last:pr-5 text-gray-500">
                      {new Date(r.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </td>
                    <td className="px-3.5 py-[11px] text-[13px] first:pl-5 last:pr-5">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusChip[r.status]}`}>
                        {r.status.charAt(0) + r.status.slice(1).toLowerCase()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
            <Pagination page={reqPage} pages={reqPages} onPageChange={setReqPage} />
          </div>
        )}
        </div>
      )}

      {/* Detail modal */}
      <Dialog open={!!selectedMed} onOpenChange={(open) => { if (!open) setSelectedMed(null); }}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto scrollbar-hide p-0 gap-0 rounded-2xl">
          {selectedMed && (
            <>
              <div className="relative">
                {selectedMed.imageUrl && !failedImages.has(selectedMed.id) ? (
                  <img
                    src={selectedMed.imageUrl}
                    alt={selectedMed.name}
                    className="w-full aspect-square object-cover rounded-t-2xl cursor-zoom-in"
                    onClick={() => setLightbox({ images: [selectedMed.imageUrl], index: 0 })}
                    onError={() => setFailedImages((prev) => new Set(prev).add(selectedMed.id))}
                  />
                ) : (
                  <div className="w-full aspect-square flex items-center justify-center bg-gray-100 rounded-t-2xl">
                    <Pill className="w-16 h-16 text-gray-300" aria-hidden="true" />
                  </div>
                )}
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <DialogTitle className="text-xl font-bold text-gray-900">{selectedMed.name}</DialogTitle>
                  <p className={`text-xs font-medium mt-1 ${selectedMed.stockQuantity <= 0 ? "text-gray-500" : "text-emerald-600"}`}>
                    {selectedMed.stockQuantity <= 0 ? "Out of stock" : `${selectedMed.stockQuantity} in stock`}
                  </p>
                </div>
                <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">{selectedMed.caption}</p>
                <button
                  onClick={() => { setSelectedMed(null); openConfirm(selectedMed); }}
                  disabled={
                    selectedMed.stockQuantity <= 0 ||
                    requesting === selectedMed.id ||
                    pendingMedicineIds.has(selectedMed.id)
                  }
                  className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-900 flex items-center justify-center gap-2 ${
                    selectedMed.stockQuantity <= 0 || pendingMedicineIds.has(selectedMed.id)
                      ? "bg-gray-100 text-gray-500 cursor-not-allowed"
                      : "bg-command-black text-white hover:bg-gray-800"
                  }`}
                >
                  {requesting === selectedMed.id && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
                  {selectedMed.stockQuantity <= 0
                    ? "Out of stock"
                    : pendingMedicineIds.has(selectedMed.id)
                    ? "Request Pending"
                    : requesting === selectedMed.id
                    ? "Submitting…"
                    : "Request"}
                </button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirmation modal with quantity stepper */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-sm p-6">
          {confirmMed && (
            <>
              <DialogTitle className="text-lg font-bold text-gray-900 mb-1">Confirm Request</DialogTitle>
              <p className="text-sm text-gray-600 mb-5">
                How many <span className="font-semibold text-gray-900">{confirmMed.name}</span> do you need?
              </p>

              {/* Quantity stepper */}
              <div className="flex items-center justify-center gap-4 mb-6">
                <button
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  disabled={quantity <= 1}
                  aria-label="Decrease quantity"
                  className="w-12 h-12 rounded-full border-2 border-gray-200 flex items-center justify-center text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-2"
                >
                  <Minus className="w-5 h-5" />
                </button>
                <span className="w-12 text-center text-2xl font-bold text-gray-900 tabular-nums" aria-live="polite" aria-label={`Quantity ${quantity}`}>
                  {quantity}
                </span>
                <button
                  onClick={() => setQuantity((q) => Math.min(confirmMed.stockQuantity, q + 1))}
                  disabled={quantity >= confirmMed.stockQuantity}
                  aria-label="Increase quantity"
                  className="w-12 h-12 rounded-full border-2 border-gray-200 flex items-center justify-center text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-2"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>

              <p className="text-center text-xs text-gray-500 mb-5">{confirmMed.stockQuantity} available</p>

              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmOpen(false)}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-2"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setConfirmOpen(false);
                    handleRequest(confirmMed.id, quantity);
                    setConfirmMed(null);
                  }}
                  disabled={requesting === confirmMed.id}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold bg-command-black text-white hover:bg-gray-800 transition-colors flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-900"
                >
                  {requesting === confirmMed.id && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
                  {requesting === confirmMed.id ? "Submitting…" : `Request ${quantity}`}
                </button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {lightbox && (
        <ImageLightbox
          images={lightbox.images}
          initialIndex={lightbox.index}
          open={!!lightbox}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  );
}
