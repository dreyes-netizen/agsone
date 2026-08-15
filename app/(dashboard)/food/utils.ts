import type { AddOn, Listing, OrderRow, OrderState } from "./types";

export function formatPrice(price: string) {
  return `₱${parseFloat(price).toFixed(2)}`;
}

/** Order total = (base listing price + sum of selected add-on prices) × quantity. */
export function computeOrderTotal(basePrice: number, order: { quantity: number; selectedAddOns: AddOn[] }) {
  const addOnSum = (order.selectedAddOns ?? []).reduce((sum, a) => sum + a.price, 0);
  return (basePrice + addOnSum) * order.quantity;
}

export type ListingStats = {
  orderCount: number;
  quantity: number;
  total: number;
  collected: number;
  outstanding: number;
};

/** Aggregate order/prep/payment stats for one listing, derived from its `orders`. */
export function computeListingStats(listing: Listing): ListingStats {
  const orders = listing.orders ?? [];
  const basePrice = parseFloat(listing.price);
  let quantity = 0;
  let total = 0;
  let collected = 0;
  for (const o of orders) {
    const rowTotal = computeOrderTotal(basePrice, o);
    quantity += o.quantity;
    total += rowTotal;
    if (o.paidAt) collected += rowTotal;
  }
  return { orderCount: orders.length, quantity, total, collected, outstanding: total - collected };
}

/** Sum per-listing stats across every listing a seller owns, for the dashboard summary cards. */
export function computeSellerTotals(listings: Listing[]) {
  return listings.reduce(
    (acc, l) => {
      const s = computeListingStats(l);
      acc.orderCount += s.orderCount;
      acc.quantity += s.quantity;
      acc.total += s.total;
      acc.collected += s.collected;
      acc.outstanding += s.outstanding;
      return acc;
    },
    { orderCount: 0, quantity: 0, total: 0, collected: 0, outstanding: 0 }
  );
}

export function formatOrderTime(createdAt: string) {
  const d = new Date(createdAt);
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  if (d.toDateString() === new Date().toDateString()) return `Today, ${time}`;
  return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function initials(displayName: string) {
  return displayName.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
}

export function matchesOrderSearch(order: OrderRow, query: string) {
  if (!query.trim()) return true;
  return order.user.displayName.toLowerCase().includes(query.trim().toLowerCase());
}

export function formatCutoff(cutoffAt: string) {
  return new Date(cutoffAt).toLocaleString("en-US", {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
}

/** Same "Aug 31, 7:00 PM" shape as formatCutoff — used for delivery dates and other datetimes. */
export function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
}

export function isClosed(listing: Listing) {
  return !listing.isActive || new Date(listing.cutoffAt) <= new Date();
}

/**
 * There's no persisted order-lifecycle field — only a listing's own
 * `deliveryDate`. An order is "completed" once that delivery date has
 * passed; otherwise it's still active/upcoming. No "cancelled" bucket
 * exists because cancelling an order deletes the row outright.
 */
export function deriveOrderState(listing: Listing): OrderState {
  if (listing.deliveryDate && new Date(listing.deliveryDate) <= new Date()) return "COMPLETED";
  return "ACTIVE";
}

export function getUrgencyLabel(cutoffAt: string): string | null {
  const diff = new Date(cutoffAt).getTime() - Date.now();
  if (diff <= 0 || diff > 60 * 60_000) return null;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "Closes in less than a minute";
  if (minutes === 1) return "Closes in 1 min";
  return `Closes in ${minutes} min`;
}
