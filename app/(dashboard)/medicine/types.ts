import type { MedicineCategory } from "@/lib/constants/medicineCategories";

export type Medicine = {
  id: string;
  name: string;
  imageUrl: string;
  caption: string;
  stockQuantity: number;
  category: MedicineCategory;
};

export type MedicineRequestStatus = "PENDING" | "APPROVED" | "REJECTED";

export type MedicineRequest = {
  id: string;
  medicineId: string;
  quantity: number;
  status: MedicineRequestStatus;
  createdAt: string;
  medicine: { name: string };
};

export type SortOption = "nameAsc" | "availability";

export const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "nameAsc", label: "Name A–Z" },
  { value: "availability", label: "Availability" },
];

export type MedicineView = "catalog" | "requests";
