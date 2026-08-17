"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useApiClient } from "@/lib/hooks/useApiClient";
import { uploadToCloudinary } from "@/lib/cloudinary/upload";
import { Plus, UtensilsCrossed } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { AddOn, MyOrder, Listing, Tab } from "./types";
import { ListingFormPanel } from "./components/ListingFormPanel";
import { FoodListingDetailModal } from "./components/FoodListingDetailModal";
import { AvailableView } from "./components/AvailableView";
import { MyOrdersView } from "./components/MyOrdersView";
import { SellingView } from "./components/selling/SellingView";
import { useRealtimeChannel } from "@/lib/hooks/useRealtimeChannel";
import { realtimeTopics } from "@/lib/realtime/topics";

// Closed by default — split into its own chunk instead of shipping with the
// page bundle.
const ImageLightbox = dynamic(
  () => import("@/components/ImageLightbox").then((m) => m.ImageLightbox),
  { ssr: false },
);

const TABS: [Tab, string][] = [
  ["AVAILABLE", "Available"],
  ["MY_ORDERS", "My Orders"],
  ["MY_LISTINGS", "Selling"],
];

const TAB_SUBTITLE: Record<Tab, string> = {
  AVAILABLE: "Order food from your colleagues.",
  MY_ORDERS: "Track your purchases and upcoming deliveries.",
  MY_LISTINGS: "Manage your listings and incoming orders.",
};

export default function FoodPage() {
  const { user, dbUser, token, loading: authLoading } = useAuth();
  const { apiFetch } = useApiClient();
  const router = useRouter();

  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("AVAILABLE");
  const [deleteTarget, setDeleteTarget] = useState<Listing | null>(null);
  const [closeTarget, setCloseTarget] = useState<Listing | null>(null);

  // Order form state
  const [qty, setQty] = useState(1);
  const [orderNote, setOrderNote] = useState("");
  const [selectedAddOns, setSelectedAddOns] = useState<AddOn[]>([]);
  const [submittingOrder, setSubmittingOrder] = useState(false);

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

  useRealtimeChannel(realtimeTopics.food, load, { debounceMs: 200 });

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
    if (new Date(newDeliveryDate) <= new Date(newCutoff)) {
      toast.error("Delivery date & time must be after the order cutoff");
      return;
    }
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
        deliveryDate: new Date(newDeliveryDate).toISOString(),
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
      const newMyOrder = { id: "optimistic", quantity: qty, note: orderNote || null, selectedAddOns, paidAt: null, createdAt: new Date().toISOString() };
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
      setListings((prev) =>
        prev.map((l) =>
          l.id === listingId
            ? { ...l, orders: (l.orders ?? []).map((o) => o.id === orderId ? { ...o, paidAt: res.data.paidAt } : o) }
            : l
        )
      );
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

  // ── Sell Food CTA (Selling empty state / header) ─────────────────────────────
  function openSellForm() {
    resetForm();
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // ── Delete listing ────────────────────────────────────────────────────────────
  function handleDelete(listing: Listing) {
    setDeleteTarget(listing);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const listing = deleteTarget;
    setDeleteTarget(null);
    try {
      await apiFetch(`/api/food/${listing.id}`, { method: "DELETE" });
      setListings((prev) => prev.filter((l) => l.id !== listing.id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete listing");
    }
  }

  // ── Close listing ─────────────────────────────────────────────────────────────
  function handleClose(listing: Listing) {
    setCloseTarget(listing);
  }

  async function confirmClose() {
    if (!closeTarget) return;
    const listing = closeTarget;
    setCloseTarget(null);
    try {
      await apiFetch(`/api/food/${listing.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: false }),
      });
      setListings((prev) => prev.map((l) => l.id === listing.id ? { ...l, isActive: false } : l));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to close listing");
    }
  }

  // ── Filter ───────────────────────────────────────────────────────────────────
  const filtered = listings.filter((l) => {
    if (tab === "AVAILABLE") return l.isActive && new Date(l.cutoffAt) > new Date() && l.createdBy.id !== dbUser?.id;
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
          <p className="text-gray-500 text-sm mt-1">{TAB_SUBTITLE[tab]}</p>
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
          {tab === "MY_LISTINGS" ? (
            <>
              <Plus className="w-4 h-4" aria-hidden="true" />
              New Listing
            </>
          ) : (
            <>
              <UtensilsCrossed className="w-4 h-4" aria-hidden="true" />
              Sell Food
            </>
          )}
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
      <div
        role="tablist"
        aria-label="Food board views"
        className="inline-flex items-center gap-1 bg-gray-100 p-1 rounded-lg w-full overflow-x-auto scrollbar-hide sm:w-fit"
      >
        {TABS.map(([t, label]) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            aria-controls={`panel-${t}`}
            tabIndex={tab === t ? 0 : -1}
            onClick={() => setTab(t)}
            className={`px-3.5 py-1.5 rounded-md text-sm font-medium transition-all whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-command-black ${
              tab === t
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-600 hover:text-gray-800"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Listings */}
      <div id={`panel-${tab}`} role="tabpanel" aria-labelledby={tab}>
        {tab === "MY_LISTINGS" ? (
          <SellingView
            listings={filtered}
            loading={loading}
            onSellFood={openSellForm}
            onEdit={handleEdit}
            onCloseListing={handleClose}
            onSellAgain={handleSellAgain}
            onDelete={handleDelete}
            onTogglePaid={togglePaid}
            onViewUser={(userId) => router.push(`/employees/${userId}`)}
          />
        ) : tab === "MY_ORDERS" ? (
          <MyOrdersView
            listings={filtered}
            loading={loading}
            onOpenOrder={openDetail}
            onCancelOrder={handleCancel}
            onBrowseAvailable={() => setTab("AVAILABLE")}
          />
        ) : (
          <AvailableView
            listings={filtered}
            loading={loading}
            currentUserId={dbUser?.id}
            cardImageIndices={cardImageIndices}
            onImageIndexChange={(id, i) => setCardImageIndices((prev) => ({ ...prev, [id]: i }))}
            onOpenDetail={openDetail}
            onOpenOrder={openOrderModal}
            onOpenEditOrder={openEditOrder}
            onCancelOrder={handleCancel}
            onViewUser={(userId) => router.push(`/employees/${userId}`)}
          />
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

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &quot;{deleteTarget?.title}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone and will remove all orders.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction autoFocus variant="destructive" onClick={confirmDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!closeTarget} onOpenChange={(open) => { if (!open) setCloseTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Close &quot;{closeTarget?.title}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>No more orders will be accepted.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction autoFocus onClick={confirmClose}>
              Close
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
