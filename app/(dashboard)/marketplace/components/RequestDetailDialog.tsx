import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { RewardTypeBadge } from "./RewardTypeBadge";
import { RequestStatusBadge, nextStepCopy } from "./RequestStatusBadge";
import type { Redemption } from "../types";

interface RequestDetailDialogProps {
  redemption: Redemption | null;
  onClose: () => void;
}

export function RequestDetailDialog({ redemption, onClose }: RequestDetailDialogProps) {
  if (!redemption) return null;

  return (
    <Dialog open={!!redemption} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-sm w-full rounded-2xl">
        <DialogTitle className="text-lg font-bold text-gray-900 pr-6">{redemption.reward.name}</DialogTitle>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <RewardTypeBadge category={redemption.reward.category} />
            <RequestStatusBadge status={redemption.status} />
          </div>
          <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Points spent</span>
              <span className="font-semibold text-gray-900 tabular-nums">{redemption.pointsSpent.toLocaleString()} pts</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Requested</span>
              <span className="text-gray-700">
                {new Date(redemption.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </span>
            </div>
            {redemption.updatedAt !== redemption.createdAt && (
              <div className="flex justify-between">
                <span className="text-gray-500">Last updated</span>
                <span className="text-gray-700">
                  {new Date(redemption.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </span>
              </div>
            )}
          </div>
          <p className="text-sm text-gray-600">{nextStepCopy(redemption.status)}</p>
          {redemption.adminNote && (
            <div className="text-sm bg-amber-50 border border-amber-100 rounded-xl p-3">
              <p className="text-xs font-semibold text-amber-700 mb-0.5">Note from HR</p>
              <p className="text-amber-800">{redemption.adminNote}</p>
            </div>
          )}
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
