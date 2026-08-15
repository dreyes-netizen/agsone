export type AddOn = { name: string; price: number };

export type MyOrder = {
  id: string;
  quantity: number;
  note: string | null;
  selectedAddOns: AddOn[];
  paidAt: string | null;
  createdAt: string;
};

export type OrderRow = {
  id: string;
  quantity: number;
  note: string | null;
  selectedAddOns: AddOn[];
  paidAt: string | null;
  createdAt: string;
  user: { id: string; displayName: string; avatarUrl: string | null; department: { name: string } | null };
};

export type Listing = {
  id: string;
  title: string;
  description: string | null;
  price: string;
  imageUrls: string[];
  cutoffAt: string;
  deliveryDate: string | null;
  addOns: AddOn[];
  isActive: boolean;
  createdAt: string;
  createdBy: { id: string; displayName: string; avatarUrl: string | null; department: { name: string } | null };
  myOrder: MyOrder | null;
  _count: { orders: number };
  /** Every order on this listing — only populated when the caller owns it (Selling tab). */
  orders?: OrderRow[];
};

export type Tab = "AVAILABLE" | "MY_ORDERS" | "MY_LISTINGS";

/** Derived, not persisted — a buyer's order is "completed" once its listing's delivery has passed. */
export type OrderState = "ACTIVE" | "COMPLETED";

export type FoodSortOption = "cutoffSoonest" | "newest" | "priceLow" | "priceHigh";
