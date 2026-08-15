"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, Minus, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { MedicineImage } from "./MedicineImage";
import { MEDICINE_CATEGORY_LABEL } from "@/lib/constants/medicineCategories";
import { getStockState } from "../lib/medicineAvailability";
import type { Medicine } from "../types";

type Stage = "view" | "confirm" | "success";

interface MedicineDetailDialogProps {
  medicine: Medicine | null;
  pending: boolean;
  startConfirming?: boolean;
  onClose: () => void;
  onZoom: (images: string[], index: number) => void;
  onSubmit: (medicine: Medicine, quantity: number) => Promise<void>;
  onViewRequests: () => void;
}

// Rendered with `key={medicine?.id}` by the caller — a new key per medicine
// (and on every close, since the key becomes undefined) forces a full remount
// instead of an effect, so this transient state is always re-armed fresh
// without ever calling setState from inside an effect body.
export function MedicineDetailDialog({ medicine, pending, startConfirming, onClose, onZoom, onSubmit, onViewRequests }: MedicineDetailDialogProps) {
  const [stage, setStage] = useState<Stage>(startConfirming ? "confirm" : "view");
  const [quantity, setQuantity] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!medicine) return null;

  const stock = getStockState(medicine.stockQuantity);
  const canRequest = !stock.outOfStock && !pending;

  async function handleSubmit() {
    if (!medicine) return;
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(medicine, quantity);
      setStage("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={!!medicine} onOpenChange={(open) => { if (!open && !submitting) onClose(); }}>
      <DialogContent className="max-w-md w-full p-0 gap-0 max-h-[85vh] flex flex-col overflow-hidden rounded-2xl">
        <DialogTitle className="sr-only">{medicine.name}</DialogTitle>
        <div className="overflow-y-auto scrollbar-hide flex-1 rounded-2xl">
          {stage !== "success" && (
            <button
              type="button"
              onClick={() => onZoom([medicine.imageUrl], 0)}
              disabled={!medicine.imageUrl}
              className="block w-full aspect-square cursor-zoom-in disabled:cursor-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-navy-500 rounded-t-2xl"
              aria-label={medicine.imageUrl ? `Zoom in on ${medicine.name} image` : medicine.name}
            >
              <MedicineImage
                src={medicine.imageUrl}
                alt={medicine.name}
                sizes="(min-width: 640px) 448px, 100vw"
                className="w-full h-full rounded-t-2xl"
                showFallbackLabel
              />
            </button>
          )}

          <div className="p-5 space-y-4">
            {stage === "view" && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{MEDICINE_CATEGORY_LABEL[medicine.category]}</span>
                  <span className={`text-xs font-medium ${stock.outOfStock ? "text-gray-500" : stock.lowStock ? "text-amber-600" : "text-emerald-600"}`}>
                    {stock.label}
                  </span>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900 break-words">{medicine.name}</h2>
                  {medicine.caption && (
                    <DialogDescription className="text-sm text-gray-600 mt-2 whitespace-pre-wrap break-words leading-relaxed">
                      {medicine.caption}
                    </DialogDescription>
                  )}
                </div>
                <button
                  disabled={!canRequest}
                  onClick={() => setStage("confirm")}
                  className={`w-full px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-command-black ${
                    canRequest ? "bg-command-black text-white hover:bg-gray-800" : "bg-gray-100 text-gray-500 cursor-not-allowed"
                  }`}
                >
                  {stock.outOfStock ? "Out of stock" : pending ? "Request pending" : "Request"}
                </button>
              </>
            )}

            {stage === "confirm" && (
              <div className="space-y-4">
                <h3 className="font-bold text-gray-900 text-lg">Request {medicine.name}?</h3>
                <p className="text-sm text-gray-600">How many do you need?</p>

                <div className="flex items-center justify-center gap-4 py-1">
                  <button
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    disabled={quantity <= 1}
                    aria-label="Decrease quantity"
                    className="w-11 h-11 rounded-full border-2 border-gray-200 flex items-center justify-center text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-2"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="w-12 text-center text-2xl font-bold text-gray-900 tabular-nums" aria-live="polite" aria-label={`Quantity ${quantity}`}>
                    {quantity}
                  </span>
                  <button
                    onClick={() => setQuantity((q) => Math.min(medicine.stockQuantity, q + 1))}
                    disabled={quantity >= medicine.stockQuantity}
                    aria-label="Increase quantity"
                    className="w-11 h-11 rounded-full border-2 border-gray-200 flex items-center justify-center text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-2"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-center text-xs text-gray-500">{medicine.stockQuantity} available</p>

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
                      `Request ${quantity}`
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
                  <p className="text-sm text-gray-500 mt-1">Your &ldquo;{medicine.name}&rdquo; request has been sent for review.</p>
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
