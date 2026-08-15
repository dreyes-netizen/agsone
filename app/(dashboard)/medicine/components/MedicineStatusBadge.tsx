import { MEDICINE_REQUEST_STATUS_BADGE } from "@/lib/constants/medicineRequestStatus";
import type { MedicineRequestStatus } from "../types";

export function MedicineStatusBadge({ status }: { status: MedicineRequestStatus }) {
  return (
    <span className={`inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${MEDICINE_REQUEST_STATUS_BADGE[status]}`}>
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}

export function nextStepCopy(status: MedicineRequestStatus): string {
  switch (status) {
    case "PENDING":
      return "Waiting for HR review.";
    case "APPROVED":
      return "Approved — you can collect this from HR or the medicine cabinet.";
    case "REJECTED":
      return "Declined by HR.";
  }
}
