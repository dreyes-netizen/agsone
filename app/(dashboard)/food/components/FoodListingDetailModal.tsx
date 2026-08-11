import { Clock, AlertTriangle, Truck, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import type { Listing, AddOn } from "../types";
import { formatPrice, formatCutoff, isClosed, getUrgencyLabel } from "../utils";
import { OrderFormFields } from "./OrderFormFields";

interface FoodListingDetailModalProps {
  listing: Listing | null;
  imageIndex: number;
  onImageIndexChange: (index: number) => void;
  onOpenLightbox: (images: string[], index: number) => void;
  onClose: () => void;
  onViewSeller: (userId: string) => void;
  currentUserId: string | undefined;
  orderMode: "order" | "edit" | "confirm" | null;
  qty: number;
  setQty: React.Dispatch<React.SetStateAction<number>>;
  orderNote: string;
  setOrderNote: React.Dispatch<React.SetStateAction<string>>;
  selectedAddOns: AddOn[];
  setSelectedAddOns: React.Dispatch<React.SetStateAction<AddOn[]>>;
  submittingOrder: boolean;
  onStartOrder: () => void;
  onReviewOrder: () => void;
  onBackToOrderForm: () => void;
  onPlaceOrder: (listing: Listing) => void;
  onStartEditOrder: () => void;
  onCancelOrderEdit: () => void;
  onUpdateOrder: (listing: Listing) => void;
  onCancelOrder: (listing: Listing) => void;
}

export function FoodListingDetailModal(props: FoodListingDetailModalProps) {
  const {
    listing, imageIndex, onImageIndexChange, onOpenLightbox, onClose, onViewSeller, currentUserId,
    orderMode, qty, setQty, orderNote, setOrderNote, selectedAddOns, setSelectedAddOns, submittingOrder,
    onStartOrder, onReviewOrder, onBackToOrderForm, onPlaceOrder, onStartEditOrder, onCancelOrderEdit,
    onUpdateOrder, onCancelOrder,
  } = props;

  return (
    <Dialog
      open={!!listing}
      onOpenChange={(open) => { if (!open) onClose(); }}
    >
      <DialogContent
        className="max-w-md max-h-[85vh] p-0 rounded-2xl overflow-hidden flex flex-col"
        aria-labelledby={listing ? "food-modal-title" : undefined}
      >
        {listing && (() => {
          const closed = isClosed(listing);
          const isMine = listing.createdBy.id === currentUserId;
          const hasOrder = !!listing.myOrder;
          const addOnsTotal = selectedAddOns.reduce((s, a) => s + a.price, 0);
          const orderTotal = (parseFloat(listing.price) + addOnsTotal) * qty;
          const urgency = !closed ? getUrgencyLabel(listing.cutoffAt) : null;

          return (
            /* Scrollable content */
            <div className="overflow-y-auto scrollbar-hide flex-1 rounded-2xl">
              {/* Image carousel */}
              {listing.imageUrls.length > 0 && (() => {
                const total = listing.imageUrls.length;
                return (
                  <div className="relative group">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={listing.imageUrls[imageIndex]}
                      alt={listing.title}
                      className="w-full aspect-square object-contain bg-white rounded-t-2xl cursor-zoom-in"
                      onClick={() => onOpenLightbox(listing.imageUrls, imageIndex)}
                    />
                    {total > 1 && (
                      <>
                        <button
                          aria-label="Previous image"
                          onClick={() => onImageIndexChange((imageIndex - 1 + total) % total)}
                          className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full w-9 h-9 flex items-center justify-center transition-opacity opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                        >
                          <ChevronLeft className="w-5 h-5" />
                        </button>
                        <button
                          aria-label="Next image"
                          onClick={() => onImageIndexChange((imageIndex + 1) % total)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full w-9 h-9 flex items-center justify-center transition-opacity opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                        >
                          <ChevronRight className="w-5 h-5" />
                        </button>
                        <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex gap-2">
                          {listing.imageUrls.map((_, i) => (
                            <button
                              key={i}
                              aria-label={`Image ${i + 1} of ${total}`}
                              aria-current={i === imageIndex ? "true" : undefined}
                              onClick={() => onImageIndexChange(i)}
                              className={`w-2.5 h-2.5 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white ${i === imageIndex ? "bg-white" : "bg-white/50 hover:bg-white/75"}`}
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
                  <span className="text-lg font-bold text-emerald-600">{formatPrice(listing.price)}</span>
                  {closed && (
                    <span className="text-xs font-semibold bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Closed</span>
                  )}
                </div>

                {/* Title */}
                <h2 id="food-modal-title" className="text-xl font-bold text-gray-900">{listing.title}</h2>

                {/* Seller avatar + name + order count */}
                <div className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => { onClose(); onViewSeller(listing.createdBy.id); }}
                    className="flex items-center gap-2 hover:opacity-80 transition-opacity min-w-0"
                  >
                    {listing.createdBy.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={listing.createdBy.avatarUrl} alt="" className="w-7 h-7 rounded-full object-cover shrink-0" />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-navy-500 flex items-center justify-center text-xs font-bold text-white shrink-0">
                        {listing.createdBy.displayName.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()}
                      </div>
                    )}
                    <span className="text-xs text-gray-500 truncate">by {listing.createdBy.displayName}</span>
                  </button>
                  <span className="text-xs text-gray-500 shrink-0">
                    {listing._count.orders} {listing._count.orders === 1 ? "order" : "orders"}
                  </span>
                </div>

                {/* Description */}
                {listing.description && (
                  <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">{listing.description}</p>
                )}

                {/* Add-ons list */}
                {(listing.addOns?.length ?? 0) > 0 && (
                  <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 space-y-1">
                    <p className="text-[10px] font-semibold text-amber-700 uppercase tracking-wide">Add-ons available</p>
                    {listing.addOns.map((a, i) => (
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
                    Orders close {formatCutoff(listing.cutoffAt)}
                  </span>
                </div>

                {/* Delivery date */}
                {listing.deliveryDate && (
                  <p className="flex items-center gap-1 text-xs text-sky-600 font-medium"><Truck className="w-3.5 h-3.5 shrink-0" aria-hidden="true" /> Delivery: {new Date(listing.deliveryDate).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}</p>
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
                  {!closed && !isMine && !hasOrder && orderMode === null && (
                    <button
                      onClick={onStartOrder}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors"
                    >
                      Order
                    </button>
                  )}

                  {/* Inline order form */}
                  {!closed && !isMine && !hasOrder && orderMode === "order" && (
                    <div className="space-y-3">
                      <OrderFormFields
                        addOns={listing.addOns ?? []}
                        qty={qty}
                        onQtyChange={setQty}
                        selectedAddOns={selectedAddOns}
                        onSelectedAddOnsChange={setSelectedAddOns}
                        note={orderNote}
                        onNoteChange={setOrderNote}
                        total={orderTotal}
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={onReviewOrder}
                          className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold py-2 rounded-lg transition-colors"
                        >
                          Review Order
                        </button>
                        <button onClick={onCancelOrderEdit} className="text-sm text-gray-500 hover:text-gray-700 px-3">
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Confirmation step */}
                  {!closed && !isMine && !hasOrder && orderMode === "confirm" && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
                        <h3 className="font-bold text-gray-900">Confirm your order</h3>
                      </div>
                      <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-500">Item</span>
                          <span className="font-semibold text-gray-900 text-right max-w-[60%] leading-snug">{listing.title}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Qty</span>
                          <span className="font-semibold text-gray-900">{qty}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Price each</span>
                          <span className="font-semibold text-gray-900">{formatPrice(listing.price)}</span>
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
                          onClick={onBackToOrderForm}
                          disabled={submittingOrder}
                          className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          Back
                        </button>
                        <button
                          onClick={() => onPlaceOrder(listing)}
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
                  {!isMine && hasOrder && orderMode !== "edit" && (() => {
                    const oQty = listing.myOrder!.quantity;
                    const base = parseFloat(listing.price);
                    const addOnSum = (listing.myOrder!.selectedAddOns ?? []).reduce((s, a) => s + a.price, 0);
                    const oTotal = (base + addOnSum) * oQty;
                    return (
                      <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-3 space-y-2">
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1 flex-1 min-w-0">
                            <p className="text-xs font-bold text-gray-700">Your Order</p>
                            <p className="text-xs text-gray-600">×{oQty} {listing.title} <span className="text-gray-500">@ {formatPrice(listing.price)} each</span></p>
                            {(listing.myOrder!.selectedAddOns?.length ?? 0) > 0 && (
                              <div className="space-y-0.5">
                                {listing.myOrder!.selectedAddOns.map((a, i) => (
                                  <p key={i} className="text-xs text-amber-700">+ {a.name} <span className="text-gray-500">(₱{a.price.toFixed(2)} × {oQty})</span></p>
                                ))}
                              </div>
                            )}
                            <p className="text-[11px] text-gray-500">
                              Ordered {new Date(listing.myOrder!.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-base font-bold text-emerald-700">₱{oTotal.toFixed(2)}</p>
                            <p className="text-[10px] text-gray-500">total</p>
                          </div>
                        </div>
                        {listing.myOrder!.note && (
                          <p className="text-xs text-gray-500 italic border-t border-emerald-100 pt-2"><span aria-hidden="true">📝 </span>&ldquo;{listing.myOrder!.note}&rdquo;</p>
                        )}
                        {!closed && (
                          <div className="flex items-center gap-3 pt-1">
                            <button
                              onClick={onStartEditOrder}
                              className="text-xs text-emerald-600 hover:text-emerald-700 font-medium transition-colors"
                            >
                              Edit order
                            </button>
                            <span className="text-gray-200">|</span>
                            <button
                              onClick={() => onCancelOrder(listing)}
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
                  {!closed && !isMine && hasOrder && orderMode === "edit" && (
                    <div className="space-y-3">
                      <OrderFormFields
                        addOns={listing.addOns ?? []}
                        qty={qty}
                        onQtyChange={setQty}
                        selectedAddOns={selectedAddOns}
                        onSelectedAddOnsChange={setSelectedAddOns}
                        note={orderNote}
                        onNoteChange={setOrderNote}
                        total={(parseFloat(listing.price) + selectedAddOns.reduce((s, a) => s + a.price, 0)) * qty}
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => onUpdateOrder(listing)}
                          disabled={submittingOrder}
                          className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold py-2 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                        >
                          {submittingOrder && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                          Save Changes
                        </button>
                        <button onClick={onCancelOrderEdit} className="text-sm text-gray-500 hover:text-gray-700 px-3">
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
