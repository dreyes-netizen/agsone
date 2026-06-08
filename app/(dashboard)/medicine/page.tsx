"use client";

import { useEffect, useState } from "react";
import { Pill, Search, X } from "lucide-react";
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
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to submit request");
    } finally {
      setRequesting(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Medicine</h1>
          <p className="text-gray-500 text-sm mt-1">Request a medicine from the company cabinet.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {(["catalog", "requests"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-1.5 text-sm font-semibold rounded-lg transition-colors capitalize ${
              activeTab === tab ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab === "catalog" ? "Catalog" : "My Requests"}
            {tab === "requests" && myRequests.length > 0 && (
              <span className="ml-1.5 bg-gray-800 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {myRequests.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Catalog tab */}
      {activeTab === "catalog" && (
        loading ? (
          <div className="text-center text-gray-400 py-16">Loading…</div>
        ) : medicines.length === 0 ? (
          <div className="text-center text-gray-400 py-16">No medicines available.</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {medicines.map((med) => {
              const isPending = pendingIds.has(med.id);
              const outOfStock = med.stockQuantity <= 0;
              const isRequesting = requesting === med.id;
              const disabled = isPending || outOfStock || isRequesting;
              return (
                <div
                  key={med.id}
                  onClick={() => setSelectedMed(med)}
                  className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col cursor-pointer hover:shadow-md transition-shadow"
                >
                  <div className="aspect-square bg-gray-50 overflow-hidden">
                    <img
                      src={med.imageUrl}
                      alt={med.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="p-3 flex flex-col gap-2 flex-1">
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">{med.name}</p>
                      <p className="text-gray-500 text-xs mt-0.5 line-clamp-2">{med.caption}</p>
                    </div>
                    <p className={`text-xs font-medium ${outOfStock ? "text-gray-400" : "text-emerald-600"}`}>
                      {outOfStock ? "Out of stock" : `${med.stockQuantity} in stock`}
                    </p>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleRequest(med.id); }}
                      disabled={disabled}
                      className={`w-full py-1.5 rounded-lg text-xs font-semibold transition-colors mt-auto ${
                        isPending
                          ? "bg-amber-50 text-amber-600 cursor-default"
                          : outOfStock
                          ? "bg-gray-100 text-gray-400 cursor-default"
                          : "bg-[#111827] text-white hover:bg-gray-800"
                      }`}
                    >
                      {isRequesting ? "Submitting…" : isPending ? "Pending…" : "Request"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* My Requests tab */}
      {activeTab === "requests" && (
        myRequests.length === 0 ? (
          <div className="text-center text-gray-400 py-16">You haven't requested any medicines yet.</div>
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
            className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[85vh] overflow-y-auto scrollbar-hide"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative">
              <img
                src={selectedMed.imageUrl}
                alt={selectedMed.name}
                className="w-full aspect-square object-cover rounded-t-2xl"
              />
              <button
                onClick={() => setSelectedMed(null)}
                className="absolute top-3 right-3 w-8 h-8 bg-black/50 text-white rounded-full flex items-center justify-center hover:bg-black/70 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900">{selectedMed.name}</h2>
                <p className={`text-xs font-medium mt-1 ${selectedMed.stockQuantity <= 0 ? "text-gray-400" : "text-emerald-600"}`}>
                  {selectedMed.stockQuantity <= 0 ? "Out of stock" : `${selectedMed.stockQuantity} in stock`}
                </p>
              </div>
              <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">{selectedMed.caption}</p>
              <button
                onClick={() => { handleRequest(selectedMed.id); setSelectedMed(null); }}
                disabled={pendingIds.has(selectedMed.id) || selectedMed.stockQuantity <= 0 || requesting === selectedMed.id}
                className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                  pendingIds.has(selectedMed.id)
                    ? "bg-amber-50 text-amber-600 cursor-default"
                    : selectedMed.stockQuantity <= 0
                    ? "bg-gray-100 text-gray-400 cursor-default"
                    : "bg-[#111827] text-white hover:bg-gray-800"
                }`}
              >
                {pendingIds.has(selectedMed.id) ? "Pending…" : selectedMed.stockQuantity <= 0 ? "Out of stock" : "Request"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
