"use client";

import type { Dispatch, SetStateAction } from "react";
import { useRouter } from "next/navigation";
import { Clock, ChevronLeft, ChevronRight, AlertTriangle, Truck, Loader2, StickyNote } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import type { AddOn, Listing } from "@/lib/types/food";
import { formatPrice, formatCutoff, isClosed, getUrgencyLabel } from "@/lib/helpers/food";

export function ListingDetailModal({
  selectedListing,
  dbUserId,
  modalOrderMode, setModalOrderMode,
  qty, setQty,
  orderNote, setOrderNote,
  selectedAddOns, setSelectedAddOns,
  submittingOrder,
  selectedListingImageIndex, setSelectedListingImageIndex,
  setLightbox,
  router,
  onOpenChange,
  onOrder,
  onUpdateOrder,
  onCancelOrder,
}: {
  selectedListing: Listing | null;
  dbUserId?: string;
  modalOrderMode: "order" | "edit" | "confirm" | null;
  setModalOrderMode: Dispatch<SetStateAction<"order" | "edit" | "confirm" | null>>;
  qty: number; setQty: Dispatch<SetStateAction<number>>;
  orderNote: string; setOrderNote: (v: string) => void;
  selectedAddOns: AddOn[]; setSelectedAddOns: Dispatch<SetStateAction<AddOn[]>>;
  submittingOrder: boolean;
  selectedListingImageIndex: number; setSelectedListingImageIndex: Dispatch<SetStateAction<number>>;
  setLightbox: Dispatch<SetStateAction<{ images: string[]; index: number } | null>>;
  router: ReturnType<typeof useRouter>;
  onOpenChange: (open: boolean) => void;
  onOrder: (listing: Listing) => void;
  onUpdateOrder: (listing: Listing) => void;
  onCancelOrder: (listing: Listing) => void;
}) {
  return (
    <Dialog
      open={!!selectedListing}
      onOpenChange={onOpenChange}
    >
      <DialogContent
        className="max-w-md max-h-[85vh] p-0 rounded-2xl overflow-hidden flex flex-col"
        aria-labelledby={selectedListing ? "food-modal-title" : undefined}
      >
        {selectedListing && (() => {
          const closed = isClosed(selectedListing);
          const isMine = selectedListing.createdBy.id === dbUserId;
          const hasOrder = !!selectedListing.myOrder;
          const addOnsTotal = selectedAddOns.reduce((s, a) => s + a.price, 0);
          const orderTotal = (parseFloat(selectedListing.price) + addOnsTotal) * qty;
          const urgency = !closed ? getUrgencyLabel(selectedListing.cutoffAt) : null;

          return (
            /* Scrollable content */
            <div className="overflow-y-auto scrollbar-hide flex-1 rounded-2xl">
              {/* Image carousel */}
              {selectedListing.imageUrls.length > 0 && (() => {
                const total = selectedListing.imageUrls.length;
                return (
                  <div className="relative group">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={selectedListing.imageUrls[selectedListingImageIndex]}
                      alt={selectedListing.title}
                      className="w-full aspect-square object-contain bg-white rounded-t-2xl cursor-zoom-in"
                      onClick={() => setLightbox({ images: selectedListing.imageUrls, index: selectedListingImageIndex })}
                    />
                    {total > 1 && (
                      <>
                        <button
                          aria-label="Previous image"
                          onClick={() => setSelectedListingImageIndex((i) => (i - 1 + total) % total)}
                          className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full w-9 h-9 flex items-center justify-center transition-opacity opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                        >
                          <ChevronLeft className="w-5 h-5" />
                        </button>
                        <button
                          aria-label="Next image"
                          onClick={() => setSelectedListingImageIndex((i) => (i + 1) % total)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full w-9 h-9 flex items-center justify-center transition-opacity opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                        >
                          <ChevronRight className="w-5 h-5" />
                        </button>
                        <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex gap-2">
                          {selectedListing.imageUrls.map((_, i) => (
                            <button
                              key={i}
                              aria-label={`Image ${i + 1} of ${total}`}
                              aria-current={i === selectedListingImageIndex ? "true" : undefined}
                              onClick={() => setSelectedListingImageIndex(i)}
                              className={`w-2.5 h-2.5 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white ${i === selectedListingImageIndex ? "bg-white" : "bg-white/50 hover:bg-white/75"}`}
                            />
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                );
              })()}

              <div className="p-5 space-y-4">
                {/* Price + closed badge */}
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-emerald-600">{formatPrice(selectedListing.price)}</span>
                  {closed && (
                    <span className="text-xs font-semibold bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Closed</span>
                  )}
                </div>

                {/* Title */}
                <h2 id="food-modal-title" className="text-xl font-bold text-gray-900">{selectedListing.title}</h2>

                {/* Seller avatar + name + order count */}
                <div className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => { onOpenChange(false); router.push(`/employees/${selectedListing.createdBy.id}`); }}
                    className="flex items-center gap-2 hover:opacity-80 transition-opacity min-w-0"
                  >
                    {selectedListing.createdBy.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={selectedListing.createdBy.avatarUrl} alt="" className="w-7 h-7 rounded-full object-cover shrink-0" />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-navy-500 flex items-center justify-center text-xs font-bold text-white shrink-0">
                        {selectedListing.createdBy.displayName.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()}
                      </div>
                    )}
                    <span className="text-xs text-gray-500 truncate">by {selectedListing.createdBy.displayName}</span>
                  </button>
                  <span className="text-xs text-gray-500 shrink-0">
                    {selectedListing._count.orders} {selectedListing._count.orders === 1 ? "order" : "orders"}
                  </span>
                </div>

                {/* Description */}
                {selectedListing.description && (
                  <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">{selectedListing.description}</p>
                )}

                {/* Add-ons list */}
                {(selectedListing.addOns?.length ?? 0) > 0 && (
                  <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 space-y-1">
                    <p className="text-[10px] font-semibold text-amber-700 uppercase tracking-wide">Add-ons available</p>
                    {selectedListing.addOns.map((a, i) => (
                      <div key={i} className="flex justify-between text-xs text-gray-700">
                        <span>{a.name}</span>
                        <span className="font-semibold text-amber-700">+₱{a.price % 1 === 0 ? a.price : a.price.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Cutoff + urgency chip */}
                <div className="flex items-center gap-2 flex-wrap">
                  {urgency && (
                    <span className="text-xs font-semibold bg-red-50 text-red-500 border border-red-100 px-2 py-0.5 rounded-full">
                      {urgency}
                    </span>
                  )}
                  <span className="flex items-center gap-1 text-xs text-gray-500">
                    <Clock className="w-3.5 h-3.5" />
                    Orders close {formatCutoff(selectedListing.cutoffAt)}
                  </span>
                </div>

                {/* Delivery date */}
                {selectedListing.deliveryDate && (
                  <p className="flex items-center gap-1 text-xs text-navy-600 font-medium"><Truck className="w-3.5 h-3.5 shrink-0" aria-hidden="true" /> Delivery: {new Date(selectedListing.deliveryDate).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}</p>
                )}

                {/* Action area */}
                <div className="pt-3 border-t border-gray-100 space-y-3">

                  {/* Closed */}
                  {closed && !isMine && (
                    <span className="text-xs font-medium text-gray-500 bg-gray-100 px-3 py-1.5 rounded-lg w-full block text-center">
                      Orders closed
                    </span>
                  )}

                  {/* Order button */}
                  {!closed && !isMine && !hasOrder && modalOrderMode === null && (
                    <button
                      onClick={() => { setModalOrderMode("order"); setQty(1); setOrderNote(""); setSelectedAddOns([]); }}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors"
                    >
                      Order
                    </button>
                  )}

                  {/* Inline order form */}
                  {!closed && !isMine && !hasOrder && modalOrderMode === "order" && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-gray-500 w-16 shrink-0">Quantity</label>
                        <div className="flex items-center gap-1">
                          <button type="button" aria-label="Decrease quantity" onClick={() => setQty((q) => Math.max(1, q - 1))} className="w-9 h-9 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-emerald-500">−</button>
                          <span className="w-8 text-center text-sm font-semibold" aria-live="polite">{qty}</span>
                          <button type="button" aria-label="Increase quantity" onClick={() => setQty((q) => Math.min(99, q + 1))} className="w-9 h-9 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-emerald-500">+</button>
                        </div>
                      </div>
                      {(selectedListing.addOns?.length ?? 0) > 0 && (
                        <div className="space-y-1.5 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                          <p className="text-[10px] font-semibold text-amber-700 uppercase tracking-wide">Add-ons</p>
                          {(selectedListing.addOns ?? []).map((a, i) => {
                            const checked = selectedAddOns.some((s) => s.name === a.name);
                            return (
                              <label key={i} className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox" checked={checked}
                                  onChange={(e) => setSelectedAddOns((prev) => e.target.checked ? [...prev, a] : prev.filter((s) => s.name !== a.name))}
                                  className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                                />
                                <span className="text-xs text-gray-700 flex-1">{a.name}</span>
                                <span className="text-xs font-semibold text-amber-700">{a.price > 0 ? `+₱${a.price % 1 === 0 ? a.price : a.price.toFixed(2)}` : "Free"}</span>
                              </label>
                            );
                          })}
                        </div>
                      )}
                      <input
                        value={orderNote} onChange={(e) => setOrderNote(e.target.value)}
                        placeholder="e.g. no onions (optional)"
                        className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                      <div className="flex items-center justify-between text-xs px-0.5">
                        <span className="text-gray-500">Total</span>
                        <span className="font-bold text-emerald-700 text-sm">₱{orderTotal.toFixed(2)}</span>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setModalOrderMode("confirm")}
                          className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold py-2 rounded-lg transition-colors"
                        >
                          Review Order
                        </button>
                        <button onClick={() => setModalOrderMode(null)} className="text-sm text-gray-500 hover:text-gray-700 px-3">
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Confirmation step */}
                  {!closed && !isMine && !hasOrder && modalOrderMode === "confirm" && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
                        <h3 className="font-bold text-gray-900">Confirm your order</h3>
                      </div>
                      <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-500">Item</span>
                          <span className="font-semibold text-gray-900 text-right max-w-[60%] leading-snug">{selectedListing.title}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Qty</span>
                          <span className="font-semibold text-gray-900">{qty}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Price each</span>
                          <span className="font-semibold text-gray-900">{formatPrice(selectedListing.price)}</span>
                        </div>
                        {selectedAddOns.length > 0 && selectedAddOns.map((a, i) => (
                          <div key={i} className="flex justify-between">
                            <span className="text-gray-500">+ {a.name}</span>
                            <span className="font-semibold text-amber-700">{a.price > 0 ? `+₱${a.price % 1 === 0 ? a.price : a.price.toFixed(2)}` : "Free"}</span>
                          </div>
                        ))}
                        {orderNote && (
                          <div className="flex justify-between">
                            <span className="text-gray-500">Note</span>
                            <span className="text-gray-600 italic text-right max-w-[60%]">&ldquo;{orderNote}&rdquo;</span>
                          </div>
                        )}
                        <div className="border-t border-gray-200 pt-2 flex justify-between">
                          <span className="font-semibold text-gray-700">Total</span>
                          <span className="font-bold text-emerald-700 text-base">₱{orderTotal.toFixed(2)}</span>
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <button
                          onClick={() => setModalOrderMode("order")}
                          disabled={submittingOrder}
                          className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          Back
                        </button>
                        <button
                          onClick={() => onOrder(selectedListing)}
                          disabled={submittingOrder}
                          className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-1.5"
                        >
                          {submittingOrder && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                          {submittingOrder ? "Placing…" : "Place Order"}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Existing order summary */}
                  {!isMine && hasOrder && modalOrderMode !== "edit" && (() => {
                    const oQty = selectedListing.myOrder!.quantity;
                    const base = parseFloat(selectedListing.price);
                    const addOnSum = (selectedListing.myOrder!.selectedAddOns ?? []).reduce((s, a) => s + a.price, 0);
                    const oTotal = (base + addOnSum) * oQty;
                    return (
                      <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-3 space-y-2">
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1 flex-1 min-w-0">
                            <p className="text-xs font-bold text-gray-700">Your Order</p>
                            <p className="text-xs text-gray-600">×{oQty} {selectedListing.title} <span className="text-gray-500">@ {formatPrice(selectedListing.price)} each</span></p>
                            {(selectedListing.myOrder!.selectedAddOns?.length ?? 0) > 0 && (
                              <div className="space-y-0.5">
                                {selectedListing.myOrder!.selectedAddOns.map((a, i) => (
                                  <p key={i} className="text-xs text-amber-700">+ {a.name} <span className="text-gray-500">(₱{a.price.toFixed(2)} × {oQty})</span></p>
                                ))}
                              </div>
                            )}
                            <p className="text-[11px] text-gray-500">
                              Ordered {new Date(selectedListing.myOrder!.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-base font-bold text-emerald-700">₱{oTotal.toFixed(2)}</p>
                            <p className="text-[10px] text-gray-500">total</p>
                          </div>
                        </div>
                        {selectedListing.myOrder!.note && (
                          <p className="text-xs text-gray-500 italic border-t border-emerald-100 pt-2 flex items-start gap-1"><StickyNote className="w-3 h-3 mt-0.5 shrink-0" aria-hidden="true" /> &ldquo;{selectedListing.myOrder!.note}&rdquo;</p>
                        )}
                        {!closed && (
                          <div className="flex items-center gap-3 pt-1">
                            <button
                              onClick={() => {
                                setQty(selectedListing.myOrder!.quantity);
                                setOrderNote(selectedListing.myOrder!.note ?? "");
                                setSelectedAddOns(selectedListing.myOrder!.selectedAddOns ?? []);
                                setModalOrderMode("edit");
                              }}
                              className="text-xs text-emerald-600 hover:text-emerald-700 font-medium transition-colors"
                            >
                              Edit order
                            </button>
                            <span className="text-gray-200">|</span>
                            <button
                              onClick={() => onCancelOrder(selectedListing)}
                              className="text-xs text-red-500 hover:text-red-600 font-medium transition-colors"
                            >
                              Cancel order
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Edit order form */}
                  {!closed && !isMine && hasOrder && modalOrderMode === "edit" && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-gray-500 w-16 shrink-0">Quantity</label>
                        <div className="flex items-center gap-1">
                          <button type="button" aria-label="Decrease quantity" onClick={() => setQty((q) => Math.max(1, q - 1))} className="w-9 h-9 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-emerald-500">−</button>
                          <span className="w-8 text-center text-sm font-semibold" aria-live="polite">{qty}</span>
                          <button type="button" aria-label="Increase quantity" onClick={() => setQty((q) => Math.min(99, q + 1))} className="w-9 h-9 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-emerald-500">+</button>
                        </div>
                      </div>
                      {(selectedListing.addOns?.length ?? 0) > 0 && (
                        <div className="space-y-1.5 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                          <p className="text-[10px] font-semibold text-amber-700 uppercase tracking-wide">Add-ons</p>
                          {(selectedListing.addOns ?? []).map((a, i) => {
                            const checked = selectedAddOns.some((s) => s.name === a.name);
                            return (
                              <label key={i} className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox" checked={checked}
                                  onChange={(e) => setSelectedAddOns((prev) => e.target.checked ? [...prev, a] : prev.filter((s) => s.name !== a.name))}
                                  className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                                />
                                <span className="text-xs text-gray-700 flex-1">{a.name}</span>
                                <span className="text-xs font-semibold text-amber-700">{a.price > 0 ? `+₱${a.price % 1 === 0 ? a.price : a.price.toFixed(2)}` : "Free"}</span>
                              </label>
                            );
                          })}
                        </div>
                      )}
                      <input
                        value={orderNote} onChange={(e) => setOrderNote(e.target.value)}
                        placeholder="e.g. no onions (optional)"
                        className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                      <div className="flex items-center justify-between text-xs px-0.5">
                        <span className="text-gray-500">Total</span>
                        <span className="font-bold text-emerald-700 text-sm">₱{((parseFloat(selectedListing.price) + selectedAddOns.reduce((s, a) => s + a.price, 0)) * qty).toFixed(2)}</span>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => onUpdateOrder(selectedListing)}
                          disabled={submittingOrder}
                          className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold py-2 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                        >
                          {submittingOrder && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                          Save Changes
                        </button>
                        <button onClick={() => setModalOrderMode(null)} className="text-sm text-gray-500 hover:text-gray-700 px-3">
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })()}
      </DialogContent>
    </Dialog>
  );
}
