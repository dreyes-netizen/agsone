import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { MedicineStatusBadge, nextStepCopy } from "./MedicineStatusBadge";
import type { MedicineRequest } from "../types";

interface RequestDetailDialogProps {
  request: MedicineRequest | null;
  onClose: () => void;
}

export function RequestDetailDialog({ request, onClose }: RequestDetailDialogProps) {
  if (!request) return null;

  return (
    <Dialog open={!!request} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-sm w-full rounded-2xl">
        <DialogTitle className="text-lg font-bold text-gray-900 pr-6">{request.medicine.name}</DialogTitle>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">{request.quantity} {request.quantity === 1 ? "unit" : "units"} requested</span>
            <MedicineStatusBadge status={request.status} />
          </div>
          <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Requested</span>
              <span className="text-gray-700">
                {new Date(request.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </span>
            </div>
          </div>
          <p className="text-sm text-gray-600">{nextStepCopy(request.status)}</p>
          <button
            onClick={onClose}
            className="w-full px-4 py-2.5 rounded-lg text-sm font-semibold border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-500"
          >
            Close
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
