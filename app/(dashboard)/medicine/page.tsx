"use client";

import { useEffect, useState } from "react";
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
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Medicine</h1>
        <p className="text-gray-500 text-sm mt-1">
          Request a medicine from the company cabinet.
        </p>
      </div>

      {loading ? (
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
                className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col"
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
                    onClick={() => handleRequest(med.id)}
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
      )}

      {myRequests.length > 0 && (
        <div>
          <h2 className="text-lg font-bold text-gray-900 mb-3">My Requests</h2>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Medicine
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Requested
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {myRequests.map((r) => (
                  <tr
                    key={r.id}
                    className="border-t border-gray-50 hover:bg-gray-50/60 transition-colors"
                  >
                    <td className="px-5 py-3 font-medium text-gray-900">{r.medicine.name}</td>
                    <td className="px-5 py-3 text-gray-500 text-sm">
                      {new Date(r.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
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
      )}
    </div>
  );
}
