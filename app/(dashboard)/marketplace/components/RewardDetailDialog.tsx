"use client";

import { useState } from "react";
import { AlertTriangle, ChevronLeft, ChevronRight, Loader2, CheckCircle2 } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { RewardImage } from "./RewardImage";
import { RewardTypeBadge } from "./RewardTypeBadge";
import { getStockState } from "../lib/rewardAvailability";
import type { Reward } from "../types";

type Stage = "view" | "confirm" | "success";

interface RewardDetailDialogProps {
  reward: Reward | null;
  balance: number;
  startConfirming?: boolean;
  onClose: () => void;
  onZoom: (images: string[], index: number) => void;
  onSubmit: (reward: Reward) => Promise<void>;
  onViewRequests: () => void;
}

// Rendered with `key={reward?.id}` by the caller — a new key per reward (and
// on every close, since the key becomes undefined) forces a full remount
// instead of an effect, so this transient state is always re-armed fresh
// without ever calling setState from inside an effect body.
export function RewardDetailDialog({ reward, balance, startConfirming, onClose, onZoom, onSubmit, onViewRequests }: RewardDetailDialogProps) {
  const [stage, setStage] = useState<Stage>(startConfirming ? "confirm" : "view");
  const [imageIndex, setImageIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!reward) return null;

  const images = reward.imageUrls ?? [];
  const total = images.length;
  const stock = getStockState(reward.stockQuantity);
  const canAfford = balance >= reward.pointCost;
  const deficit = reward.pointCost - balance;
  const canRequest = canAfford && !stock.outOfStock;

  async function handleSubmit() {
    if (!reward) return;
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(reward);
      setStage("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={!!reward} onOpenChange={(open) => { if (!open && !submitting) onClose(); }}>
      <DialogContent
        className="max-w-md w-full p-0 gap-0 max-h-[85vh] flex flex-col overflow-hidden rounded-2xl"
      >
        <DialogTitle className="sr-only">{reward.name}</DialogTitle>
        <div className="overflow-y-auto scrollbar-hide flex-1 rounded-2xl">
          {stage !== "success" && (
            <div className="relative group">
              {total > 0 ? (
                <button
                  type="button"
                  onClick={() => onZoom(images, imageIndex)}
                  className="block w-full aspect-square cursor-zoom-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-navy-500 rounded-t-2xl"
                  aria-label={`Zoom in on ${reward.name} image ${imageIndex + 1} of ${total}`}
                >
                  <RewardImage
                    src={images[imageIndex]}
                    alt={reward.name}
                    category={reward.category}
                    sizes="(min-width: 640px) 448px, 100vw"
                    className="w-full h-full rounded-t-2xl"
                  />
                </button>
              ) : (
                <RewardImage
                  src={undefined}
                  alt={reward.name}
                  category={reward.category}
                  sizes="(min-width: 640px) 448px, 100vw"
                  className="w-full aspect-square rounded-t-2xl"
                />
              )}
              {stock.lowStock && (
                <span className="absolute top-3 left-3 bg-amber-500 text-white text-xs font-bold px-2.5 py-1 rounded-full shadow pointer-events-none">
                  Only {reward.stockQuantity} left
                </span>
              )}
              {total > 1 && (
                <>
                  <button
                    type="button"
                    aria-label="Previous image"
                    onClick={() => setImageIndex((i) => (i - 1 + total) % total)}
                    className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full w-9 h-9 flex items-center justify-center motion-safe:transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white
                      opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    aria-label="Next image"
                    onClick={() => setImageIndex((i) => (i + 1) % total)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full w-9 h-9 flex items-center justify-center motion-safe:transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white
                      opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                  <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex gap-2">
                    {images.map((_, i) => (
                      <button
                        key={i}
                        type="button"
                        aria-label={`Image ${i + 1} of ${total}`}
                        aria-current={i === imageIndex ? "true" : undefined}
                        onClick={() => setImageIndex(i)}
                        className={`w-2.5 h-2.5 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white ${i === imageIndex ? "bg-white" : "bg-white/50 hover:bg-white/75"}`}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          <div className="p-5 space-y-4">
            {stage === "view" && (
              <>
                <div className="flex items-center justify-between">
                  <RewardTypeBadge category={reward.category} />
                  <span className="text-xs text-gray-500">{stock.label}</span>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">{reward.name}</h2>
                  {reward.description && (
                    <DialogDescription className="text-sm text-gray-600 mt-2 whitespace-pre-wrap leading-relaxed">
                      {reward.description}
                    </DialogDescription>
                  )}
                </div>
                <div className="rounded-xl bg-gray-50 p-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Cost</span>
                    <span className="font-bold text-gray-900 tabular-nums">{reward.pointCost.toLocaleString()} pts</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Your balance</span>
                    <span className="font-semibold text-gray-700 tabular-nums">{balance.toLocaleString()} pts</span>
                  </div>
                  {canRequest && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Balance after</span>
                      <span className="font-bold text-navy-600 tabular-nums">{(balance - reward.pointCost).toLocaleString()} pts</span>
                    </div>
                  )}
                </div>
                {!canAfford && !stock.outOfStock && (
                  <p className="text-sm text-gray-500">You need {deficit.toLocaleString()} more points to request this.</p>
                )}
                <button
                  disabled={!canRequest}
                  onClick={() => setStage("confirm")}
                  className={`w-full px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-command-black ${
                    canRequest ? "bg-command-black text-white hover:bg-gray-800" : "bg-gray-100 text-gray-500 cursor-not-allowed"
                  }`}
                >
                  {stock.outOfStock ? "Out of stock" : !canAfford ? "Not enough points" : `Request for ${reward.pointCost.toLocaleString()} pts`}
                </button>
              </>
            )}

            {stage === "confirm" && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" aria-hidden="true" />
                  <h3 className="font-bold text-gray-900">Submit this request?</h3>
                </div>
                <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
                  <div className="flex justify-between gap-3">
                    <span className="text-gray-500 shrink-0">Reward</span>
                    <span className="font-semibold text-gray-900 text-right leading-snug">{reward.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Cost</span>
                    <span className="font-semibold text-gray-900 tabular-nums">{reward.pointCost.toLocaleString()} pts</span>
                  </div>
                  <div className="border-t border-gray-200 my-1" />
                  <div className="flex justify-between">
                    <span className="text-gray-500">Your balance</span>
                    <span className="text-gray-700 tabular-nums">{balance.toLocaleString()} pts</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Balance after</span>
                    <span className="font-bold text-navy-600 tabular-nums">{(balance - reward.pointCost).toLocaleString()} pts</span>
                  </div>
                </div>
                <p className="text-xs text-gray-500 text-center">HR will review your request and confirm delivery.</p>
                {error && (
                  <p role="alert" className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                    {error}
                  </p>
                )}
                <div className="flex gap-3 pt-1">
                  <button
                    onClick={() => setStage("view")}
                    disabled={submitting}
                    className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-500 disabled:opacity-60"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold bg-command-black text-white hover:bg-gray-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-command-black disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                        <span>Submitting…</span>
                      </>
                    ) : (
                      "Submit request"
                    )}
                  </button>
                </div>
              </div>
            )}

            {stage === "success" && (
              <div className="space-y-4 text-center py-2">
                <div className="mx-auto w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6 text-emerald-600" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-lg">Request submitted</h3>
                  <p className="text-sm text-gray-500 mt-1">Your &ldquo;{reward.name}&rdquo; request has been submitted.</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-4 flex items-center justify-between text-sm">
                  <span className="font-bold text-gray-900 tabular-nums">{reward.pointCost.toLocaleString()} pts</span>
                  <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700">
                    Status: Pending
                  </span>
                </div>
                <div className="flex gap-3 pt-1">
                  <button
                    onClick={onClose}
                    className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-500"
                  >
                    Continue browsing
                  </button>
                  <button
                    onClick={onViewRequests}
                    className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold bg-command-black text-white hover:bg-gray-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-command-black"
                  >
                    View My Requests
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
