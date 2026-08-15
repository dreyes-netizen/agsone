import { REDEMPTION_STATUS_LABEL, REDEMPTION_STATUS_BADGE } from "@/lib/constants/redemptionStatus";
import type { RedemptionStatus } from "../types";

export function RequestStatusBadge({ status }: { status: RedemptionStatus }) {
  return (
    <span className={`inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${REDEMPTION_STATUS_BADGE[status]}`}>
      {REDEMPTION_STATUS_LABEL[status]}
    </span>
  );
}

export function nextStepCopy(status: RedemptionStatus): string {
  switch (status) {
    case "PENDING":
      return "Waiting for HR review.";
    case "APPROVED":
      return "Approved — being prepared for fulfillment.";
    case "REJECTED":
      return "Rejected. Your points were refunded.";
    case "FULFILLED":
      return "Delivered. Enjoy!";
  }
}
