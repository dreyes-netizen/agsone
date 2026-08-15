import { SearchX, Pill } from "lucide-react";
import type { Medicine } from "../types";
import { MedicineCard } from "./MedicineCard";
import { MedicineEmptyState } from "./MedicineEmptyState";

const GRID_CLASSES = "flex flex-col gap-3 sm:grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 sm:gap-4";

interface MedicineGridProps {
  loading: boolean;
  medicines: Medicine[];
  requestingId: string | null;
  pendingMedicineIds: Set<string>;
  onOpen: (medicine: Medicine) => void;
  onRequest: (medicine: Medicine) => void;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
}

export function MedicineGrid(props: MedicineGridProps) {
  const { loading, medicines, requestingId, pendingMedicineIds, onOpen, onRequest, hasActiveFilters, onClearFilters } = props;

  if (loading) {
    return (
      <div className={GRID_CLASSES} aria-label="Loading medicines" aria-busy="true">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="bg-white rounded-card border border-table-border overflow-hidden animate-pulse h-[88px] sm:h-56" />
        ))}
      </div>
    );
  }

  if (medicines.length === 0) {
    return hasActiveFilters ? (
      <MedicineEmptyState
        icon={SearchX}
        title="No medicines found"
        description="Try another search or clear your filters."
        action={
          <button
            onClick={onClearFilters}
            className="text-sm font-semibold text-navy-600 hover:text-navy-700 px-3 py-1.5 rounded-lg border border-navy-200 hover:bg-navy-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-navy-500"
          >
            Clear filters
          </button>
        }
      />
    ) : (
      <MedicineEmptyState
        icon={Pill}
        title="No medicines available"
        description="Available medicines will appear here."
      />
    );
  }

  return (
    <div className={GRID_CLASSES}>
      {medicines.map((medicine) => (
        <MedicineCard
          key={medicine.id}
          medicine={medicine}
          requesting={requestingId === medicine.id}
          pending={pendingMedicineIds.has(medicine.id)}
          onOpen={onOpen}
          onRequest={onRequest}
        />
      ))}
    </div>
  );
}
