"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useApiClient } from "@/lib/hooks/useApiClient";
import { useAuth } from "@/lib/auth/AuthProvider";
import { Pagination } from "@/components/ui/pagination";
import { useRealtimeChannels } from "@/lib/hooks/useRealtimeChannel";
import { realtimeTopics } from "@/lib/realtime/topics";

import type { Medicine, MedicineRequest, SortOption, MedicineView } from "./types";
import { MedicineHeader } from "./components/MedicineHeader";
import { MedicineTabs } from "./components/MedicineTabs";
import { MedicineToolbar } from "./components/MedicineToolbar";
import { CategoryFilters, type CategoryFilter } from "./components/CategoryFilters";
import { MedicineGrid } from "./components/MedicineGrid";
import { MedicineDetailDialog } from "./components/MedicineDetailDialog";
import { MyRequestsView } from "./components/MyRequestsView";
import { RequestDetailDialog } from "./components/RequestDetailDialog";
import { filterAndSortMedicines } from "./lib/filterMedicines";

// Closed by default — split into its own chunk instead of shipping with the
// page bundle.
const ImageLightbox = dynamic(
  () => import("@/components/ImageLightbox").then((m) => m.ImageLightbox),
  { ssr: false },
);

export default function MedicinePage() {
  const { apiFetch } = useApiClient();
  const { user, dbUser, loading: authLoading } = useAuth();

  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [myRequests, setMyRequests] = useState<MedicineRequest[]>([]);
  const [pendingMedicineIds, setPendingMedicineIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [requestingId, setRequestingId] = useState<string | null>(null);
  const [reqPage, setReqPage] = useState(1);
  const [reqPages, setReqPages] = useState(1);

  const [view, setView] = useState<MedicineView>("catalog");
  const [category, setCategory] = useState<CategoryFilter>("ALL");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortOption>("nameAsc");
  const [availableOnly, setAvailableOnly] = useState(false);

  const [selectedMedicine, setSelectedMedicine] = useState<Medicine | null>(null);
  const [confirmOnOpen, setConfirmOnOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<MedicineRequest | null>(null);
  const [lightbox, setLightbox] = useState<{ images: string[]; index: number } | null>(null);

  async function load() {
    try {
      const res = await apiFetch<{
        data: { medicines: Medicine[]; pendingMedicineIds: string[]; myRequests: MedicineRequest[] };
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

  function openMedicine(medicine: Medicine, startConfirming = false) {
    setSelectedMedicine(medicine);
    setConfirmOnOpen(startConfirming);
  }
  function closeMedicine() {
    setSelectedMedicine(null);
    setConfirmOnOpen(false);
  }

  async function handleSubmitRequest(medicine: Medicine, quantity: number) {
    const res = await apiFetch<{ data: MedicineRequest }>(
      `/api/medicine/${medicine.id}/request`,
      { method: "POST", body: JSON.stringify({ quantity }) },
    );
    setMyRequests((prev) => [{ ...res.data, medicine: { name: medicine.name } }, ...prev]);
    setPendingMedicineIds((prev) => new Set(prev).add(medicine.id));
  }

  const categoryCounts = useMemo(
    () =>
      medicines.reduce<Record<string, number>>((acc, m) => {
        acc[m.category] = (acc[m.category] ?? 0) + 1;
        return acc;
      }, {}),
    [medicines],
  );

  const hasActiveFilters = search.trim() !== "" || category !== "ALL" || availableOnly;

  function clearFilters() {
    setSearch("");
    setCategory("ALL");
    setAvailableOnly(false);
  }

  const visibleMedicines = useMemo(
    () => filterAndSortMedicines(medicines, { category, search, sort, availableOnly }),
    [medicines, category, search, sort, availableOnly],
  );

  return (
    <div className="space-y-5">
      <MedicineHeader />

      <MedicineTabs view={view} onChange={setView} requestCount={myRequests.length} />

      {view === "catalog" && (
        <div id="panel-catalog" role="tabpanel" aria-labelledby="tab-catalog" className="space-y-4">
          <MedicineToolbar
            search={search}
            onSearchChange={setSearch}
            sort={sort}
            onSortChange={setSort}
            availableOnly={availableOnly}
            onAvailableOnlyChange={setAvailableOnly}
          />

          <CategoryFilters
            active={category}
            counts={categoryCounts}
            total={medicines.length}
            loading={loading}
            onChange={setCategory}
          />

          <MedicineGrid
            loading={loading}
            medicines={visibleMedicines}
            requestingId={requestingId}
            pendingMedicineIds={pendingMedicineIds}
            onOpen={(m) => openMedicine(m)}
            onRequest={(m) => openMedicine(m, true)}
            hasActiveFilters={hasActiveFilters}
            onClearFilters={clearFilters}
          />
        </div>
      )}

      {view === "requests" && (
        <div id="panel-requests" role="tabpanel" aria-labelledby="tab-requests" className="space-y-3">
          <MyRequestsView loading={loading} requests={myRequests} onOpenDetail={setSelectedRequest} />
          <Pagination page={reqPage} pages={reqPages} onPageChange={setReqPage} />
        </div>
      )}

      {lightbox && (
        <ImageLightbox
          images={lightbox.images}
          initialIndex={lightbox.index}
          open={!!lightbox}
          onClose={() => setLightbox(null)}
        />
      )}

      <MedicineDetailDialog
        key={selectedMedicine?.id}
        medicine={selectedMedicine}
        pending={selectedMedicine ? pendingMedicineIds.has(selectedMedicine.id) : false}
        startConfirming={confirmOnOpen}
        onClose={closeMedicine}
        onZoom={(images, index) => setLightbox({ images, index })}
        onSubmit={async (medicine, quantity) => {
          setRequestingId(medicine.id);
          try {
            await handleSubmitRequest(medicine, quantity);
          } finally {
            setRequestingId(null);
          }
        }}
        onViewRequests={() => {
          closeMedicine();
          setView("requests");
        }}
      />

      <RequestDetailDialog request={selectedRequest} onClose={() => setSelectedRequest(null)} />
    </div>
  );
}
