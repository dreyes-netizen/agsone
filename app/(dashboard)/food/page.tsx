"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useApiClient } from "@/lib/hooks/useApiClient";
import { uploadToCloudinary } from "@/lib/cloudinary/upload";
import { UtensilsCrossed } from "lucide-react";
import { toast } from "sonner";
import type { AddOn, MyOrder, OrderRow, Listing, Tab } from "./types";
import { ListingFormPanel } from "./components/ListingFormPanel";
import { FoodListingCard } from "./components/FoodListingCard";
import { FoodListingDetailModal } from "./components/FoodListingDetailModal";

// Closed by default — split into its own chunk instead of shipping with the
// page bundle.
const ImageLightbox = dynamic(
  () => import("@/components/ImageLightbox").then((m) => m.ImageLightbox),
  { ssr: false },
);

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

  async function load() {
    try {
      const r = await apiFetch<{ data: Listing[] }>("/api/food");
      setListings(r.data);
    } catch {
      toast.error("Failed to load listings");
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
      toast.error(err instanceof Error ? err.message : "Failed to save listing");
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
      toast.success("Order placed!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to place order");
    } finally {
      setSubmittingOrder(false);
    }
  }

  // ── Edit order ───────────────────────────────────────────────────────────────
  function openDetail(listing: Listing) {
    setSelectedListing(listing);
    setSelectedListingImageIndex(cardImageIndices[listing.id] ?? 0);
  }

  function openOrderModal(listing: Listing) {
    openDetail(listing);
    setQty(1);
    setOrderNote("");
    setSelectedAddOns([]);
    setModalOrderMode("order");
  }

  function openEditOrder(listing: Listing) {
    if (!listing.myOrder) return;
    setQty(listing.myOrder.quantity);
    setOrderNote(listing.myOrder.note ?? "");
    setSelectedAddOns(listing.myOrder.selectedAddOns ?? []);
    openDetail(listing);
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
      toast.success("Order updated!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update order");
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
      toast.success("Order cancelled");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to cancel order");
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
      toast.error(err instanceof Error ? err.message : "Failed to update payment status");
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
      toast.error("Failed to load orders");
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
          <h1 className="text-2xl font-bold text-gray-900">Food Board</h1>
          <p className="text-gray-500 text-sm mt-1">Order food from your colleagues</p>
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
           className="flex items-center gap-2 bg-command-black hover:bg-gray-800 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-command-black"
        >
          <UtensilsCrossed className="w-4 h-4" aria-hidden="true" />
          Sell Food
        </button>
      </div>

      {/* Create / edit form */}
      {showForm && (
        <ListingFormPanel
          editingId={editingId}
          newTitle={newTitle}
          onTitleChange={setNewTitle}
          newDesc={newDesc}
          onDescChange={setNewDesc}
          newPrice={newPrice}
          onPriceChange={setNewPrice}
          newCutoff={newCutoff}
          onCutoffChange={setNewCutoff}
          newDeliveryDate={newDeliveryDate}
          onDeliveryDateChange={setNewDeliveryDate}
          existingImageUrls={existingImageUrls}
          imagePreviews={imagePreviews}
          totalImages={totalImages}
          onImagePick={handleImagePick}
          onRemoveExistingImage={removeExistingImage}
          onRemoveNewImage={removeNewImage}
          newAddOns={newAddOns}
          addOnName={addOnName}
          onAddOnNameChange={setAddOnName}
          addOnPrice={addOnPrice}
          onAddOnPriceChange={setAddOnPrice}
          onAddAddOn={addAddOn}
          onRemoveAddOn={removeAddOn}
          creating={creating}
          onSubmit={handleSubmit}
          onCancel={resetForm}
        />
      )}

      {/* Tabs — horizontal scroll on mobile */}
      <div role="tablist" aria-label="Food board views" className="flex gap-2 overflow-x-auto scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0 sm:overflow-visible pb-0.5">
        {([["AVAILABLE", "Available"], ["MY_ORDERS", "My Orders"], ["MY_LISTINGS", "My Listings"]] as [Tab, string][]).map(([t, label]) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            aria-controls={`panel-${t}`}
            tabIndex={tab === t ? 0 : -1}
            onClick={() => setTab(t)}
            className={`px-3.5 py-1.5 rounded-lg text-sm font-medium border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-command-black ${
              tab === t
                ? "bg-command-black text-white border-command-black"
                : "bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Listings */}
      <div id={`panel-${tab}`} role="tabpanel" aria-labelledby={tab}>
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 overflow-hidden animate-pulse">
              <div className="h-36 bg-gray-100" />
              <div className="p-4 space-y-2">
                <div className="h-4 bg-gray-100 rounded w-2/3" />
                <div className="h-3 bg-gray-100 rounded w-full" />
                <div className="h-8 bg-gray-100 rounded-lg w-full mt-3" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-card border border-table-border text-center">
          <UtensilsCrossed className="w-10 h-10 text-gray-500 mb-4" aria-hidden="true" />
          <p className="text-gray-600 font-medium">Nothing here</p>
          <p className="text-gray-500 text-sm mt-1">
            {tab === "AVAILABLE" ? "No food listings right now — be the first to post!" : "Nothing to show for this tab."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((listing) => (
            <FoodListingCard
              key={listing.id}
              listing={listing}
              currentUserId={dbUser?.id}
              cardImageIndex={cardImageIndices[listing.id] ?? 0}
              onImageIndexChange={(i) => setCardImageIndices((prev) => ({ ...prev, [listing.id]: i }))}
              isExpanded={expandedId === listing.id}
              sellerOrders={sellerOrders[listing.id]}
              onOpenDetail={openDetail}
              onOpenOrder={openOrderModal}
              onOpenEditOrder={openEditOrder}
              onCancelOrder={handleCancel}
              onToggleSellerOrders={toggleSellerOrders}
              onTogglePaid={togglePaid}
              onEdit={handleEdit}
              onCloseListing={handleClose}
              onSellAgain={handleSellAgain}
              onDelete={handleDelete}
              onViewUser={(userId) => router.push(`/employees/${userId}`)}
            />
          ))}
        </div>
      )}
      </div>

      {lightbox && (
        <ImageLightbox
          images={lightbox.images}
          initialIndex={lightbox.index}
          open={!!lightbox}
          onClose={() => setLightbox(null)}
        />
      )}

      <FoodListingDetailModal
        listing={selectedListing}
        imageIndex={selectedListingImageIndex}
        onImageIndexChange={setSelectedListingImageIndex}
        onOpenLightbox={(images, index) => setLightbox({ images, index })}
        onClose={() => { setSelectedListing(null); setModalOrderMode(null); }}
        onViewSeller={(userId) => { setSelectedListing(null); setModalOrderMode(null); router.push(`/employees/${userId}`); }}
        currentUserId={dbUser?.id}
        orderMode={modalOrderMode}
        qty={qty}
        setQty={setQty}
        orderNote={orderNote}
        setOrderNote={setOrderNote}
        selectedAddOns={selectedAddOns}
        setSelectedAddOns={setSelectedAddOns}
        submittingOrder={submittingOrder}
        onStartOrder={() => { setModalOrderMode("order"); setQty(1); setOrderNote(""); setSelectedAddOns([]); }}
        onReviewOrder={() => setModalOrderMode("confirm")}
        onBackToOrderForm={() => setModalOrderMode("order")}
        onPlaceOrder={handleOrder}
        onStartEditOrder={() => {
          if (!selectedListing?.myOrder) return;
          setQty(selectedListing.myOrder.quantity);
          setOrderNote(selectedListing.myOrder.note ?? "");
          setSelectedAddOns(selectedListing.myOrder.selectedAddOns ?? []);
          setModalOrderMode("edit");
        }}
        onCancelOrderEdit={() => setModalOrderMode(null)}
        onUpdateOrder={handleUpdateOrder}
        onCancelOrder={handleCancel}
      />
    </div>
  );
}
