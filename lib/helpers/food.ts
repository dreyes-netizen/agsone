import type { Listing } from "@/lib/types/food";

export function formatPrice(price: string) {
  return `₱${parseFloat(price).toFixed(2)}`;
}

export function formatCutoff(cutoffAt: string) {
  return new Date(cutoffAt).toLocaleString("en-US", {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
}

export function isClosed(listing: Listing) {
  return !listing.isActive || new Date(listing.cutoffAt) <= new Date();
}

export function getUrgencyLabel(cutoffAt: string): string | null {
  const diff = new Date(cutoffAt).getTime() - Date.now();
  if (diff <= 0 || diff > 60 * 60_000) return null;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "Closes in less than a minute";
  if (minutes === 1) return "Closes in 1 min";
  return `Closes in ${minutes} min`;
}
