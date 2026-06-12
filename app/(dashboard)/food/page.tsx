"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useApiClient } from "@/lib/hooks/useApiClient";
import { uploadToCloudinary } from "@/lib/cloudinary/upload";
import { UtensilsCrossed, Clock, X, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Loader2, ImagePlus, Pencil, Plus, CheckCircle, AlertCircle, AlertTriangle } from "lucide-react";
import { ImageLightbox } from "@/components/ImageLightbox";

type AddOn = { name: string; price: number };

type MyOrder = {
  id: string;
  quantity: number;
  note: string | null;
  selectedAddOns: AddOn[];
  createdAt: string;
};

type OrderRow = {
  id: string;
  quantity: number;
  note: string | null;
  selectedAddOns: AddOn[];
  paidAt: string | null;
  createdAt: string;
  user: { id: string; displayName: string; department: { name: string } | null };
};

type Listing = {
  id: string;
  title: string;
  description: string | null;
  price: string;
  imageUrls: string[];
  cutoffAt: string;
  deliveryDate: string | null;
  addOns: AddOn[];
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

function getUrgencyLabel(cutoffAt: string): string | null {
  const diff = new Date(cutoffAt).getTime() - Date.now();
  if (diff <= 0 || diff > 60 * 60_000) return null;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "Closes in less than a minute";
  if (minutes === 1) return "Closes in 1 min";
  return `Closes in ${minutes} min`;
}

export default function FoodPage() {
  const { user, dbUser, token, loading: authLoading } = useAuth();
  const { apiFetch } = useApiClient();
  const router = useRouter();

  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("AVAILABLE");

  // Order form state
  const [qty, setQty] = useState(1);
  const [orderNote, setOrderNote] = useState("");
  const [selectedAddOns, setSelectedAddOns] = useState<AddOn[]>([]);
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  // Expanded seller view
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sellerOrders, setSellerOrders] = useState<Record<string, OrderRow[]>>({});

  const [lightbox, setLightbox] = useState<{ images: string[]; index: number } | null>(null);
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [selectedListingImageIndex, setSelectedListingImageIndex] = useState(0);
  const [cardImageIndices, setCardImageIndices] = useState<Record<string, number>>({});
  const [modalOrderMode, setModalOrderMode] = useState<"order" | "edit" | "confirm" | null>(null);

  // Create / edit form
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newCutoff, setNewCutoff] = useState("");
  const [newDeliveryDate, setNewDeliveryDate] = useState("");
  const [newImages, setNewImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [existingImageUrls, setExistingImageUrls] = useState<string[]>([]);
  const [newAddOns, setNewAddOns] = useState<AddOn[]>([]);
  const [addOnName, setAddOnName] = useState("");
  const [addOnPrice, setAddOnPrice] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (authLoading || !user) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user]);

  function showToast(type: "success" | "error", msg: string) {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  }

  async function load() {
    try {
      const r = await apiFetch<{ data: Listing[] }>("/api/food");
      setListings(r.data);
    } catch {
      showToast("error", "Failed to load listings");
    } finally {
      setLoading(false);
    }
  }

  // ── Image picker ─────────────────────────────────────────────────────────────
  function handleImagePick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    const remaining = 3 - existingImageUrls.length;
    const combined = [...newImages, ...files].slice(0, remaining);
    imagePreviews.forEach((url) => URL.revokeObjectURL(url));
    setNewImages(combined);
    setImagePreviews(combined.map((f) => URL.createObjectURL(f)));
  }

  function removeNewImage(idx: number) {
    URL.revokeObjectURL(imagePreviews[idx]);
    const updated = newImages.filter((_, i) => i !== idx);
    setNewImages(updated);
    setImagePreviews(updated.map((f) => URL.createObjectURL(f)));
  }

  function removeExistingImage(idx: number) {
    setExistingImageUrls((prev) => prev.filter((_, i) => i !== idx));
  }

  // ── Add-on management ────────────────────────────────────────────────────────
  function addAddOn() {
    const name = addOnName.trim();
    const price = parseFloat(addOnPrice);
    if (!name || isNaN(price) || price < 0 || newAddOns.length >= 10) return;
    setNewAddOns((prev) => [...prev, { name, price }]);
    setAddOnName("");
    setAddOnPrice("");
  }

  function removeAddOn(idx: number) {
    setNewAddOns((prev) => prev.filter((_, i) => i !== idx));
  }

  // ── Reset form ───────────────────────────────────────────────────────────────
  function resetForm() {
    setShowForm(false);
    setEditingId(null);
    setNewTitle(""); setNewDesc(""); setNewPrice(""); setNewCutoff(""); setNewDeliveryDate("");
    imagePreviews.forEach((url) => URL.revokeObjectURL(url));
    setNewImages([]); setImagePreviews([]); setExistingImageUrls([]);
    setNewAddOns([]); setAddOnName(""); setAddOnPrice("");
  }

  // ── Edit listing ─────────────────────────────────────────────────────────────
  function handleEdit(listing: Listing) {
    setEditingId(listing.id);
    setNewTitle(listing.title);
    setNewDesc(listing.description ?? "");
    setNewPrice(parseFloat(listing.price).toString());
    setNewCutoff(new Date(listing.cutoffAt).toISOString().slice(0, 16));
    setNewDeliveryDate(listing.deliveryDate ? new Date(listing.deliveryDate).toISOString().slice(0, 16) : "");
    setExistingImageUrls(listing.imageUrls);
    imagePreviews.forEach((url) => URL.revokeObjectURL(url));
    setNewImages([]); setImagePreviews([]);
    setNewAddOns(listing.addOns ?? []);
    setAddOnName(""); setAddOnPrice("");
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // ── Create / update listing ──────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const uploadedUrls = await Promise.all(newImages.map((f) => uploadToCloudinary(f, token!)));
      const imageUrls = [...existingImageUrls, ...uploadedUrls];
      const payload = {
        title: newTitle,
        description: newDesc || undefined,
        price: parseFloat(newPrice),
        imageUrls,
        cutoffAt: new Date(newCutoff).toISOString(),
        ...(newDeliveryDate && { deliveryDate: new Date(newDeliveryDate).toISOString() }),
        addOns: newAddOns,
      };
      if (editingId) {
        await apiFetch(`/api/food/${editingId}`, { method: "PATCH", body: JSON.stringify(payload) });
      } else {
        await apiFetch("/api/food", { method: "POST", body: JSON.stringify(payload) });
      }
      resetForm();
      await load();
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Failed to save listing");
    } finally {
      setCreating(false);
    }
  }

  // ── Place order ──────────────────────────────────────────────────────────────
  async function handleOrder(listing: Listing) {
    setSubmittingOrder(true);
    try {
      await apiFetch(`/api/food/${listing.id}/order`, {
        method: "POST",
        body: JSON.stringify({ quantity: qty, note: orderNote || undefined, selectedAddOns }),
      });
      const newMyOrder = { id: "optimistic", quantity: qty, note: orderNote || null, selectedAddOns, createdAt: new Date().toISOString() };
      setListings((prev) =>
        prev.map((l) =>
          l.id === listing.id
            ? { ...l, myOrder: newMyOrder, _count: { orders: l._count.orders + 1 } }
            : l
        )
      );
      setSelectedListing((prev) =>
        prev?.id === listing.id ? { ...prev, myOrder: newMyOrder, _count: { orders: prev._count.orders + 1 } } : prev
      );
      setQty(1); setOrderNote(""); setSelectedAddOns([]);
      setModalOrderMode(null);
      showToast("success", "Order placed!");
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Failed to place order");
    } finally {
      setSubmittingOrder(false);
    }
  }

  // ── Edit order ───────────────────────────────────────────────────────────────
  function openEditOrder(listing: Listing) {
    if (!listing.myOrder) return;
    setQty(listing.myOrder.quantity);
    setOrderNote(listing.myOrder.note ?? "");
    setSelectedAddOns(listing.myOrder.selectedAddOns ?? []);
    setSelectedListing(listing);
    setSelectedListingImageIndex(cardImageIndices[listing.id] ?? 0);
    setModalOrderMode("edit");
  }

  async function handleUpdateOrder(listing: Listing) {
    setSubmittingOrder(true);
    try {
      const res = await apiFetch<{ data: MyOrder }>(`/api/food/${listing.id}/order`, {
        method: "PATCH",
        body: JSON.stringify({ quantity: qty, note: orderNote || undefined, selectedAddOns }),
      });
      setListings((prev) =>
        prev.map((l) => l.id === listing.id ? { ...l, myOrder: res.data } : l)
      );
      setSelectedListing((prev) =>
        prev?.id === listing.id ? { ...prev, myOrder: res.data } : prev
      );
      setModalOrderMode(null);
      showToast("success", "Order updated!");
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Failed to update order");
    } finally {
      setSubmittingOrder(false);
    }
  }

  // ── Cancel order ─────────────────────────────────────────────────────────────
  async function handleCancel(listing: Listing) {
    try {
      await apiFetch(`/api/food/${listing.id}/order`, { method: "DELETE" });
      setListings((prev) =>
        prev.map((l) =>
          l.id === listing.id
            ? { ...l, myOrder: null, _count: { orders: Math.max(0, l._count.orders - 1) } }
            : l
        )
      );
      setSelectedListing((prev) =>
        prev?.id === listing.id ? { ...prev, myOrder: null, _count: { orders: Math.max(0, prev._count.orders - 1) } } : prev
      );
      showToast("success", "Order cancelled");
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Failed to cancel order");
    }
  }

  // ── Toggle paid ───────────────────────────────────────────────────────────────
  async function togglePaid(listingId: string, orderId: string, paid: boolean) {
    try {
      const res = await apiFetch<{ data: { paidAt: string | null } }>(
        `/api/food/${listingId}/orders/${orderId}`,
        { method: "PATCH", body: JSON.stringify({ paid }) }
      );
      setSellerOrders((prev) => ({
        ...prev,
        [listingId]: (prev[listingId] ?? []).map((o) =>
          o.id === orderId ? { ...o, paidAt: res.data.paidAt } : o
        ),
      }));
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Failed to update payment status");
    }
  }

  // ── Sell Again (clone listing) ───────────────────────────────────────────────
  function handleSellAgain(listing: Listing) {
    setEditingId(null);
    setNewTitle(listing.title);
    setNewDesc(listing.description ?? "");
    setNewPrice(parseFloat(listing.price).toString());
    setNewCutoff("");
    setNewDeliveryDate("");
    setExistingImageUrls(listing.imageUrls);
    setNewImages([]); setImagePreviews([]);
    setNewAddOns(listing.addOns ?? []);
    setAddOnName(""); setAddOnPrice("");
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // ── Delete listing ────────────────────────────────────────────────────────────
  async function handleDelete(listing: Listing) {
    if (!confirm(`Delete "${listing.title}"? This cannot be undone and will remove all orders.`)) return;
    try {
      await apiFetch(`/api/food/${listing.id}`, { method: "DELETE" });
      setListings((prev) => prev.filter((l) => l.id !== listing.id));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete listing");
    }
  }

  // ── Close listing ─────────────────────────────────────────────────────────────
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

  // ── Load seller orders ────────────────────────────────────────────────────────
  async function toggleSellerOrders(listing: Listing) {
    if (expandedId === listing.id) { setExpandedId(null); return; }
    setExpandedId(listing.id);
    if (sellerOrders[listing.id]) return;
    try {
      const r = await apiFetch<{ data: OrderRow[] }>(`/api/food/${listing.id}/orders`);
      setSellerOrders((prev) => ({ ...prev, [listing.id]: r.data }));
    } catch {
      showToast("error", "Failed to load orders");
    }
  }

  // ── Filter ───────────────────────────────────────────────────────────────────
  const filtered = listings.filter((l) => {
    if (tab === "AVAILABLE") return l.isActive && new Date(l.cutoffAt) > new Date();
    if (tab === "MY_ORDERS") return !!l.myOrder;
    if (tab === "MY_LISTINGS") return l.createdBy.id === dbUser?.id;
    return true;
  });

  const totalImages = existingImageUrls.length + newImages.length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Food Board</h1>
          <p className="text-zinc-500 text-sm mt-1">Order food from your colleagues</p>
        </div>
        <button
          onClick={() => {
            if (showForm && !editingId) {
              resetForm();
            } else {
              resetForm();
              setShowForm(true);
            }
          }}
          className="flex items-center gap-2 bg-[#111827] hover:bg-gray-800 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          <UtensilsCrossed className="w-4 h-4" />
          Sell Food
        </button>
      </div>

      {/* Toast — fixed overlay, bottom on mobile / top-right on desktop */}
      {toast && (
        <div className={`fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:bottom-4 sm:w-auto sm:max-w-sm z-[60] flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium border shadow-lg ${
          toast.type === "success"
            ? "bg-emerald-50 text-emerald-800 border-emerald-200"
            : "bg-red-50 text-red-800 border-red-200"
        }`}>
          {toast.type === "success"
            ? <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" />
            : <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />}
          {toast.msg}
        </div>
      )}

      {/* Create / edit form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-zinc-200 p-5 space-y-4">
          <h2 className="font-semibold text-zinc-900">{editingId ? "Edit Listing" : "New Listing"}</h2>
          <form onSubmit={handleSubmit} className="space-y-3">
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
                <div className="flex justify-between items-baseline mb-1">
                  <label className="block text-xs font-medium text-zinc-600">Description <span className="text-zinc-400 font-normal">(optional)</span></label>
                  <span className={`text-xs ${newDesc.length > 1800 ? "text-red-500" : "text-zinc-400"}`}>{newDesc.length}/2000</span>
                </div>
                <textarea
                  value={newDesc} onChange={(e) => setNewDesc(e.target.value)} rows={3}
                  maxLength={2000}
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
              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1">Delivery date & time <span className="text-zinc-400 font-normal">(optional)</span></label>
                <input
                  type="datetime-local" value={newDeliveryDate} onChange={(e) => setNewDeliveryDate(e.target.value)}
                  min={new Date().toISOString().slice(0, 16)}
                  className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-500"
                />
              </div>
            </div>

            {/* Image picker */}
            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1">Photos <span className="text-zinc-400 font-normal">(up to 3, optional)</span></label>
              <div className="flex items-center gap-2 flex-wrap">
                {existingImageUrls.map((src, i) => (
                  <div key={src} className="relative w-16 h-16 rounded-lg overflow-hidden border border-zinc-200">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt="" className="w-full h-full object-cover" />
                    <button type="button" onClick={() => removeExistingImage(i)} className="absolute top-0.5 right-0.5 bg-black/50 rounded-full p-0.5 text-white">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                {imagePreviews.map((src, i) => (
                  <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden border border-zinc-200">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt="" className="w-full h-full object-cover" />
                    <button type="button" onClick={() => removeNewImage(i)} className="absolute top-0.5 right-0.5 bg-black/50 rounded-full p-0.5 text-white">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                {totalImages < 3 && (
                  <label className="w-16 h-16 rounded-lg border-2 border-dashed border-zinc-300 flex flex-col items-center justify-center cursor-pointer hover:border-navy-400 transition-colors">
                    <ImagePlus className="w-5 h-5 text-zinc-400" />
                    <span className="text-[10px] text-zinc-400 mt-0.5">Add</span>
                    <input type="file" accept="image/*" className="hidden" onChange={handleImagePick} multiple />
                  </label>
                )}
              </div>
            </div>

            {/* Add-ons */}
            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1">
                Add-ons / Options <span className="text-zinc-400 font-normal">(optional — e.g. Extra Rice ₱15, Spicy ₱0)</span>
              </label>
              {newAddOns.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {newAddOns.map((a, i) => (
                    <span key={i} className="flex items-center gap-1.5 bg-zinc-100 text-zinc-700 text-xs px-2.5 py-1 rounded-full">
                      {a.name}{a.price > 0 ? ` — ₱${a.price % 1 === 0 ? a.price : a.price.toFixed(2)}` : " — Free"}
                      <button type="button" onClick={() => removeAddOn(i)} className="text-zinc-400 hover:text-zinc-700">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              {newAddOns.length < 10 && (
                <div className="flex gap-2">
                  <input
                    value={addOnName} onChange={(e) => setAddOnName(e.target.value)}
                    placeholder="Name (e.g. Extra Rice)"
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addAddOn())}
                    className="flex-1 border border-zinc-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy-500"
                  />
                  <input
                    value={addOnPrice} onChange={(e) => setAddOnPrice(e.target.value)}
                    type="number" min="0" step="0.01" placeholder="₱ (0 = free)"
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addAddOn())}
                    className="w-20 border border-zinc-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy-500"
                  />
                  <button
                    type="button" onClick={addAddOn}
                    className="flex items-center gap-1 text-sm font-medium bg-zinc-100 hover:bg-zinc-200 text-zinc-700 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />Add
                  </button>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <button
                type="submit" disabled={creating}
                className="flex items-center gap-2 bg-[#111827] hover:bg-gray-800 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
              >
                {creating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {creating ? (editingId ? "Saving…" : "Creating…") : editingId ? "Save Changes" : "Post Listing"}
              </button>
              <button type="button" onClick={resetForm} className="text-sm text-zinc-500 hover:text-zinc-700 px-3 py-2">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tabs — horizontal scroll on mobile */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0 sm:overflow-visible pb-0.5">
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((listing) => {
            const closed = isClosed(listing);
            const isMine = listing.createdBy.id === dbUser?.id;
            const isExpanded = expandedId === listing.id;
            const addOnsTotal = selectedAddOns.reduce((s, a) => s + a.price, 0);
            const orderTotal = (parseFloat(listing.price) + addOnsTotal) * qty;

            return (
              <div key={listing.id} className="bg-white rounded-xl border border-zinc-200 overflow-hidden flex flex-col hover:shadow-sm transition-shadow">

                {/* Mobile: image left + content right | Desktop: image top + content below */}
                <div className="flex flex-row items-center sm:flex-col sm:items-stretch">

                  {/* Image / accent */}
                  {listing.imageUrls.length > 0 ? (() => {
                    const idx = cardImageIndices[listing.id] ?? 0;
                    const total = listing.imageUrls.length;
                    const setIdx = (i: number) => setCardImageIndices((prev) => ({ ...prev, [listing.id]: i }));
                    return (
                      <div
                        className="relative group shrink-0 w-[120px] h-[120px] sm:w-full sm:h-auto"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={listing.imageUrls[idx]}
                          alt={listing.title}
                          className="w-full h-full object-contain bg-white cursor-zoom-in sm:aspect-square"
                          onClick={() => setLightbox({ images: listing.imageUrls, index: idx })}
                        />
                        {/* Carousel — desktop only */}
                        {total > 1 && (
                          <div className="hidden sm:block">
                            <button
                              onClick={(e) => { e.stopPropagation(); setIdx((idx - 1 + total) % total); }}
                              className="absolute left-1 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <ChevronLeft className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); setIdx((idx + 1) % total); }}
                              className="absolute right-1 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <ChevronRight className="w-4 h-4" />
                            </button>
                            <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 flex gap-1">
                              {listing.imageUrls.map((_, i) => (
                                <button key={i} onClick={(e) => { e.stopPropagation(); setIdx(i); }}
                                  className={`w-1.5 h-1.5 rounded-full transition-colors ${i === idx ? "bg-white" : "bg-white/50"}`}
                                />
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })() : (
                    // Mobile: vertical left strip | Desktop: horizontal top strip
                    <div className={`shrink-0 self-stretch w-1.5 bg-gradient-to-b sm:w-full sm:h-1 sm:self-auto sm:bg-gradient-to-r ${closed ? "bg-zinc-300" : "bg-emerald-500"}`} />
                  )}

                  {/* Content */}
                  <div className="flex flex-col flex-1 min-w-0 p-3 sm:p-4 gap-1.5 sm:gap-2">

                    {/* Seller */}
                    <div className="flex items-center gap-1.5 min-w-0">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); router.push(`/employees/${listing.createdBy.id}`); }}
                        className="flex items-center gap-1.5 hover:opacity-80 transition-opacity min-w-0 flex-1"
                      >
                        {listing.createdBy.avatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={listing.createdBy.avatarUrl} alt="" className="w-6 h-6 sm:w-8 sm:h-8 rounded-full object-cover shrink-0" />
                        ) : (
                          <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-navy-500 flex items-center justify-center text-[10px] sm:text-xs font-bold text-white shrink-0">
                            {listing.createdBy.displayName.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()}
                          </div>
                        )}
                        <span className="text-xs text-zinc-500 truncate">{listing.createdBy.displayName}</span>
                      </button>
                      <span className="hidden sm:inline shrink-0 text-xs text-zinc-400">{listing._count.orders} orders</span>
                    </div>

                    {/* Title — click to open modal */}
                    <div className="cursor-pointer" onClick={() => { setSelectedListing(listing); setSelectedListingImageIndex(cardImageIndices[listing.id] ?? 0); }}>
                      <h3 className="font-bold text-zinc-900 leading-snug hover:text-emerald-700 transition-colors line-clamp-2 text-sm sm:text-base">{listing.title}</h3>
                      {listing.description && (
                        <div className="hidden sm:block">
                          <p className="text-sm text-zinc-500 mt-0.5 line-clamp-2">{listing.description}</p>
                        </div>
                      )}
                    </div>

                    {/* Price + cutoff */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-base sm:text-lg font-bold text-emerald-600 shrink-0">{formatPrice(listing.price)}</span>
                      <span className={`flex items-center gap-1 text-xs shrink-0 ${closed ? "text-zinc-400" : "text-amber-600"}`}>
                        <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
                        {closed ? "Closed" : `By ${formatCutoff(listing.cutoffAt)}`}
                      </span>
                    </div>

                    {/* Delivery — desktop only */}
                    {listing.deliveryDate && (
                      <div className="hidden sm:flex items-center gap-1 text-xs text-sky-600 font-medium">
                        <span>🚚</span>
                        <span>Delivery: {new Date(listing.deliveryDate).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}</span>
                      </div>
                    )}

                    {/* Add-ons badges — desktop only */}
                    {(listing.addOns?.length ?? 0) > 0 && (
                      <div className="hidden sm:flex flex-wrap gap-1">
                        {(listing.addOns ?? []).map((a, i) => (
                          <span key={i} className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-full">
                            +{a.name}{a.price > 0 ? ` ₱${a.price % 1 === 0 ? a.price : a.price.toFixed(2)}` : " (free)"}
                          </span>
                        ))}
                      </div>
                    )}

                  {/* Action area */}
                  <div className="mt-auto pt-2 sm:pt-3 border-t border-zinc-100 space-y-2">
                    {closed && !isMine && (
                      <span className="text-xs font-medium text-zinc-400 bg-zinc-100 px-3 py-1.5 rounded-lg w-full block text-center">
                        Orders closed
                      </span>
                    )}

                    {/* Order button — opens modal */}
                    {!closed && !isMine && !listing.myOrder && (
                      <button
                        onClick={() => {
                          setSelectedListing(listing);
                          setSelectedListingImageIndex(cardImageIndices[listing.id] ?? 0);
                          setQty(1); setOrderNote(""); setSelectedAddOns([]);
                          setModalOrderMode("order");
                        }}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold py-2 rounded-lg transition-colors"
                      >
                        Order
                      </button>
                    )}

                    {/* Existing order summary on card */}
                    {!isMine && listing.myOrder && (() => {
                      const oQty = listing.myOrder.quantity;
                      const base = parseFloat(listing.price);
                      const addOnSum = (listing.myOrder.selectedAddOns ?? []).reduce((s, a) => s + a.price, 0);
                      const total = (base + addOnSum) * oQty;
                      return (
                        <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-3 space-y-2">
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1 flex-1 min-w-0">
                              <p className="text-xs font-bold text-zinc-700">Your Order</p>
                              <p className="text-xs text-zinc-600">×{oQty} {listing.title} <span className="text-zinc-400">@ {formatPrice(listing.price)} each</span></p>
                              <p className="text-[11px] text-zinc-400">
                                Ordered {new Date(listing.myOrder.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-base font-bold text-emerald-700">₱{total.toFixed(2)}</p>
                              <p className="text-[10px] text-zinc-400">total</p>
                            </div>
                          </div>
                          {!closed && (
                            <div className="flex items-center gap-3">
                              <button
                                onClick={() => openEditOrder(listing)}
                                className="text-xs text-emerald-600 hover:text-emerald-700 font-medium transition-colors"
                              >
                                Edit order
                              </button>
                              <span className="text-zinc-200">|</span>
                              <button
                                onClick={() => handleCancel(listing)}
                                className="text-xs text-red-500 hover:text-red-600 font-medium transition-colors"
                              >
                                Cancel order
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })()}

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
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEdit(listing)}
                            className="flex-1 flex items-center justify-center gap-1.5 text-sm font-medium text-zinc-700 bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 px-3 py-1.5 rounded-lg transition-colors"
                          >
                            <Pencil className="w-3.5 h-3.5" />Edit
                          </button>
                          {!closed && (
                            <button
                              onClick={() => handleClose(listing)}
                              className="flex-1 text-sm text-red-500 hover:text-red-600 font-medium border border-red-200 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors"
                            >
                              Close
                            </button>
                          )}
                        </div>
                        {closed && (
                          <button
                            onClick={() => handleSellAgain(listing)}
                            className="w-full flex items-center justify-center gap-1.5 text-sm font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3 py-1.5 rounded-lg transition-colors"
                          >
                            🔁 Sell Again
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(listing)}
                          className="w-full text-xs text-zinc-400 hover:text-red-500 transition-colors text-center py-0.5"
                        >
                          Delete listing
                        </button>
                      </div>
                    )}
                  </div>
                  </div>
                </div>{/* end inner row */}

                {/* Seller order list (expanded) — always full width */}
                {isMine && isExpanded && (
                  <div className="border-t border-zinc-100 bg-zinc-50">
                    {!sellerOrders[listing.id] ? (
                      <div className="flex justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-zinc-400" /></div>
                    ) : sellerOrders[listing.id].length === 0 ? (
                      <p className="text-xs text-zinc-400 text-center py-4">No orders yet.</p>
                    ) : (() => {
                      const orders = sellerOrders[listing.id];
                      const totalQty = orders.reduce((s, o) => s + o.quantity, 0);
                      const basePrice = parseFloat(listing.price);
                      const totalRevenue = orders.reduce((s, o) => {
                        const addOnSum = (o.selectedAddOns ?? []).reduce((a, b) => a + b.price, 0);
                        return s + (basePrice + addOnSum) * o.quantity;
                      }, 0);
                      const collected = orders.reduce((s, o) => {
                        if (!o.paidAt) return s;
                        const addOnSum = (o.selectedAddOns ?? []).reduce((a, b) => a + b.price, 0);
                        return s + (basePrice + addOnSum) * o.quantity;
                      }, 0);
                      const outstanding = totalRevenue - collected;
                      const addOnCounts: Record<string, number> = {};
                      orders.forEach((o) => (o.selectedAddOns ?? []).forEach((a) => {
                        addOnCounts[a.name] = (addOnCounts[a.name] ?? 0) + o.quantity;
                      }));
                      return (
                        <>
                          {/* Summary bar */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 border-b border-zinc-200">
                            <div className="text-center px-3 py-3 border-r border-b sm:border-b-0 border-zinc-200">
                              <p className="text-base font-black text-zinc-800">{orders.length}</p>
                              <p className="text-[10px] text-zinc-400">orders</p>
                            </div>
                            <div className="text-center px-3 py-3 border-b sm:border-b-0 sm:border-r border-zinc-200">
                              <p className="text-base font-black text-zinc-800">{totalQty}</p>
                              <p className="text-[10px] text-zinc-400">to prep</p>
                            </div>
                            <div className="text-center px-3 py-3 border-r border-zinc-200">
                              <p className="text-base font-black text-emerald-600">₱{collected.toFixed(2)}</p>
                              <p className="text-[10px] text-zinc-400">collected</p>
                            </div>
                            <div className="text-center px-3 py-3">
                              <p className="text-base font-black text-rose-500">₱{outstanding.toFixed(2)}</p>
                              <p className="text-[10px] text-zinc-400">outstanding</p>
                            </div>
                          </div>

                          {/* Add-on breakdown */}
                          {Object.keys(addOnCounts).length > 0 && (
                            <div className="px-4 py-2 border-b border-zinc-200 flex flex-wrap gap-1.5">
                              {Object.entries(addOnCounts).map(([name, count]) => (
                                <span key={name} className="text-[11px] bg-amber-50 border border-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                                  {name} ×{count}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Order rows */}
                          <div className="divide-y divide-zinc-100">
                            {orders.map((o) => {
                              const addOnSum = (o.selectedAddOns ?? []).reduce((a, b) => a + b.price, 0);
                              const rowTotal = (basePrice + addOnSum) * o.quantity;
                              const isPaid = !!o.paidAt;
                              return (
                                <div key={o.id} className={`px-4 py-2.5 flex items-start gap-3 transition-colors ${isPaid ? "bg-emerald-50/50" : ""}`}>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <button
                                        type="button"
                                        onClick={() => router.push(`/employees/${o.user.id}`)}
                                        className="text-xs font-semibold text-zinc-800 hover:underline hover:text-navy-600 transition-colors"
                                      >
                                        {o.user.displayName}
                                      </button>
                                      {o.user.department && (
                                        <span className="text-[10px] bg-zinc-100 text-zinc-500 px-1.5 py-0.5 rounded-full">{o.user.department.name}</span>
                                      )}
                                      {isPaid && (
                                        <span className="text-[10px] bg-emerald-100 text-emerald-600 px-1.5 py-0.5 rounded-full font-medium">✓ Paid</span>
                                      )}
                                    </div>
                                    <p className="text-[11px] text-zinc-500 mt-0.5">×{o.quantity} @ {formatPrice(listing.price)} each</p>
                                    {(o.selectedAddOns?.length ?? 0) > 0 && (
                                      <p className="text-[11px] text-amber-600 mt-0.5">
                                        {(o.selectedAddOns ?? []).map((a) => `+ ${a.name} (₱${a.price.toFixed(2)})`).join(", ")}
                                      </p>
                                    )}
                                    {o.note && <p className="text-[11px] text-zinc-400 italic mt-0.5">"{o.note}"</p>}
                                    <p className="text-[10px] text-zinc-300 mt-0.5">
                                      {new Date(o.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                                    </p>
                                  </div>
                                  <div className="text-right shrink-0 space-y-1.5">
                                    <p className={`text-sm font-bold ${isPaid ? "text-emerald-600" : "text-zinc-700"}`}>₱{rowTotal.toFixed(2)}</p>
                                    <button
                                      type="button"
                                      onClick={() => togglePaid(listing.id, o.id, !isPaid)}
                                      className={`text-[10px] font-medium px-2 py-0.5 rounded-full border transition-colors ${
                                        isPaid
                                          ? "border-zinc-200 text-zinc-400 hover:text-red-500 hover:border-red-200"
                                          : "border-emerald-200 text-emerald-600 hover:bg-emerald-50"
                                      }`}
                                    >
                                      {isPaid ? "Undo" : "Mark paid"}
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </>
                      );
                    })()}
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

      {selectedListing && (() => {
        const closed = isClosed(selectedListing);
        const isMine = selectedListing.createdBy.id === dbUser?.id;
        const hasOrder = !!selectedListing.myOrder;
        const addOnsTotal = selectedAddOns.reduce((s, a) => s + a.price, 0);
        const orderTotal = (parseFloat(selectedListing.price) + addOnsTotal) * qty;
        const urgency = !closed ? getUrgencyLabel(selectedListing.cutoffAt) : null;

        return (
          <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4 pb-4 sm:pb-0"
            onClick={() => { setSelectedListing(null); setModalOrderMode(null); }}
          >
            <div
              className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[85vh] flex flex-col relative"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Drag handle */}
              <div className="sm:hidden flex justify-center pt-2.5 pb-1 shrink-0">
                <div className="w-10 h-1 bg-zinc-300 rounded-full" />
              </div>

              <button
                onClick={() => { setSelectedListing(null); setModalOrderMode(null); }}
                className="absolute top-3 right-3 w-8 h-8 bg-black/50 text-white rounded-full flex items-center justify-center hover:bg-black/70 transition-colors z-10"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Scrollable content */}
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
                            onClick={() => setSelectedListingImageIndex((i) => (i - 1 + total) % total)}
                            className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full w-8 h-8 flex items-center justify-center transition-opacity opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                          >
                            <ChevronLeft className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => setSelectedListingImageIndex((i) => (i + 1) % total)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full w-8 h-8 flex items-center justify-center transition-opacity opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                          >
                            <ChevronRight className="w-5 h-5" />
                          </button>
                          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
                            {selectedListing.imageUrls.map((_, i) => (
                              <button
                                key={i}
                                onClick={() => setSelectedListingImageIndex(i)}
                                className={`w-2 h-2 rounded-full transition-colors ${i === selectedListingImageIndex ? "bg-white" : "bg-white/50"}`}
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
                      <span className="text-xs font-semibold bg-zinc-100 text-zinc-500 px-2 py-0.5 rounded-full">Closed</span>
                    )}
                  </div>

                  {/* Title */}
                  <h2 className="text-xl font-bold text-zinc-900">{selectedListing.title}</h2>

                  {/* Seller avatar + name + order count */}
                  <div className="flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => { setSelectedListing(null); setModalOrderMode(null); router.push(`/employees/${selectedListing.createdBy.id}`); }}
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
                      <span className="text-xs text-zinc-500 truncate">by {selectedListing.createdBy.displayName}</span>
                    </button>
                    <span className="text-xs text-zinc-400 shrink-0">
                      {selectedListing._count.orders} {selectedListing._count.orders === 1 ? "order" : "orders"}
                    </span>
                  </div>

                  {/* Description */}
                  {selectedListing.description && (
                    <p className="text-sm text-zinc-600 whitespace-pre-wrap leading-relaxed">{selectedListing.description}</p>
                  )}

                  {/* Add-ons list */}
                  {(selectedListing.addOns?.length ?? 0) > 0 && (
                    <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 space-y-1">
                      <p className="text-[10px] font-semibold text-amber-700 uppercase tracking-wide">Add-ons available</p>
                      {selectedListing.addOns.map((a, i) => (
                        <div key={i} className="flex justify-between text-xs text-zinc-700">
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
                    <span className="flex items-center gap-1 text-xs text-zinc-500">
                      <Clock className="w-3.5 h-3.5" />
                      Orders close {formatCutoff(selectedListing.cutoffAt)}
                    </span>
                  </div>

                  {/* Delivery date */}
                  {selectedListing.deliveryDate && (
                    <p className="text-xs text-sky-600 font-medium">🚚 Delivery: {new Date(selectedListing.deliveryDate).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}</p>
                  )}

                  {/* Action area */}
                  <div className="pt-3 border-t border-zinc-100 space-y-3">

                    {/* Closed */}
                    {closed && !isMine && (
                      <span className="text-xs font-medium text-zinc-400 bg-zinc-100 px-3 py-1.5 rounded-lg w-full block text-center">
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
                          <label className="text-xs text-zinc-500 w-16 shrink-0">Quantity</label>
                          <div className="flex items-center gap-1">
                            <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} className="w-7 h-7 rounded border border-zinc-200 text-zinc-600 hover:bg-zinc-50 text-sm font-bold">−</button>
                            <span className="w-8 text-center text-sm font-semibold">{qty}</span>
                            <button type="button" onClick={() => setQty((q) => Math.min(99, q + 1))} className="w-7 h-7 rounded border border-zinc-200 text-zinc-600 hover:bg-zinc-50 text-sm font-bold">+</button>
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
                                    className="rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500"
                                  />
                                  <span className="text-xs text-zinc-700 flex-1">{a.name}</span>
                                  <span className="text-xs font-semibold text-amber-700">{a.price > 0 ? `+₱${a.price % 1 === 0 ? a.price : a.price.toFixed(2)}` : "Free"}</span>
                                </label>
                              );
                            })}
                          </div>
                        )}
                        <input
                          value={orderNote} onChange={(e) => setOrderNote(e.target.value)}
                          placeholder="e.g. no onions (optional)"
                          className="w-full border border-zinc-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                        <div className="flex items-center justify-between text-xs px-0.5">
                          <span className="text-zinc-500">Total</span>
                          <span className="font-bold text-emerald-700 text-sm">₱{orderTotal.toFixed(2)}</span>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setModalOrderMode("confirm")}
                            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold py-2 rounded-lg transition-colors"
                          >
                            Review Order
                          </button>
                          <button onClick={() => setModalOrderMode(null)} className="text-sm text-zinc-500 hover:text-zinc-700 px-3">
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
                          <h3 className="font-bold text-zinc-900">Confirm your order</h3>
                        </div>
                        <div className="bg-zinc-50 rounded-xl p-4 space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-zinc-500">Item</span>
                            <span className="font-semibold text-zinc-900 text-right max-w-[60%] leading-snug">{selectedListing.title}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-zinc-500">Qty</span>
                            <span className="font-semibold text-zinc-900">{qty}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-zinc-500">Price each</span>
                            <span className="font-semibold text-zinc-900">{formatPrice(selectedListing.price)}</span>
                          </div>
                          {selectedAddOns.length > 0 && selectedAddOns.map((a, i) => (
                            <div key={i} className="flex justify-between">
                              <span className="text-zinc-500">+ {a.name}</span>
                              <span className="font-semibold text-amber-700">{a.price > 0 ? `+₱${a.price % 1 === 0 ? a.price : a.price.toFixed(2)}` : "Free"}</span>
                            </div>
                          ))}
                          {orderNote && (
                            <div className="flex justify-between">
                              <span className="text-zinc-500">Note</span>
                              <span className="text-zinc-600 italic text-right max-w-[60%]">&ldquo;{orderNote}&rdquo;</span>
                            </div>
                          )}
                          <div className="border-t border-zinc-200 pt-2 flex justify-between">
                            <span className="font-semibold text-zinc-700">Total</span>
                            <span className="font-bold text-emerald-700 text-base">₱{orderTotal.toFixed(2)}</span>
                          </div>
                        </div>
                        <div className="flex gap-3">
                          <button
                            onClick={() => setModalOrderMode("order")}
                            disabled={submittingOrder}
                            className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold border border-zinc-200 text-zinc-700 hover:bg-zinc-50 transition-colors"
                          >
                            Back
                          </button>
                          <button
                            onClick={() => handleOrder(selectedListing)}
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
                              <p className="text-xs font-bold text-zinc-700">Your Order</p>
                              <p className="text-xs text-zinc-600">×{oQty} {selectedListing.title} <span className="text-zinc-400">@ {formatPrice(selectedListing.price)} each</span></p>
                              {(selectedListing.myOrder!.selectedAddOns?.length ?? 0) > 0 && (
                                <div className="space-y-0.5">
                                  {selectedListing.myOrder!.selectedAddOns.map((a, i) => (
                                    <p key={i} className="text-xs text-amber-700">+ {a.name} <span className="text-zinc-400">(₱{a.price.toFixed(2)} × {oQty})</span></p>
                                  ))}
                                </div>
                              )}
                              <p className="text-[11px] text-zinc-400">
                                Ordered {new Date(selectedListing.myOrder!.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-base font-bold text-emerald-700">₱{oTotal.toFixed(2)}</p>
                              <p className="text-[10px] text-zinc-400">total</p>
                            </div>
                          </div>
                          {selectedListing.myOrder!.note && (
                            <p className="text-xs text-zinc-400 italic border-t border-emerald-100 pt-2">📝 &ldquo;{selectedListing.myOrder!.note}&rdquo;</p>
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
                              <span className="text-zinc-200">|</span>
                              <button
                                onClick={() => handleCancel(selectedListing)}
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
                          <label className="text-xs text-zinc-500 w-16 shrink-0">Quantity</label>
                          <div className="flex items-center gap-1">
                            <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} className="w-7 h-7 rounded border border-zinc-200 text-zinc-600 hover:bg-zinc-50 text-sm font-bold">−</button>
                            <span className="w-8 text-center text-sm font-semibold">{qty}</span>
                            <button type="button" onClick={() => setQty((q) => Math.min(99, q + 1))} className="w-7 h-7 rounded border border-zinc-200 text-zinc-600 hover:bg-zinc-50 text-sm font-bold">+</button>
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
                                    className="rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500"
                                  />
                                  <span className="text-xs text-zinc-700 flex-1">{a.name}</span>
                                  <span className="text-xs font-semibold text-amber-700">{a.price > 0 ? `+₱${a.price % 1 === 0 ? a.price : a.price.toFixed(2)}` : "Free"}</span>
                                </label>
                              );
                            })}
                          </div>
                        )}
                        <input
                          value={orderNote} onChange={(e) => setOrderNote(e.target.value)}
                          placeholder="e.g. no onions (optional)"
                          className="w-full border border-zinc-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                        <div className="flex items-center justify-between text-xs px-0.5">
                          <span className="text-zinc-500">Total</span>
                          <span className="font-bold text-emerald-700 text-sm">₱{((parseFloat(selectedListing.price) + selectedAddOns.reduce((s, a) => s + a.price, 0)) * qty).toFixed(2)}</span>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleUpdateOrder(selectedListing)}
                            disabled={submittingOrder}
                            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold py-2 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                          >
                            {submittingOrder && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                            Save Changes
                          </button>
                          <button onClick={() => setModalOrderMode(null)} className="text-sm text-zinc-500 hover:text-zinc-700 px-3">
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
