"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useApiClient } from "@/lib/hooks/useApiClient";
import { uploadToCloudinary } from "@/lib/cloudinary/upload";
import { UtensilsCrossed, Clock, X, ChevronDown, ChevronUp, Loader2, ImagePlus } from "lucide-react";
import { ImageLightbox } from "@/components/ImageLightbox";

type MyOrder = {
  id: string;
  quantity: number;
  note: string | null;
  createdAt: string;
};

type OrderRow = {
  id: string;
  quantity: number;
  note: string | null;
  createdAt: string;
  user: { displayName: string };
};

type Listing = {
  id: string;
  title: string;
  description: string | null;
  price: string;
  imageUrls: string[];
  cutoffAt: string;
  isActive: boolean;
  createdBy: { id: string; displayName: string; avatarUrl: string | null };
  myOrder: MyOrder | null;
  _count: { orders: number };
};

type Tab = "AVAILABLE" | "MY_ORDERS" | "MY_LISTINGS";

function formatPrice(price: string) {
  return `₱${parseFloat(price).toFixed(2)}`;
}

function formatCutoff(cutoffAt: string) {
  return new Date(cutoffAt).toLocaleString("en-US", {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
}

function isClosed(listing: Listing) {
  return !listing.isActive || new Date(listing.cutoffAt) <= new Date();
}

export default function FoodPage() {
  const { user, dbUser, loading: authLoading } = useAuth();
  const { apiFetch } = useApiClient();

  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("AVAILABLE");

  // Inline order form state
  const [orderingId, setOrderingId] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [orderNote, setOrderNote] = useState("");
  const [submittingOrder, setSubmittingOrder] = useState(false);

  // Expanded seller view
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sellerOrders, setSellerOrders] = useState<Record<string, OrderRow[]>>({});

  const [lightbox, setLightbox] = useState<{ images: string[]; index: number } | null>(null);

  // Create listing form
  const [showForm, setShowForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newCutoff, setNewCutoff] = useState("");
  const [newImages, setNewImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (authLoading || !user) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user]);

  async function load() {
    try {
      const r = await apiFetch<{ data: Listing[] }>("/api/food");
      setListings(r.data);
    } catch {
      alert("Failed to load listings");
    } finally {
      setLoading(false);
    }
  }

  // ── Image picker ────────────────────────────────────────────────────────────
  function handleImagePick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    const combined = [...newImages, ...files].slice(0, 3);
    imagePreviews.forEach((url) => URL.revokeObjectURL(url));
    setNewImages(combined);
    setImagePreviews(combined.map((f) => URL.createObjectURL(f)));
  }

  function removeImage(idx: number) {
    URL.revokeObjectURL(imagePreviews[idx]);
    const updated = newImages.filter((_, i) => i !== idx);
    setNewImages(updated);
    setImagePreviews(updated.map((f) => URL.createObjectURL(f)));
  }

  // ── Create listing ──────────────────────────────────────────────────────────
  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const imageUrls = await Promise.all(newImages.map((f) => uploadToCloudinary(f)));
      await apiFetch("/api/food", {
        method: "POST",
        body: JSON.stringify({
          title: newTitle,
          description: newDesc || undefined,
          price: parseFloat(newPrice),
          imageUrls,
          cutoffAt: new Date(newCutoff).toISOString(),
        }),
      });
      setShowForm(false);
      setNewTitle(""); setNewDesc(""); setNewPrice(""); setNewCutoff("");
      imagePreviews.forEach((url) => URL.revokeObjectURL(url));
      setNewImages([]); setImagePreviews([]);
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to create listing");
    } finally {
      setCreating(false);
    }
  }

  // ── Place order ─────────────────────────────────────────────────────────────
  async function handleOrder(listing: Listing) {
    setSubmittingOrder(true);
    try {
      await apiFetch(`/api/food/${listing.id}/order`, {
        method: "POST",
        body: JSON.stringify({ quantity: qty, note: orderNote || undefined }),
      });
      setListings((prev) =>
        prev.map((l) =>
          l.id === listing.id
            ? { ...l, myOrder: { id: "optimistic", quantity: qty, note: orderNote || null, createdAt: new Date().toISOString() }, _count: { orders: l._count.orders + 1 } }
            : l
        )
      );
      setOrderingId(null); setQty(1); setOrderNote("");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to place order");
    } finally {
      setSubmittingOrder(false);
    }
  }

  // ── Cancel order ────────────────────────────────────────────────────────────
  async function handleCancel(listing: Listing) {
    if (!confirm("Cancel your order?")) return;
    try {
      await apiFetch(`/api/food/${listing.id}/order`, { method: "DELETE" });
      setListings((prev) =>
        prev.map((l) =>
          l.id === listing.id
            ? { ...l, myOrder: null, _count: { orders: Math.max(0, l._count.orders - 1) } }
            : l
        )
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to cancel order");
    }
  }

  // ── Close listing ────────────────────────────────────────────────────────────
  async function handleClose(listing: Listing) {
    if (!confirm(`Close "${listing.title}"? No more orders will be accepted.`)) return;
    try {
      await apiFetch(`/api/food/${listing.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: false }),
      });
      setListings((prev) => prev.map((l) => l.id === listing.id ? { ...l, isActive: false } : l));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to close listing");
    }
  }

  // ── Load seller orders ───────────────────────────────────────────────────────
  async function toggleSellerOrders(listing: Listing) {
    if (expandedId === listing.id) { setExpandedId(null); return; }
    setExpandedId(listing.id);
    if (sellerOrders[listing.id]) return;
    try {
      const r = await apiFetch<{ data: OrderRow[] }>(`/api/food/${listing.id}/orders`);
      setSellerOrders((prev) => ({ ...prev, [listing.id]: r.data }));
    } catch {
      alert("Failed to load orders");
    }
  }

  // ── Filter ──────────────────────────────────────────────────────────────────
  const filtered = listings.filter((l) => {
    if (tab === "AVAILABLE") return l.isActive && new Date(l.cutoffAt) > new Date();
    if (tab === "MY_ORDERS") return !!l.myOrder;
    if (tab === "MY_LISTINGS") return l.createdBy.id === dbUser?.id;
    return true;
  });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Food Board</h1>
          <p className="text-zinc-500 text-sm mt-1">Order food from your colleagues</p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-2 bg-[#111827] hover:bg-gray-800 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          <UtensilsCrossed className="w-4 h-4" />
          Sell Food
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-zinc-200 p-5 space-y-4">
          <h2 className="font-semibold text-zinc-900">New Listing</h2>
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-zinc-600 mb-1">Title</label>
                <input
                  required value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Homemade Lumpia"
                  className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-500"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-zinc-600 mb-1">Description <span className="text-zinc-400 font-normal">(optional)</span></label>
                <textarea
                  value={newDesc} onChange={(e) => setNewDesc(e.target.value)} rows={2}
                  className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-500 resize-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1">Price (₱)</label>
                <input
                  required type="number" min="1" step="0.01" value={newPrice} onChange={(e) => setNewPrice(e.target.value)}
                  placeholder="120.00"
                  className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1">Order cutoff</label>
                <input
                  required type="datetime-local" value={newCutoff} onChange={(e) => setNewCutoff(e.target.value)}
                  min={new Date(Date.now() + 60_000).toISOString().slice(0, 16)}
                  className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-500"
                />
              </div>
            </div>

            {/* Image picker */}
            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1">Photos <span className="text-zinc-400 font-normal">(up to 3, optional)</span></label>
              <div className="flex items-center gap-2 flex-wrap">
                {imagePreviews.map((src, i) => (
                  <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden border border-zinc-200">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt="" className="w-full h-full object-cover" />
                    <button type="button" onClick={() => removeImage(i)} className="absolute top-0.5 right-0.5 bg-black/50 rounded-full p-0.5 text-white">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                {newImages.length < 3 && (
                  <label className="w-16 h-16 rounded-lg border-2 border-dashed border-zinc-300 flex flex-col items-center justify-center cursor-pointer hover:border-navy-400 transition-colors">
                    <ImagePlus className="w-5 h-5 text-zinc-400" />
                    <span className="text-[10px] text-zinc-400 mt-0.5">Add</span>
                    <input type="file" accept="image/*" className="hidden" onChange={handleImagePick} multiple />
                  </label>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="submit" disabled={creating}
                className="flex items-center gap-2 bg-[#111827] hover:bg-gray-800 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
              >
                {creating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {creating ? "Creating…" : "Post Listing"}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="text-sm text-zinc-500 hover:text-zinc-700 px-3 py-2">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2">
        {([["AVAILABLE", "Available"], ["MY_ORDERS", "My Orders"], ["MY_LISTINGS", "My Listings"]] as [Tab, string][]).map(([t, label]) => (
          <button
            key={t} onClick={() => setTab(t)}
            className={`px-3.5 py-1.5 rounded-lg text-sm font-medium border transition-all ${
              tab === t
                ? "bg-[#111827] text-white border-[#111827]"
                : "bg-white border-zinc-200 text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Listings */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-zinc-200 overflow-hidden animate-pulse">
              <div className="h-36 bg-zinc-100" />
              <div className="p-4 space-y-2">
                <div className="h-4 bg-zinc-100 rounded w-2/3" />
                <div className="h-3 bg-zinc-100 rounded w-full" />
                <div className="h-8 bg-zinc-100 rounded-lg w-full mt-3" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border border-zinc-200 text-center">
          <UtensilsCrossed className="w-10 h-10 text-zinc-200 mb-4" />
          <p className="text-zinc-600 font-medium">Nothing here</p>
          <p className="text-zinc-400 text-sm mt-1">
            {tab === "AVAILABLE" ? "No food listings right now — be the first to post!" : "Nothing to show for this tab."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((listing) => {
            const closed = isClosed(listing);
            const isMine = listing.createdBy.id === dbUser?.id;
            const isExpanded = expandedId === listing.id;

            return (
              <div key={listing.id} className="bg-white rounded-xl border border-zinc-200 overflow-hidden flex flex-col hover:shadow-sm transition-shadow">
                {/* Hero image */}
                {listing.imageUrls.length > 0 && (
                  <div className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={listing.imageUrls[0]}
                      alt={listing.title}
                      className="w-full h-36 object-cover cursor-zoom-in"
                      onClick={() => setLightbox({ images: listing.imageUrls, index: 0 })}
                    />
                    {listing.imageUrls.length > 1 && (
                      <div className="flex gap-1 absolute bottom-1.5 right-1.5">
                        {listing.imageUrls.slice(1).map((url, i) => (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            key={i}
                            src={url}
                            alt=""
                            className="w-10 h-10 object-cover rounded border-2 border-white cursor-zoom-in"
                            onClick={() => setLightbox({ images: listing.imageUrls, index: i + 1 })}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {listing.imageUrls.length === 0 && (
                  <div className={`h-1 ${closed ? "bg-zinc-300" : "bg-emerald-500"}`} />
                )}

                <div className="p-4 flex flex-col flex-1 gap-2">
                  {/* Seller */}
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-navy-500 flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                      {listing.createdBy.displayName.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()}
                    </div>
                    <span className="text-xs text-zinc-500">{listing.createdBy.displayName}</span>
                    <span className="ml-auto text-xs text-zinc-400">{listing._count.orders} orders</span>
                  </div>

                  {/* Title + desc */}
                  <div>
                    <h3 className="font-bold text-zinc-900 leading-snug">{listing.title}</h3>
                    {listing.description && (
                      <p className="text-sm text-zinc-500 mt-0.5 line-clamp-2">{listing.description}</p>
                    )}
                  </div>

                  {/* Price + cutoff */}
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-bold text-emerald-600">{formatPrice(listing.price)}</span>
                    <span className={`flex items-center gap-1 text-xs ${closed ? "text-zinc-400" : "text-amber-600"}`}>
                      <Clock className="w-3.5 h-3.5" />
                      {closed ? "Closed" : `By ${formatCutoff(listing.cutoffAt)}`}
                    </span>
                  </div>

                  {/* Action area */}
                  <div className="mt-auto pt-3 border-t border-zinc-100 space-y-2">
                    {closed && !isMine && (
                      <span className="text-xs font-medium text-zinc-400 bg-zinc-100 px-3 py-1.5 rounded-lg w-full block text-center">
                        Orders closed
                      </span>
                    )}

                    {!closed && !isMine && !listing.myOrder && orderingId !== listing.id && (
                      <button
                        onClick={() => { setOrderingId(listing.id); setQty(1); setOrderNote(""); }}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold py-2 rounded-lg transition-colors"
                      >
                        Order
                      </button>
                    )}

                    {/* Inline order form */}
                    {!closed && !isMine && !listing.myOrder && orderingId === listing.id && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-zinc-500 w-16 shrink-0">Quantity</label>
                          <div className="flex items-center gap-1">
                            <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} className="w-7 h-7 rounded border border-zinc-200 text-zinc-600 hover:bg-zinc-50 text-sm font-bold">−</button>
                            <span className="w-8 text-center text-sm font-semibold">{qty}</span>
                            <button type="button" onClick={() => setQty((q) => Math.min(99, q + 1))} className="w-7 h-7 rounded border border-zinc-200 text-zinc-600 hover:bg-zinc-50 text-sm font-bold">+</button>
                          </div>
                        </div>
                        <input
                          value={orderNote} onChange={(e) => setOrderNote(e.target.value)}
                          placeholder="e.g. no onions (optional)"
                          className="w-full border border-zinc-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleOrder(listing)} disabled={submittingOrder}
                            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold py-1.5 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                          >
                            {submittingOrder && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                            Confirm Order
                          </button>
                          <button onClick={() => setOrderingId(null)} className="text-sm text-zinc-500 hover:text-zinc-700 px-2">
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Existing order */}
                    {!isMine && listing.myOrder && (
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-semibold text-zinc-700">Your order: ×{listing.myOrder.quantity}</p>
                          {listing.myOrder.note && <p className="text-xs text-zinc-400">{listing.myOrder.note}</p>}
                        </div>
                        {!closed && (
                          <button onClick={() => handleCancel(listing)} className="text-xs text-red-500 hover:text-red-600 font-medium">
                            Cancel
                          </button>
                        )}
                      </div>
                    )}

                    {/* Seller view */}
                    {isMine && (
                      <div className="space-y-2">
                        <button
                          onClick={() => toggleSellerOrders(listing)}
                          className="w-full flex items-center justify-between text-sm font-medium text-zinc-700 bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 px-3 py-2 rounded-lg transition-colors"
                        >
                          <span>View Orders ({listing._count.orders})</span>
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                        {!closed && (
                          <button onClick={() => handleClose(listing)} className="w-full text-sm text-red-500 hover:text-red-600 font-medium border border-red-200 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors">
                            Close Listing
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Seller order list (expanded) */}
                {isMine && isExpanded && (
                  <div className="border-t border-zinc-100 px-4 py-3 bg-zinc-50">
                    {!sellerOrders[listing.id] ? (
                      <div className="flex justify-center py-2"><Loader2 className="w-4 h-4 animate-spin text-zinc-400" /></div>
                    ) : sellerOrders[listing.id].length === 0 ? (
                      <p className="text-xs text-zinc-400 text-center py-2">No orders yet.</p>
                    ) : (
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-zinc-400 border-b border-zinc-200">
                            <th className="text-left pb-1.5 font-medium">Name</th>
                            <th className="text-center pb-1.5 font-medium">Qty</th>
                            <th className="text-left pb-1.5 font-medium">Note</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sellerOrders[listing.id].map((o) => (
                            <tr key={o.id} className="border-b border-zinc-100 last:border-0">
                              <td className="py-1.5 font-medium text-zinc-800">{o.user.displayName}</td>
                              <td className="py-1.5 text-center text-zinc-700">×{o.quantity}</td>
                              <td className="py-1.5 text-zinc-400">{o.note ?? "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            );
          })}
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
    </div>
  );
}
