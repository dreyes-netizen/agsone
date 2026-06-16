"use client";

import { useEffect, useState } from "react";
import { Pill, Search, X, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { useApiClient } from "@/lib/hooks/useApiClient";
import { useAuth } from "@/lib/auth/AuthProvider";

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
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: string;
  medicine: { name: string };
};

const statusChip: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-700",
  APPROVED: "bg-emerald-100 text-emerald-700",
  REJECTED: "bg-red-100 text-red-600",
};

export default function MedicinePage() {
  const { apiFetch } = useApiClient();
  const { user, loading: authLoading } = useAuth();
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [myRequests, setMyRequests] = useState<MyRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"catalog" | "requests">("catalog");
  const [selectedMed, setSelectedMed] = useState<Medicine | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  function showToast(type: "success" | "error", msg: string) {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  }

  useEffect(() => {
    if (authLoading || !user) return;
    apiFetch<{ data: { medicines: Medicine[]; pendingMedicineIds: string[]; myRequests: MyRequest[] } }>(
      "/api/medicine"
    )
      .then((res) => {
        setMedicines(res.data.medicines);
        setPendingIds(new Set(res.data.pendingMedicineIds));
        setMyRequests(res.data.myRequests);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user]);

  async function handleRequest(medicineId: string) {
    setRequesting(medicineId);
    try {
      const res = await apiFetch<{ data: MyRequest }>(
        `/api/medicine/${medicineId}/request`,
        { method: "POST" }
      );
      const medicineName = medicines.find((m) => m.id === medicineId)?.name ?? "";
      setPendingIds((prev) => new Set([...prev, medicineId]));
      setMyRequests((prev) => [
        { ...res.data, medicine: { name: medicineName } },
        ...prev,
      ]);
      showToast("success", `"${medicineName}" request submitted! Pending HR approval.`);
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Failed to submit request");
    } finally {
      setRequesting(null);
    }
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

      {/* Toast */}
      {toast && (
        <div
          role="alert"
          aria-live="assertive"
          className={`fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-auto sm:max-w-sm z-[60] flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium border shadow-lg motion-safe:animate-in motion-safe:slide-in-from-bottom-3 motion-safe:fade-in-0 motion-safe:duration-300 ${
            toast.type === "success"
              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
              : "bg-red-50 text-red-800 border-red-200"
          }`}
        >
          {toast.type === "success"
            ? <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" aria-hidden="true" />
            : <AlertCircle className="w-4 h-4 shrink-0 text-red-500" aria-hidden="true" />}
          {toast.msg}
        </div>
      )}

      {/* Tabs */}
      <div role="tablist" aria-label="Medicine views" className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {(["catalog", "requests"] as const).map((tab) => (
          <button
            key={tab}
            role="tab"
            aria-selected={activeTab === tab}
            onClick={() => { setActiveTab(tab); if (tab !== "catalog") setSearchQuery(""); }}
            className={`px-4 py-1.5 text-sm font-semibold rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-gray-900 ${
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
        loading ? (
          <div role="status" aria-live="polite" className="flex flex-col items-center justify-center py-16 gap-3 text-gray-500">
            <Loader2 className="w-6 h-6 animate-spin text-gray-500" aria-hidden="true" />
            <span className="text-sm">Loading medicines…</span>
          </div>
        ) : medicines.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center bg-white rounded-2xl border border-gray-100">
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
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-200 bg-white"
              />
            </div>
            {visibleMedicines.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center bg-white rounded-2xl border border-gray-100">
                <Search className="w-8 h-8 text-gray-300 mb-3" aria-hidden="true" />
                <p className="text-gray-700 font-medium">No results for &ldquo;{searchQuery}&rdquo;</p>
                <p className="text-gray-500 text-sm mt-1">Try a different name.</p>
              </div>
            ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {visibleMedicines.map((med) => {
              const isPending = pendingIds.has(med.id);
              const outOfStock = med.stockQuantity <= 0;
              const isRequesting = requesting === med.id;
              const disabled = isPending || outOfStock || isRequesting;
              return (
                <div
                  key={med.id}
                  role="group"
                  aria-label={med.name}
                  className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col cursor-pointer hover:shadow-md transition-shadow motion-safe:hover:-translate-y-0.5 motion-safe:transition-transform motion-safe:[transition-timing-function:cubic-bezier(0.25,1,0.5,1)]"
                >
                  <button
                    type="button"
                    aria-label={`View details for ${med.name}`}
                    onClick={() => setSelectedMed(med)}
                    className="aspect-square bg-gray-50 overflow-hidden w-full block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-gray-900"
                  >
                    {med.imageUrl ? (
                      <img
                        src={med.imageUrl}
                        alt={med.name}
                        className="w-full h-full object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; (e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden"); }}
                      />
                    ) : null}
                    <div className={`w-full h-full flex items-center justify-center bg-gray-100 ${med.imageUrl ? "hidden" : ""}`}>
                      <Pill className="w-10 h-10 text-gray-300" aria-hidden="true" />
                    </div>
                  </button>
                  <div className="p-3 flex flex-col gap-2 flex-1">
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">{med.name}</p>
                      <p className="text-gray-500 text-xs mt-0.5 line-clamp-2">{med.caption}</p>
                    </div>
                    <p className={`text-xs font-medium ${outOfStock ? "text-gray-500" : "text-emerald-600"}`}>
                      {outOfStock ? "Out of stock" : `${med.stockQuantity} in stock`}
                    </p>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleRequest(med.id); }}
                      disabled={disabled}
                      aria-label={isPending ? `${med.name} — request pending` : outOfStock ? `${med.name} — out of stock` : `Request ${med.name}`}
                      className={`w-full py-2 rounded-lg text-xs font-semibold transition-colors mt-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-900 flex items-center justify-center gap-1.5 ${
                        isPending
                          ? "bg-amber-50 text-amber-600 cursor-not-allowed"
                          : outOfStock
                          ? "bg-gray-100 text-gray-500 cursor-not-allowed"
                          : "bg-[#111827] text-white hover:bg-gray-800"
                      }`}
                    >
                      {isRequesting && <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />}
                      {isRequesting ? "Submitting…" : isPending ? "Request pending" : "Request"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
            )}
          </div>
        )
      )}

      {/* My Requests tab */}
      {activeTab === "requests" && (
        myRequests.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center bg-white rounded-2xl border border-gray-100">
            <Pill className="w-10 h-10 text-gray-300 mb-3" aria-hidden="true" />
            <p className="text-gray-700 font-medium">No requests yet</p>
            <p className="text-gray-500 text-sm mt-1">Go to the Catalog tab to request a medicine.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[360px]">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Medicine</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Requested</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                </tr>
              </thead>
              <tbody>
                {myRequests.map((r) => (
                  <tr key={r.id} className="border-t border-gray-50 hover:bg-gray-50/60 transition-colors">
                    <td className="px-5 py-3 font-medium text-gray-900">{r.medicine.name}</td>
                    <td className="px-5 py-3 text-gray-500 text-sm">
                      {new Date(r.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusChip[r.status]}`}>
                        {r.status.charAt(0) + r.status.slice(1).toLowerCase()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        )
      )}

      {/* Detail modal */}
      {selectedMed && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4 pb-4 sm:pb-0"
          onClick={() => setSelectedMed(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="medicine-modal-title"
            className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[85vh] overflow-y-auto scrollbar-hide animate-in fade-in-0 slide-in-from-bottom-4 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative">
              {selectedMed.imageUrl ? (
                <img
                  src={selectedMed.imageUrl}
                  alt={selectedMed.name}
                  className="w-full aspect-square object-cover rounded-t-2xl"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; (e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden"); }}
                />
              ) : null}
              <div className={`w-full aspect-square flex items-center justify-center bg-gray-100 rounded-t-2xl ${selectedMed.imageUrl ? "hidden" : ""}`}>
                <Pill className="w-16 h-16 text-gray-300" aria-hidden="true" />
              </div>
              <button
                autoFocus
                aria-label="Close"
                onClick={() => setSelectedMed(null)}
                className="absolute top-3 right-3 w-8 h-8 bg-black/50 text-white rounded-full flex items-center justify-center hover:bg-black/70 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <h2 id="medicine-modal-title" className="text-xl font-bold text-gray-900">{selectedMed.name}</h2>
                <p className={`text-xs font-medium mt-1 ${selectedMed.stockQuantity <= 0 ? "text-gray-500" : "text-emerald-600"}`}>
                  {selectedMed.stockQuantity <= 0 ? "Out of stock" : `${selectedMed.stockQuantity} in stock`}
                </p>
              </div>
              <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">{selectedMed.caption}</p>
              <button
                onClick={() => { handleRequest(selectedMed.id); setSelectedMed(null); }}
                disabled={pendingIds.has(selectedMed.id) || selectedMed.stockQuantity <= 0 || requesting === selectedMed.id}
                className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-900 flex items-center justify-center gap-2 ${
                  pendingIds.has(selectedMed.id)
                    ? "bg-amber-50 text-amber-600 cursor-not-allowed"
                    : selectedMed.stockQuantity <= 0
                    ? "bg-gray-100 text-gray-500 cursor-not-allowed"
                    : "bg-[#111827] text-white hover:bg-gray-800"
                }`}
              >
                {requesting === selectedMed.id && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
                {pendingIds.has(selectedMed.id) ? "Request pending" : selectedMed.stockQuantity <= 0 ? "Out of stock" : requesting === selectedMed.id ? "Submitting…" : "Request"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
