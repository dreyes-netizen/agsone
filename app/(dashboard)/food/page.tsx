"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthProvider";
import { UtensilsCrossed } from "lucide-react";
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
import { useFoodActions } from "@/lib/hooks/useFoodActions";
import { ListingForm } from "@/components/food/ListingForm";
import { ListingCard } from "@/components/food/ListingCard";
import { ListingDetailModal } from "@/components/food/ListingDetailModal";
import type { FoodTab } from "@/lib/types/food";

// Closed by default — split into its own chunk instead of shipping with the
// page bundle.
const ImageLightbox = dynamic(
  () => import("@/components/ImageLightbox").then((m) => m.ImageLightbox),
  { ssr: false },
);

export default function FoodPage() {
  const { dbUser } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<FoodTab>("AVAILABLE");

  const {
    listings,
    loading,

    qty, setQty,
    orderNote, setOrderNote,
    selectedAddOns, setSelectedAddOns,
    submittingOrder,

    expandedId,
    sellerOrders,

    lightbox, setLightbox,
    selectedListing, setSelectedListing,
    selectedListingImageIndex, setSelectedListingImageIndex,
    cardImageIndices, setCardImageIndices,
    modalOrderMode, setModalOrderMode,
    deleteTarget, setDeleteTarget,
    closeTarget, setCloseTarget,

    showForm, setShowForm,
    editingId,
    newTitle, setNewTitle,
    newDesc, setNewDesc,
    newPrice, setNewPrice,
    newCutoff, setNewCutoff,
    newDeliveryDate, setNewDeliveryDate,
    imagePreviews,
    existingImageUrls,
    newAddOns,
    addOnName, setAddOnName,
    addOnPrice, setAddOnPrice,
    creating,

    handleImagePick,
    removeNewImage,
    removeExistingImage,
    addAddOn,
    removeAddOn,
    resetForm,
    handleEdit,
    handleSubmit,
    handleOrder,
    openEditOrder,
    handleUpdateOrder,
    handleCancel,
    togglePaid,
    handleSellAgain,
    handleDelete,
    confirmDelete,
    handleClose,
    confirmClose,
    toggleSellerOrders,
  } = useFoodActions();

  function openListing(listing: (typeof listings)[number]) {
    setSelectedListing(listing);
    setSelectedListingImageIndex(cardImageIndices[listing.id] ?? 0);
  }

  function startOrder(listing: (typeof listings)[number]) {
    setSelectedListing(listing);
    setSelectedListingImageIndex(cardImageIndices[listing.id] ?? 0);
    setQty(1); setOrderNote(""); setSelectedAddOns([]);
    setModalOrderMode("order");
  }

  // ── Filter ───────────────────────────────────────────────────────────────────
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
        <ListingForm
          editingId={editingId}
          newTitle={newTitle} setNewTitle={setNewTitle}
          newDesc={newDesc} setNewDesc={setNewDesc}
          newPrice={newPrice} setNewPrice={setNewPrice}
          newCutoff={newCutoff} setNewCutoff={setNewCutoff}
          newDeliveryDate={newDeliveryDate} setNewDeliveryDate={setNewDeliveryDate}
          existingImageUrls={existingImageUrls}
          imagePreviews={imagePreviews}
          handleImagePick={handleImagePick}
          removeNewImage={removeNewImage}
          removeExistingImage={removeExistingImage}
          newAddOns={newAddOns}
          addOnName={addOnName} setAddOnName={setAddOnName}
          addOnPrice={addOnPrice} setAddOnPrice={setAddOnPrice}
          addAddOn={addAddOn}
          removeAddOn={removeAddOn}
          creating={creating}
          onSubmit={handleSubmit}
          onCancel={resetForm}
        />
      )}

      {/* Tabs — horizontal scroll on mobile */}
      <div role="tablist" aria-label="Food board views" className="flex gap-2 overflow-x-auto scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0 sm:overflow-visible pb-0.5">
        {([["AVAILABLE", "Available"], ["MY_ORDERS", "My Orders"], ["MY_LISTINGS", "My Listings"]] as [FoodTab, string][]).map(([t, label]) => (
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
            <ListingCard
              key={listing.id}
              listing={listing}
              dbUserId={dbUser?.id}
              expandedId={expandedId}
              sellerOrders={sellerOrders}
              cardImageIndices={cardImageIndices}
              setCardImageIndices={setCardImageIndices}
              router={router}
              onOpenListing={openListing}
              onStartOrder={startOrder}
              onEditOrder={openEditOrder}
              onCancelOrder={handleCancel}
              onToggleSellerOrders={toggleSellerOrders}
              onEditListing={handleEdit}
              onCloseListing={handleClose}
              onSellAgain={handleSellAgain}
              onDeleteListing={handleDelete}
              onTogglePaid={togglePaid}
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

      <ListingDetailModal
        selectedListing={selectedListing}
        dbUserId={dbUser?.id}
        modalOrderMode={modalOrderMode} setModalOrderMode={setModalOrderMode}
        qty={qty} setQty={setQty}
        orderNote={orderNote} setOrderNote={setOrderNote}
        selectedAddOns={selectedAddOns} setSelectedAddOns={setSelectedAddOns}
        submittingOrder={submittingOrder}
        selectedListingImageIndex={selectedListingImageIndex} setSelectedListingImageIndex={setSelectedListingImageIndex}
        setLightbox={setLightbox}
        router={router}
        onOpenChange={(open) => { if (!open) { setSelectedListing(null); setModalOrderMode(null); } }}
        onOrder={handleOrder}
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
            <AlertDialogAction autoFocus variant="destructive" onClick={confirmClose}>
              Close
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
