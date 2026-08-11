"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useApiClient } from "@/lib/hooks/useApiClient";
import { uploadToCloudinary } from "@/lib/cloudinary/upload";
import type { AddOn, Listing, MyOrder, OrderRow } from "@/lib/types/food";

export function useFoodActions() {
  const { user, token, loading: authLoading } = useAuth();
  const { apiFetch } = useApiClient();

  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);

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
  const [deleteTarget, setDeleteTarget] = useState<Listing | null>(null);
  const [closeTarget, setCloseTarget] = useState<Listing | null>(null);

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

  return {
    // state
    listings, setListings,
    loading,

    qty, setQty,
    orderNote, setOrderNote,
    selectedAddOns, setSelectedAddOns,
    submittingOrder,

    expandedId, setExpandedId,
    sellerOrders,

    lightbox, setLightbox,
    selectedListing, setSelectedListing,
    selectedListingImageIndex, setSelectedListingImageIndex,
    cardImageIndices, setCardImageIndices,
    modalOrderMode, setModalOrderMode,
    deleteTarget, setDeleteTarget,
    closeTarget, setCloseTarget,

    showForm, setShowForm,
    editingId, setEditingId,
    newTitle, setNewTitle,
    newDesc, setNewDesc,
    newPrice, setNewPrice,
    newCutoff, setNewCutoff,
    newDeliveryDate, setNewDeliveryDate,
    newImages, setNewImages,
    imagePreviews, setImagePreviews,
    existingImageUrls, setExistingImageUrls,
    newAddOns, setNewAddOns,
    addOnName, setAddOnName,
    addOnPrice, setAddOnPrice,
    creating,

    // handlers
    load,
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
  };
}
